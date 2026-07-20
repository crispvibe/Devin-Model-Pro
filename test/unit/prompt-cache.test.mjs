import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyAnthropicPromptCache,
  getPromptCacheConfig,
  normalizeOpenAIPromptCacheMode,
  prepareToolsForPromptCache,
  shouldOptimizeOpenAIPrefix,
  shouldRetryWithoutPromptCache,
  sortToolsForStablePrefix,
} from "../../src/proxy/handlers/prompt-cache.js";

// 移植自上游 v2.3.0 的 prompt cache 单测，覆盖配置解析、tools 稳定排序、
// Anthropic cache_control 打标与网关拒绝检测。

const CACHE_ENV_KEYS = [
  "PROMPT_CACHE_ENABLED",
  "ANTHROPIC_PROMPT_CACHE",
  "OPENAI_PROMPT_CACHE",
  "PROMPT_CACHE_SORT_TOOLS",
  "PROMPT_CACHE_TAIL_MESSAGES",
];

function withEnv(patch, fn) {
  const saved = {};
  for (const key of CACHE_ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  Object.assign(process.env, patch);
  try {
    return fn();
  } finally {
    for (const key of CACHE_ENV_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  }
}

test("getPromptCacheConfig defaults: enabled, anthropic on, openai observe, tail 2", () => {
  withEnv({}, () => {
    const config = getPromptCacheConfig();
    assert.equal(config.enabled, true);
    assert.equal(config.anthropic, true);
    assert.equal(config.openaiMode, "observe");
    assert.equal(config.sortTools, true);
    assert.equal(config.tailMessages, 2);
  });
});

test("PROMPT_CACHE_ENABLED=false disables anthropic cache too", () => {
  withEnv({ PROMPT_CACHE_ENABLED: "false" }, () => {
    const config = getPromptCacheConfig();
    assert.equal(config.enabled, false);
    assert.equal(config.anthropic, false);
  });
});

test("normalizeOpenAIPromptCacheMode falls back to observe on invalid values", () => {
  assert.equal(normalizeOpenAIPromptCacheMode("AUTO"), "auto");
  assert.equal(normalizeOpenAIPromptCacheMode("off"), "off");
  assert.equal(normalizeOpenAIPromptCacheMode("bogus"), "observe");
  assert.equal(normalizeOpenAIPromptCacheMode(""), "observe");
});

test("shouldOptimizeOpenAIPrefix honors off mode and global switch", () => {
  assert.equal(shouldOptimizeOpenAIPrefix({ config: { enabled: true, openaiMode: "observe" } }), true);
  assert.equal(shouldOptimizeOpenAIPrefix({ config: { enabled: true, openaiMode: "off" } }), false);
  assert.equal(shouldOptimizeOpenAIPrefix({ config: { enabled: false, openaiMode: "auto" } }), false);
});

test("sortToolsForStablePrefix sorts by name and stabilizes key order", () => {
  const tools = [
    { name: "write", input_schema: { type: "object", properties: { b: {}, a: {} } } },
    { name: "edit", input_schema: { type: "object" } },
  ];
  const sorted = sortToolsForStablePrefix(tools, { config: { sortTools: true } });
  assert.deepEqual(sorted.map((t) => t.name), ["edit", "write"]);
  // key 顺序稳定化：JSON 序列化结果一致
  const again = sortToolsForStablePrefix(
    [
      { input_schema: { properties: { a: {}, b: {} }, type: "object" }, name: "write" },
      { name: "edit", input_schema: { type: "object" } },
    ],
    { config: { sortTools: true } }
  );
  assert.equal(JSON.stringify(sorted), JSON.stringify(again));
  // 原数组不被修改
  assert.equal(tools[0].name, "write");
});

test("prepareToolsForPromptCache respects disabled config and off mode", () => {
  const tools = [{ name: "b" }, { name: "a" }];
  const off = prepareToolsForPromptCache(tools, "openai", {
    config: { enabled: true, openaiMode: "off", sortTools: true },
  });
  assert.deepEqual(off.map((t) => t.name), ["b", "a"]);
  const disabled = prepareToolsForPromptCache(tools, "anthropic", {
    config: { enabled: false, sortTools: true },
  });
  assert.deepEqual(disabled.map((t) => t.name), ["b", "a"]);
  const sorted = prepareToolsForPromptCache(tools, "openai", {
    config: { enabled: true, openaiMode: "observe", sortTools: true },
  });
  assert.deepEqual(sorted.map((t) => t.name), ["a", "b"]);
});

test("applyAnthropicPromptCache marks system, last tool, and message prefix breakpoint", () => {
  const body = {
    model: "claude-test",
    system: "You are helpful.",
    tools: [{ name: "a" }, { name: "b" }],
    messages: [
      { role: "user", content: "m1" },
      { role: "assistant", content: [{ type: "text", text: "m2" }] },
      { role: "user", content: "m3" },
      { role: "user", content: "m4" },
    ],
  };
  const next = applyAnthropicPromptCache(body, {
    enabled: true,
    anthropic: true,
    tailMessages: 2,
  });
  // system 字符串 → 文本块数组并带 cache_control
  assert.equal(Array.isArray(next.system), true);
  assert.deepEqual(next.system[0].cache_control, { type: "ephemeral" });
  // 仅最后一个 tool 打 cache_control
  assert.equal(next.tools[0].cache_control, undefined);
  assert.deepEqual(next.tools[1].cache_control, { type: "ephemeral" });
  // 断点位于 len - tail - 1 = index 1
  const marked = next.messages[1].content.at(-1);
  assert.deepEqual(marked.cache_control, { type: "ephemeral" });
  assert.equal(JSON.stringify(next.messages[0]).includes("cache_control"), false);
  assert.equal(JSON.stringify(next.messages[2]).includes("cache_control"), false);
  // 原 body 不被修改
  assert.equal(typeof body.system, "string");
  assert.equal(JSON.stringify(body).includes("cache_control"), false);
});

test("applyAnthropicPromptCache shifts breakpoint before volatile tail messages", () => {
  const body = {
    system: "s",
    messages: [
      { role: "user", content: "m1" },
      { role: "user", content: "m2" },
      { role: "user", content: "m3" },
      { role: "user", content: "injected" },
    ],
  };
  const next = applyAnthropicPromptCache(body, {
    enabled: true,
    anthropic: true,
    tailMessages: 1,
    additionalTailMessages: 1,
  });
  // effectiveTail = 2 → 断点 index = 4 - 2 - 1 = 1
  assert.equal(JSON.stringify(next.messages[1]).includes("cache_control"), true);
  assert.equal(JSON.stringify(next.messages[3]).includes("cache_control"), false);
});

test("applyAnthropicPromptCache leaves short conversations untouched", () => {
  const body = {
    system: "s",
    messages: [{ role: "user", content: "only" }],
  };
  const next = applyAnthropicPromptCache(body, {
    enabled: true,
    anthropic: true,
    tailMessages: 2,
  });
  assert.equal(JSON.stringify(next.messages).includes("cache_control"), false);
});

test("applyAnthropicPromptCache no-ops when disabled", () => {
  const body = { system: "s", messages: [{ role: "user", content: "m" }] };
  const next = applyAnthropicPromptCache(body, { enabled: false });
  assert.equal(next, body);
});

test("shouldRetryWithoutPromptCache detects cache_control rejections only", () => {
  assert.equal(
    shouldRetryWithoutPromptCache(400, '{"error":"Unknown field: cache_control"}'),
    true
  );
  assert.equal(shouldRetryWithoutPromptCache(400, "prompt caching is not supported"), true);
  assert.equal(shouldRetryWithoutPromptCache(400, "invalid model"), false);
  assert.equal(shouldRetryWithoutPromptCache(429, "cache_control rate limited"), false);
  assert.equal(shouldRetryWithoutPromptCache(200, "cache_control"), false);
});
