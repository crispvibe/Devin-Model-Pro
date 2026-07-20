/**
 * BYOK 手动协议（BYOKn_PROTOCOL）相关逻辑单元测试
 * 覆盖：
 *   - profileStore.sanitizeProtocol / detectModelProtocol / resolveEffectiveProtocol
 *   - profileStore.listProfiles 的 byok*Protocol/Manual/ThinkingEffort 字段
 *   - profileStore.projectToEnvConfig 的 BYOK*_PROTOCOL 输出
 *   - thinkingEffort.protocolToThinkingProvider
 *   - thinkingEffort.buildThinkingEffortOptionsHtmlForProvider
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';

let counter = 0;
function setupDir() {
  const dir = path.join(os.tmpdir(), 'devin-byok-proto-' + Date.now() + '-' + counter++);
  process.env.DEVIN_BYOK_CONFIG_DIR = dir;
  return dir;
}
function cleanupDir(dir) {
  delete process.env.DEVIN_BYOK_CONFIG_DIR;
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}
async function importStore() {
  const bust = '?t=' + Date.now() + Math.random();
  return import('../../src/services/profileStore.js' + bust);
}

// ==================== sanitizeProtocol ====================

test('sanitizeProtocol 白名单严格', async () => {
  const store = await importStore();
  const { sanitizeProtocol } = store;
  assert.equal(sanitizeProtocol(''), '');
  assert.equal(sanitizeProtocol(null), '');
  assert.equal(sanitizeProtocol(undefined), '');
  assert.equal(sanitizeProtocol('anthropic'), 'anthropic');
  assert.equal(sanitizeProtocol('openai'), 'openai');
  assert.equal(sanitizeProtocol('gemini'), 'gemini');
});

test('sanitizeProtocol 忽略大小写与首尾空格', async () => {
  const { sanitizeProtocol } = await importStore();
  assert.equal(sanitizeProtocol('  Anthropic  '), 'anthropic');
  assert.equal(sanitizeProtocol('OPENAI'), 'openai');
  assert.equal(sanitizeProtocol('Gemini'), 'gemini');
});

test('sanitizeProtocol 拒绝非法值', async () => {
  const { sanitizeProtocol } = await importStore();
  assert.equal(sanitizeProtocol('claude'), '');
  assert.equal(sanitizeProtocol('gpt'), '');
  assert.equal(sanitizeProtocol('vertex'), '');
  assert.equal(sanitizeProtocol('anthropicX'), '');
  assert.equal(sanitizeProtocol({}), '');
  assert.equal(sanitizeProtocol([]), '');
});

// ==================== detectModelProtocol ====================

test('detectModelProtocol 按模型名前缀识别', async () => {
  const { detectModelProtocol } = await importStore();
  assert.equal(detectModelProtocol('claude-opus-4-20250514'), 'anthropic');
  assert.equal(detectModelProtocol('model_claude_4_opus'), 'anthropic');
  assert.equal(detectModelProtocol('gpt-4o-mini'), 'openai');
  assert.equal(detectModelProtocol('o3-mini'), 'openai');
  assert.equal(detectModelProtocol('chatgpt-4o'), 'openai');
  assert.equal(detectModelProtocol('gemini-1.5-pro'), 'gemini');
  assert.equal(detectModelProtocol('models/gemini-2.0-flash'), 'gemini');
  assert.equal(detectModelProtocol('model_google_gemini_pro'), 'gemini');
});

test('detectModelProtocol 空/未知返回 ""', async () => {
  const { detectModelProtocol } = await importStore();
  assert.equal(detectModelProtocol(''), '');
  assert.equal(detectModelProtocol(null), '');
  assert.equal(detectModelProtocol('some-random-model'), '');
});

test('detectModelProtocol 去掉 -thinking 后缀', async () => {
  const { detectModelProtocol } = await importStore();
  assert.equal(detectModelProtocol('claude-opus-4-20250514-thinking'), 'anthropic');
  assert.equal(detectModelProtocol('gemini-1.5-pro-thinking'), 'gemini');
});

// ==================== resolveEffectiveProtocol ====================

test('resolveEffectiveProtocol 手动协议覆盖模型识别', async () => {
  const { resolveEffectiveProtocol } = await importStore();
  assert.equal(
    resolveEffectiveProtocol({ protocol: 'gemini', model: 'claude-opus-4-20250514' }),
    'gemini'
  );
  assert.equal(
    resolveEffectiveProtocol({ protocol: 'openai', model: 'claude-opus-4-20250514' }),
    'openai'
  );
});

test('resolveEffectiveProtocol 手动为空时按模型名后备', async () => {
  const { resolveEffectiveProtocol } = await importStore();
  assert.equal(resolveEffectiveProtocol({ protocol: '', model: 'gpt-4o' }), 'openai');
  assert.equal(resolveEffectiveProtocol({ protocol: '', model: 'gemini-1.5-pro' }), 'gemini');
  assert.equal(resolveEffectiveProtocol({ protocol: '', model: 'claude-3-5-sonnet' }), 'anthropic');
});

test('resolveEffectiveProtocol 两者都空返回 ""', async () => {
  const { resolveEffectiveProtocol } = await importStore();
  assert.equal(resolveEffectiveProtocol({ protocol: '', model: '' }), '');
  assert.equal(resolveEffectiveProtocol(null), '');
});

test('resolveEffectiveProtocol 非法手动值回退到自动检测', async () => {
  const { resolveEffectiveProtocol } = await importStore();
  assert.equal(
    resolveEffectiveProtocol({ protocol: 'invalid', model: 'gpt-4o' }),
    'openai'
  );
});

// ==================== listProfiles projection ====================

test('listProfiles 输出 byokNProtocol / ProtocolManual / ThinkingEffort（四槽位）', async () => {
  const dir = setupDir();
  const store = await importStore();
  try {
    const env = {
      BYOK1_ANTHROPIC_API_KEY: 'k1',
      BYOK1_MODEL: 'claude-opus-4-20250514',
      BYOK1_PROTOCOL: '',
      BYOK1_THINKING_EFFORT: 'medium',
      BYOK2_ANTHROPIC_API_KEY: 'k2',
      BYOK2_MODEL: 'gpt-4o',
      BYOK2_PROTOCOL: 'gemini',
      BYOK2_THINKING_EFFORT: 'high',
      BYOK3_ANTHROPIC_API_KEY: '',
      BYOK4_ANTHROPIC_API_KEY: '',
    };
    store.ensureProfilesExist(env);
    const list = store.listProfiles(env);
    const p = list.profiles[0];
    // #1 无手动 -> 按模型识别为 anthropic
    assert.equal(p.byok1Protocol, 'anthropic');
    assert.equal(p.byok1ProtocolManual, '');
    assert.equal(p.byok1ThinkingEffort, 'medium');
    // #2 手动 gemini 覆盖了 gpt 模型识别
    assert.equal(p.byok2Protocol, 'gemini');
    assert.equal(p.byok2ProtocolManual, 'gemini');
    assert.equal(p.byok2ThinkingEffort, 'high');
    // #3/#4 应存在字段（即使为空）
    assert.ok('byok3Protocol' in p);
    assert.ok('byok4Protocol' in p);
    assert.ok('byok3ProtocolManual' in p);
    assert.ok('byok4ProtocolManual' in p);
  } finally {
    cleanupDir(dir);
  }
});

// ==================== projectToEnvConfig ====================

test('projectToEnvConfig 输出 BYOK1..4_PROTOCOL', async () => {
  const store = await importStore();
  const profile = {
    byok1: { host: '', key: '', model: 'claude-opus-4', thinkingEffort: '', protocol: 'anthropic', anthropicPath: '', openaiPath: '' },
    byok2: { host: '', key: '', model: 'gpt-4o', thinkingEffort: '', protocol: 'openai', anthropicPath: '', openaiPath: '' },
    byok3: { host: '', key: '', model: 'gemini-1.5', thinkingEffort: '', protocol: 'gemini', anthropicPath: '', openaiPath: '' },
    byok4: { host: '', key: '', model: '', thinkingEffort: '', protocol: '', anthropicPath: '', openaiPath: '' },
    advanced: { hybridPort: '3006', inferencePort: '3001', anthropicPath: '/v1/messages', openaiPath: '/v1/responses', maxTokens: '64000', completionTimeout: '12000' },
  };
  const env = store.projectToEnvConfig(profile);
  assert.equal(env.BYOK1_PROTOCOL, 'anthropic');
  assert.equal(env.BYOK2_PROTOCOL, 'openai');
  assert.equal(env.BYOK3_PROTOCOL, 'gemini');
  assert.equal(env.BYOK4_PROTOCOL, '');
});

test('projectToEnvConfig 非法协议在 normalize 中被清空', async () => {
  const store = await importStore();
  const profile = {
    byok1: { host: '', key: '', model: '', thinkingEffort: '', protocol: 'bogus', anthropicPath: '', openaiPath: '' },
    byok2: { host: '', key: '', model: '', thinkingEffort: '', protocol: 'CLAUDE', anthropicPath: '', openaiPath: '' },
    byok3: { host: '', key: '', model: '', thinkingEffort: '', protocol: '', anthropicPath: '', openaiPath: '' },
    byok4: { host: '', key: '', model: '', thinkingEffort: '', protocol: '', anthropicPath: '', openaiPath: '' },
    advanced: {},
  };
  const env = store.projectToEnvConfig(profile);
  assert.equal(env.BYOK1_PROTOCOL, '');
  assert.equal(env.BYOK2_PROTOCOL, '');
});

// ==================== 老 profiles.json 向后兼容 ====================

test('normalizeSlot 对缺失 protocol 字段的老 profile 添加空 protocol（读盘迁移）', async () => {
  const dir = setupDir();
  try {
    // 直接写入老格式 profiles.json（byok1 无 protocol 字段）
    const legacyProfile = {
      version: 1,
      activeId: 'legacy-1',
      profiles: [
        {
          id: 'legacy-1',
          name: '老方案',
          byok1: { host: 'a', key: 'k', model: 'claude-opus-4', thinkingEffort: '', anthropicPath: '', openaiPath: '' },
          byok2: { host: '', key: '', model: '', thinkingEffort: '', anthropicPath: '', openaiPath: '' },
          byok3: { host: '', key: '', model: '', thinkingEffort: '', anthropicPath: '', openaiPath: '' },
          byok4: { host: '', key: '', model: '', thinkingEffort: '', anthropicPath: '', openaiPath: '' },
          advanced: {},
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    };
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'profiles.json'), JSON.stringify(legacyProfile), 'utf-8');

    const store = await importStore();
    const profile = store.getProfileById('legacy-1', {});
    assert.equal(profile.byok1.protocol, '');
    assert.equal(profile.byok2.protocol, '');
    assert.equal(profile.byok3.protocol, '');
    assert.equal(profile.byok4.protocol, '');
    // listProfiles 也能计算出 effective
    const list = store.listProfiles({});
    assert.equal(list.profiles[0].byok1Protocol, 'anthropic');
    assert.equal(list.profiles[0].byok1ProtocolManual, '');
  } finally {
    cleanupDir(dir);
  }
});

// ==================== thinkingEffort 协议桥接 ====================

test('protocolToThinkingProvider 三向映射', async () => {
  const { default: te } = await import('../../src/services/thinkingEffort.js?t=' + Date.now());
  assert.equal(te.protocolToThinkingProvider('anthropic'), 'claude');
  assert.equal(te.protocolToThinkingProvider('openai'), 'gpt');
  assert.equal(te.protocolToThinkingProvider('gemini'), 'gemini');
  assert.equal(te.protocolToThinkingProvider(''), null);
  assert.equal(te.protocolToThinkingProvider('invalid'), null);
});

test('buildThinkingEffortOptionsHtmlForProvider 返回带 selected 的 HTML', async () => {
  const { default: te } = await import('../../src/services/thinkingEffort.js?t=' + Date.now() + Math.random());
  const claudeHtml = te.buildThinkingEffortOptionsHtmlForProvider('claude', 'medium');
  assert.match(claudeHtml, /value="medium" selected/);
  assert.match(claudeHtml, /value="max"/); // claude 独有的 max
  const gptHtml = te.buildThinkingEffortOptionsHtmlForProvider('gpt', 'xhigh');
  assert.match(gptHtml, /value="xhigh" selected/);
  assert.doesNotMatch(gptHtml, /value="max"/); // gpt 没有 max
  const geminiHtml = te.buildThinkingEffortOptionsHtmlForProvider('gemini', 'minimal');
  assert.match(geminiHtml, /value="minimal" selected/);
});

test('buildThinkingEffortOptionsHtmlForProvider 未指定 provider 返回占位', async () => {
  const { default: te } = await import('../../src/services/thinkingEffort.js?t=' + Date.now() + Math.random());
  const html = te.buildThinkingEffortOptionsHtmlForProvider(null, '');
  assert.match(html, /请先选择模型/);
});

// ==================== byok-slots 模块的 sanitizeSlotProtocol（ESM） ====================

test('sanitizeSlotProtocol（proxy 侧）与 profileStore.sanitizeProtocol 语义一致', async () => {
  const bs = await import('../../src/proxy/handlers/byok-slots.js?t=' + Date.now() + Math.random());
  assert.equal(bs.sanitizeSlotProtocol('anthropic'), 'anthropic');
  assert.equal(bs.sanitizeSlotProtocol('OpenAI'), 'openai');
  assert.equal(bs.sanitizeSlotProtocol('  Gemini  '), 'gemini');
  assert.equal(bs.sanitizeSlotProtocol('bogus'), '');
  assert.equal(bs.sanitizeSlotProtocol(null), '');
  assert.deepEqual(bs.SLOT_CONFIG_FIELDS.includes('PROTOCOL'), true);
});
