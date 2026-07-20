import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureNamedToolChoiceTool } from "../../src/proxy/handlers/chat.js";

// 当 tool_choice 强制调用某命名工具但其定义缺失时，应补齐占位定义并允许转发 tool_choice，
// 而不是丢弃 tool_choice（旧行为会退回 auto，可能导致收尾工具 finish 不被调用）。

test("synthesizes missing named tool_choice target and allows forwarding", () => {
  const r = ensureNamedToolChoiceTool([{ name: "edit" }], { type: "tool", name: "finish" });
  assert.equal(r.allowToolChoice, true);
  assert.deepEqual(r.tools.map(t => t.name), ["edit", "finish"]);
  const finish = r.tools.find(t => t.name === "finish");
  assert.equal(finish.input_schema.type, "object");
});

test("does not duplicate when named tool already present", () => {
  const r = ensureNamedToolChoiceTool([{ name: "finish" }], { type: "tool", name: "finish" });
  assert.equal(r.allowToolChoice, true);
  assert.equal(r.tools.length, 1);
});

test("ignores non-named tool_choice (auto/any)", () => {
  const auto = ensureNamedToolChoiceTool([{ name: "edit" }], { type: "auto" });
  assert.equal(auto.allowToolChoice, false);
  assert.equal(auto.tools.length, 1);

  const any = ensureNamedToolChoiceTool([{ name: "edit" }], { type: "any" });
  assert.equal(any.allowToolChoice, false);
});

test("handles undefined/empty tools list", () => {
  const r = ensureNamedToolChoiceTool(undefined, { type: "tool", name: "finish" });
  assert.equal(r.allowToolChoice, true);
  assert.deepEqual(r.tools.map(t => t.name), ["finish"]);
});

test("handles undefined tool_choice", () => {
  const r = ensureNamedToolChoiceTool([{ name: "edit" }], undefined);
  assert.equal(r.allowToolChoice, false);
  assert.equal(r.tools.length, 1);
});
