import { writeStringField, writeVarintField, writeMessageField, writeFixed64Field, writeBytesField } from "../proto.js";
// 完整 chunk 格式开关：true=附加 field 7/12/17 + metadata/stats chunk（对齐真实 Devin）
// false=HEAD 简单格式（仅基础字段，兼容性好）
// 默认 false，因完整格式会导致客户端断流；设 BYOK_FULL_CHUNKS=true 启用完整格式调试
const FULL_CHUNKS = process.env.BYOK_FULL_CHUNKS === "true" || process.env.BYOK_FULL_CHUNKS === "1";
export const STOP_REASON = {
  UNSPECIFIED: 0,
  INCOMPLETE: 1,
  STOP_PATTERN: 2,
  MAX_TOKENS: 3,
  FUNCTION_CALL: 10,
  ERROR: 13
};
function buildTimestamp() {
  const tmp0 = Date.now();
  const tmp1 = Math.floor(tmp0 / 1000);
  const tmp2 = tmp0 % 1000 * 1000000;
  return Buffer.concat([writeVarintField(1, tmp1), writeVarintField(2, tmp2)]);
}
function writeDoubleField(arg0, arg1) {
  const tmp2 = Buffer.alloc(8);
  tmp2.writeDoubleBE(arg1, 0);
  tmp2.swap64();
  return writeFixed64Field(arg0, tmp2);
}
// field 12: little-endian double, 相对请求开始的累计秒数（真实 Devin 响应每帧都有）
function buildElapsedField(ctx) {
  if (!ctx || !ctx.startTime) {
    return null;
  }
  const tmp0 = (Date.now() - ctx.startTime) / 1000;
  const tmp1 = Buffer.alloc(8);
  tmp1.writeDoubleLE(tmp0, 0);
  return writeFixed64Field(12, tmp1);
}
// field 7: metadata message { f6=30, [f8={x-request-id, chatcmpl-id}], [f9=agentType] }
// isLast=true 时附加 f2/f3/f5 token 统计
// includeRequestId=true 时附加 f8（仅首尾 metadata chunk）
// skipF9=true 时不在 field 7 内部写 f9（metadata chunk 把 f9 放顶层）
function buildMetadataField(ctx, isLast, includeRequestId, skipF9) {
  if (!ctx) {
    return null;
  }
  const tmp0 = [];
  if (isLast && ctx.usage) {
    if (ctx.usage.input_tokens != null) {
      tmp0.push(writeVarintField(2, ctx.usage.input_tokens));
    }
    if (ctx.usage.output_tokens != null) {
      tmp0.push(writeVarintField(3, ctx.usage.output_tokens));
    }
    if (ctx.usage.cached_tokens != null) {
      tmp0.push(writeVarintField(5, ctx.usage.cached_tokens));
    }
  }
  tmp0.push(writeVarintField(6, 30));
  if (includeRequestId && ctx.chatcmplId) {
    const tmp1 = Buffer.concat([writeStringField(1, "x-request-id"), writeStringField(2, ctx.chatcmplId)]);
    tmp0.push(writeBytesField(8, tmp1));
  }
  if (!skipF9 && ctx.agentType) {
    tmp0.push(writeStringField(9, ctx.agentType));
  }
  return writeBytesField(7, Buffer.concat(tmp0));
}
// field 17: session uuid（messageId 去掉 bot- 前缀）
function buildSessionField(ctx) {
  if (!ctx || !ctx.sessionUuid) {
    return null;
  }
  return writeStringField(17, ctx.sessionUuid);
}
// 给所有 chunk 附加 ctx 相关字段（field 7/9/12/17）
// isMetadataChunk=true 时 field 7 不含 f9，顶层加 f9=agentType（对齐真实 Devin metadata chunk）
function appendCtxFields(parts, ctx, isLastMetadata, includeRequestId, isMetadataChunk) {
  const tmp0 = buildMetadataField(ctx, isLastMetadata, includeRequestId, isMetadataChunk);
  if (tmp0) {
    parts.push(tmp0);
  }
  if (isMetadataChunk && ctx.agentType) {
    parts.push(writeStringField(9, ctx.agentType));
  }
  const tmp1 = buildElapsedField(ctx);
  if (tmp1) {
    parts.push(tmp1);
  }
  const tmp2 = buildSessionField(ctx);
  if (tmp2) {
    parts.push(tmp2);
  }
}
export function buildTextDelta(arg0, arg1, arg2, ctx) {
  const tmp3 = [writeStringField(1, arg0), writeMessageField(2, buildTimestamp())];
  if (arg1) {
    tmp3.push(writeStringField(3, arg1));
  }
  if (arg2 > 0) {
    tmp3.push(writeVarintField(4, arg2));
  }
  appendCtxFields(tmp3, ctx, false, false);
  return Buffer.concat(tmp3);
}
export function buildThinkingDelta(arg0, arg1, ctx) {
  const tmp2 = [writeStringField(1, arg0), writeMessageField(2, buildTimestamp()), writeStringField(9, arg1)];
  appendCtxFields(tmp2, ctx, false, false);
  return Buffer.concat(tmp2);
}
export function buildToolCallDelta(arg0, arg1, ctx) {
  const tmp2 = [writeStringField(1, arg0), writeMessageField(2, buildTimestamp())];
  for (const tmp0 of arg1) {
    const tmp02 = Buffer.concat([writeStringField(1, tmp0.id ?? ""), writeStringField(2, tmp0.name ?? ""), writeStringField(3, tmp0.arguments_json ?? "")]);
    tmp2.push(writeMessageField(6, tmp02));
  }
  appendCtxFields(tmp2, ctx, false, false);
  return Buffer.concat(tmp2);
}
export function buildStopChunk(arg0, arg1, arg2, ctx) {
  const tmp4 = [writeStringField(1, arg0), writeMessageField(2, buildTimestamp()), writeVarintField(5, arg1)];
  if (arg2) {
    tmp4.push(writeStringField(20, arg2));
  }
  // stop chunk 的 metadata 带 token 统计（isLast=true）和 request-id（includeRequestId=true）
  appendCtxFields(tmp4, ctx, true, true);
  return Buffer.concat(tmp4);
}
export function buildSignatureDelta(arg0, arg1, ctx) {
  const tmp2 = [writeStringField(1, arg0), writeMessageField(2, buildTimestamp()), writeStringField(10, arg1)];
  appendCtxFields(tmp2, ctx, false, false);
  return Buffer.concat(tmp2);
}
export function buildErrorChunk(arg0, arg1, ctx) {
  const tmp2 = [writeStringField(1, arg0), writeMessageField(2, buildTimestamp()), writeStringField(3, arg1), writeVarintField(5, STOP_REASON.ERROR)];
  appendCtxFields(tmp2, ctx, false, false);
  return Buffer.concat(tmp2);
}
// 开头 metadata chunk：f1/f2/f7(含 f6/f8/f9)/f12/f17，无内容 delta
// 真实 Devin 响应首帧就是 metadata chunk（抓包验证：顶层无 field 9，agentType 在 field 7 内部 f9）
export function buildMetadataChunk(ctx) {
  if (!ctx) {
    return null;
  }
  const tmp0 = [writeStringField(1, ctx.messageId), writeMessageField(2, buildTimestamp())];
  appendCtxFields(tmp0, ctx, false, true, false);
  return Buffer.concat(tmp0);
}
// 结尾统计 chunk：f1={f12="t-<uuid>"} / f2 / f28 x2（Response Statistics + Token Usage）
// 受 FULL_CHUNKS 控制，默认不发（非必需）
export function buildStatsChunk(ctx) {
  if (!FULL_CHUNKS || !ctx) {
    return null;
  }
  const tmp0 = [];
  // f1 = message { f12 = "t-<sessionUuid>" }
  const tmp1 = writeStringField(12, "t-" + ctx.sessionUuid);
  tmp0.push(writeBytesField(1, tmp1));
  tmp0.push(writeMessageField(2, buildTimestamp()));
  // f28: Response Statistics
  if (ctx.statsEntries && ctx.statsEntries.length > 0) {
    for (const tmp2 of ctx.statsEntries) {
      tmp0.push(writeBytesField(28, tmp2));
    }
  }
  return Buffer.concat(tmp0);
}
// 创建 per-request chunk context
export function createChunkContext(options) {
  const tmp0 = options || {};
  const tmp1 = tmp0.messageId || "";
  // sessionUuid = messageId 去掉 "bot-" 前缀
  const tmp2 = tmp0.sessionUuid || (tmp1.startsWith("bot-") ? tmp1.slice(4) : tmp1);
  return {
    messageId: tmp1,
    sessionUuid: tmp2,
    modelUid: tmp0.modelUid || "",
    agentType: tmp0.agentType || "",
    chatcmplId: tmp0.chatcmplId || "",
    startTime: tmp0.startTime || Date.now(),
    usage: tmp0.usage || null,
    statsEntries: tmp0.statsEntries || null
  };
}
