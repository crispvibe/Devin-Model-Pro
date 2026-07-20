import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeCacheHitRate,
  extractAnthropicUsage,
  extractChatCompletionsUsage,
  extractOpenAIResponsesUsage,
  formatUsageLog,
  mergeUsage,
} from "../../src/proxy/handlers/usage-log.js";
import { toInjectedTailMessage } from "../../src/proxy/handlers/chat.js";

// 移植自上游 v2.3.0 的用量统计单测：usage 合并、命中率、日志格式与各 provider 提取。

test("mergeUsage accumulates known fields and ignores null patch values", () => {
  const base = mergeUsage({ input_tokens: 100, output_tokens: 5 });
  const next = mergeUsage(base, {
    output_tokens: 42,
    cache_read_input_tokens: 90,
    bogus_field: 999,
    input_tokens: null,
  });
  assert.equal(next.input_tokens, 100);
  assert.equal(next.output_tokens, 42);
  assert.equal(next.cache_read_input_tokens, 90);
  assert.equal("bogus_field" in next, false);
});

test("computeCacheHitRate caps at 100 and handles zero input", () => {
  assert.equal(computeCacheHitRate({ input_tokens: 200, cache_read_input_tokens: 100 }), 50);
  assert.equal(computeCacheHitRate({ input_tokens: 100, cached_tokens: 150 }), 100);
  assert.equal(computeCacheHitRate({ input_tokens: 0, cache_read_input_tokens: 10 }), 0);
  assert.equal(computeCacheHitRate({}), 0);
});

test("formatUsageLog includes provider, cache stats and meta fields", () => {
  const line = formatUsageLog(
    { input_tokens: 1000, output_tokens: 50, cache_read_input_tokens: 800 },
    "Anthropic",
    { mode: "messages", route: "/v1/messages", cacheStatus: "hit", requestBytes: 2048 }
  );
  assert.match(line, /^📊 Anthropic tokens: input=1000 output=50/);
  assert.match(line, /cached=800/);
  assert.match(line, /hit=80%/);
  assert.match(line, /mode=messages/);
  assert.match(line, /route=\/v1\/messages/);
  assert.match(line, /cache=hit/);
  assert.match(line, /req=2048b/);
});

test("formatUsageLog omits hit rate when nothing cached", () => {
  const line = formatUsageLog({ input_tokens: 10, output_tokens: 5 }, "OpenAI", {});
  assert.match(line, /cached=0/);
  assert.equal(line.includes("hit="), false);
});

test("extractAnthropicUsage reads message_start and message_delta shapes", () => {
  const start = extractAnthropicUsage({
    data: {
      message: {
        usage: { input_tokens: 12, cache_creation_input_tokens: 4, cache_read_input_tokens: 8 },
      },
    },
  });
  assert.equal(start.input_tokens, 12);
  assert.equal(start.cache_creation_input_tokens, 4);
  assert.equal(start.cache_read_input_tokens, 8);
  const delta = extractAnthropicUsage({ data: { usage: { output_tokens: 33 } } });
  assert.equal(delta.output_tokens, 33);
  assert.equal(extractAnthropicUsage({ data: {} }), null);
});

test("merging message_delta usage keeps input tokens from message_start (regression)", () => {
  let usage = null;
  usage = mergeUsage(
    usage,
    extractAnthropicUsage({
      data: { message: { usage: { input_tokens: 120, cache_read_input_tokens: 80 } } },
    })
  );
  usage = mergeUsage(usage, extractAnthropicUsage({ data: { usage: { output_tokens: 7 } } }));
  assert.equal(usage.input_tokens, 120);
  assert.equal(usage.cache_read_input_tokens, 80);
  assert.equal(usage.output_tokens, 7);
});

test("extractOpenAIResponsesUsage reads response.usage with cached details", () => {
  const usage = extractOpenAIResponsesUsage({
    data: {
      response: {
        usage: {
          input_tokens: 900,
          output_tokens: 40,
          input_tokens_details: { cached_tokens: 700 },
        },
      },
    },
  });
  assert.equal(usage.input_tokens, 900);
  assert.equal(usage.output_tokens, 40);
  assert.equal(usage.cached_tokens, 700);
  assert.equal(extractOpenAIResponsesUsage({ data: {} }), null);
});

test("extractChatCompletionsUsage reads prompt/completion tokens with cached details", () => {
  const usage = extractChatCompletionsUsage({
    usage: {
      prompt_tokens: 500,
      completion_tokens: 25,
      prompt_tokens_details: { cached_tokens: 320 },
    },
  });
  assert.equal(usage.input_tokens, 500);
  assert.equal(usage.output_tokens, 25);
  assert.equal(usage.cached_tokens, 320);
  assert.equal(extractChatCompletionsUsage({}), null);
});

test("toInjectedTailMessage marks runtime-injected messages as volatile tail", () => {
  const message = toInjectedTailMessage({ role: "user", content: "hi" });
  assert.equal(message._volatileTail, true);
  assert.equal(message.role, "user");
  assert.equal(message.content, "hi");
});
