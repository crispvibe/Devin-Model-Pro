// Prompt Cache / Token 优化（移植自上游 v2.3.0）
// - Anthropic：对 system / tools / messages 稳定前缀打 cache_control
// - OpenAI：tools 排序 + 前缀稳定化（observe/auto 模式）
const CACHE_CONTROL_EPHEMERAL = {
  type: 'ephemeral',
};

function parsePositiveIntEnv(name, fallback) {
  const value = parseInt(String(process.env[name] ?? ''), 10);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function parseBooleanEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }
  return raw === 'true' || raw === '1';
}

export function normalizeOpenAIPromptCacheMode(value) {
  const mode = String(value || 'observe')
    .trim()
    .toLowerCase();
  if (mode === 'off' || mode === 'observe' || mode === 'auto') {
    return mode;
  }
  return 'observe';
}

export function getPromptCacheConfig() {
  const enabled = parseBooleanEnv('PROMPT_CACHE_ENABLED', true);
  return {
    enabled,
    anthropic: enabled && parseBooleanEnv('ANTHROPIC_PROMPT_CACHE', true),
    openaiMode: normalizeOpenAIPromptCacheMode(process.env.OPENAI_PROMPT_CACHE),
    sortTools: parseBooleanEnv('PROMPT_CACHE_SORT_TOOLS', true),
    tailMessages: parsePositiveIntEnv('PROMPT_CACHE_TAIL_MESSAGES', 2),
  };
}

function stableJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableJsonValue);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const next = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    next[key] = stableJsonValue(value[key]);
  }
  return next;
}

export function shouldOptimizeOpenAIPrefix(options = {}) {
  const config = options.config || getPromptCacheConfig();
  return config.enabled !== false && normalizeOpenAIPromptCacheMode(config.openaiMode) !== 'off';
}

export function sortToolsForStablePrefix(tools, options = {}) {
  if (!Array.isArray(tools) || tools.length === 0) {
    return tools;
  }
  const config = options.config || getPromptCacheConfig();
  if (config.sortTools === false) {
    return tools;
  }
  const normalized = tools.map((tool) => stableJsonValue(tool));
  return normalized.sort((a, b) => {
    const nameCompare = String(a?.name || '').localeCompare(String(b?.name || ''));
    if (nameCompare !== 0) {
      return nameCompare;
    }
    return JSON.stringify(a).localeCompare(JSON.stringify(b));
  });
}

export function prepareToolsForPromptCache(tools, providerKind, options = {}) {
  if (!Array.isArray(tools) || tools.length === 0) {
    return tools;
  }
  const provider = String(providerKind || '')
    .trim()
    .toLowerCase();
  const config = options.config || getPromptCacheConfig();
  if (config.enabled === false) {
    return tools;
  }
  if (provider === 'openai' || provider === 'gemini') {
    return shouldOptimizeOpenAIPrefix({
      config,
    })
      ? sortToolsForStablePrefix(tools, {
          config,
        })
      : tools;
  }
  return sortToolsForStablePrefix(tools, {
    config,
  });
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyCacheControlToTextBlocks(content) {
  if (typeof content === 'string') {
    return [
      {
        type: 'text',
        text: content,
        cache_control: CACHE_CONTROL_EPHEMERAL,
      },
    ];
  }
  if (!Array.isArray(content)) {
    return content;
  }
  const blocks = content.map((block) => {
    if (!block || typeof block !== 'object') {
      return block;
    }
    if (block.type === 'text' && typeof block.text === 'string') {
      return {
        ...block,
        cache_control: CACHE_CONTROL_EPHEMERAL,
      };
    }
    return {
      ...block,
    };
  });
  return blocks;
}

function applySystemPromptCache(system) {
  if (system == null || system === '') {
    return system;
  }
  if (Array.isArray(system)) {
    const blocks = cloneJson(system);
    for (let i = blocks.length - 1; i >= 0; i -= 1) {
      if (blocks[i]?.type === 'text') {
        blocks[i] = {
          ...blocks[i],
          cache_control: CACHE_CONTROL_EPHEMERAL,
        };
        return blocks;
      }
    }
    blocks.push({
      type: 'text',
      text: '',
      cache_control: CACHE_CONTROL_EPHEMERAL,
    });
    return blocks;
  }
  return [
    {
      type: 'text',
      text: String(system),
      cache_control: CACHE_CONTROL_EPHEMERAL,
    },
  ];
}

function applyToolsCache(tools) {
  if (!Array.isArray(tools) || tools.length === 0) {
    return tools;
  }
  const cloned = cloneJson(tools);
  cloned[cloned.length - 1] = {
    ...cloned[cloned.length - 1],
    cache_control: CACHE_CONTROL_EPHEMERAL,
  };
  return cloned;
}

function applyMessagesPrefixCache(messages, tailMessages, additionalTailMessages = 0) {
  const stableTailMessages = Number.isInteger(tailMessages) ? Math.max(0, tailMessages) : 0;
  const volatileTailMessages = Number.isInteger(additionalTailMessages)
    ? Math.max(0, additionalTailMessages)
    : 0;
  const effectiveTailMessages = stableTailMessages + volatileTailMessages;
  if (!Array.isArray(messages) || messages.length <= effectiveTailMessages) {
    return messages;
  }
  const cloned = cloneJson(messages);
  const cacheIndex = cloned.length - effectiveTailMessages - 1;
  const target = cloned[cacheIndex];
  if (!target) {
    return cloned;
  }
  if (typeof target.content === 'string') {
    target.content = applyCacheControlToTextBlocks(target.content);
  } else if (Array.isArray(target.content)) {
    const blocks = cloneJson(target.content);
    for (let i = blocks.length - 1; i >= 0; i -= 1) {
      if (blocks[i]?.type === 'text') {
        blocks[i] = {
          ...blocks[i],
          cache_control: CACHE_CONTROL_EPHEMERAL,
        };
        break;
      }
    }
    target.content = blocks;
  }
  return cloned;
}

export function applyAnthropicPromptCache(body, options = {}) {
  const config = {
    ...getPromptCacheConfig(),
    ...options,
  };
  if (!config.enabled || config.anthropic === false) {
    return body;
  }
  const next = cloneJson(body);
  if (next.system != null && next.system !== '') {
    next.system = applySystemPromptCache(next.system);
  }
  if (Array.isArray(next.tools) && next.tools.length > 0) {
    next.tools = applyToolsCache(next.tools);
  }
  if (Array.isArray(next.messages)) {
    next.messages = applyMessagesPrefixCache(
      next.messages,
      config.tailMessages,
      Number.parseInt(String(config.additionalTailMessages || '0'), 10)
    );
  }
  return next;
}

export function shouldRetryWithoutPromptCache(statusCode, bodyText) {
  if (![400, 401, 403, 404, 422, 500, 501, 502].includes(statusCode)) {
    return false;
  }
  const text = String(bodyText || '').toLowerCase();
  return /cache_control|prompt caching|prompt_cache|cached content|cache control|cache breakpoint|cache\.control|ephemeral cache/.test(
    text
  );
}
