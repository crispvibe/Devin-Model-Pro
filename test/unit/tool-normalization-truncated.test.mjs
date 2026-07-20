import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeToolInvocation } from "../../src/proxy/handlers/tool-normalization.js";

// 复现崩溃：流式 tool_use 的 arguments 为被截断的非法 JSON 字符串，
// normalizeToolArguments 原样返回字符串，随后 remapKey 在字符串上写属性 → TypeError，整个代理进程退出。

test("normalizeToolInvocation does not throw on truncated JSON arguments", () => {
  const truncated = '{"file_path": "/Users/x/demo.tsx", "old_string": "// END\\n';
  let result;
  assert.doesNotThrow(() => {
    result = normalizeToolInvocation("edit", truncated);
  });
  // 工具名应被正常归一化
  assert.equal(result.toolName, "edit");
  // 无法解析的参数原样保留为字符串，不做键重映射
  assert.equal(typeof result.params, "string");
  assert.equal(result.params, truncated);
});

test("normalizeToolInvocation handles plain non-JSON string arguments", () => {
  let result;
  assert.doesNotThrow(() => {
    result = normalizeToolInvocation("read_file", "not json at all");
  });
  assert.equal(result.toolName, "read_file");
  assert.equal(result.params, "not json at all");
});

test("normalizeToolInvocation still remaps keys for valid JSON object arguments", () => {
  const valid = '{"path": "/Users/x/demo.tsx", "search": "a", "replace": "b"}';
  const result = normalizeToolInvocation("edit", valid);
  assert.equal(result.toolName, "edit");
  // path→file_path, search→old_string, replace→new_string
  assert.equal(result.params.file_path, "/Users/x/demo.tsx");
  assert.equal(result.params.old_string, "a");
  assert.equal(result.params.new_string, "b");
  assert.equal(result.params.path, undefined);
});

test("normalizeToolInvocation handles array arguments without throwing", () => {
  let result;
  assert.doesNotThrow(() => {
    result = normalizeToolInvocation("edit", "[1,2,3]");
  });
  assert.equal(result.toolName, "edit");
  assert.ok(Array.isArray(result.params));
});

test("normalizeToolInvocation handles null/undefined arguments", () => {
  const a = normalizeToolInvocation("read_file", null);
  assert.deepEqual(a.params, {});
  const b = normalizeToolInvocation("read_file", undefined);
  assert.deepEqual(b.params, {});
});
