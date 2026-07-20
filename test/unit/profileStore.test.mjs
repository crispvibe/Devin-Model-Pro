import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';

const PROFILES_FILE = 'profiles.json';

let testCounter = 0;

function setupTestEnv() {
  const testDir = path.join(os.tmpdir(), 'devin-byok-test-' + Date.now() + '-' + testCounter++);
  process.env.DEVIN_BYOK_CONFIG_DIR = testDir;
  return testDir;
}

function cleanTestEnv(testDir) {
  delete process.env.DEVIN_BYOK_CONFIG_DIR;
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

async function importFresh() {
  const cacheBuster = '?t=' + Date.now() + Math.random();
  return import('../../src/services/profileStore.js' + cacheBuster);
}

test('createDefaultProfile generates valid profile structure', async () => {
  const store = await importFresh();
  const profile = store.createDefaultProfile({
    BYOK1_ANTHROPIC_API_HOST: 'api.example.com',
    BYOK1_ANTHROPIC_API_KEY: 'test-key',
    BYOK1_MODEL: 'claude-opus-4-20250514',
  });

  assert.ok(profile.id);
  assert.equal(profile.name, '方案 1');
  assert.equal(profile.byok1.host, 'api.example.com');
  assert.equal(profile.byok1.key, 'test-key');
  assert.equal(profile.byok1.model, 'claude-opus-4-20250514');
  assert.ok(profile.createdAt);
  assert.ok(profile.updatedAt);
});

test('ensureProfilesExist migrates .env to profiles.json on first load', async () => {
  const testDir = setupTestEnv();
  const store = await importFresh();

  try {
    const mockEnv = {
      BYOK1_ANTHROPIC_API_KEY: 'key1',
      BYOK1_MODEL: 'claude-opus-4-20250514',
      BYOK2_ANTHROPIC_API_KEY: 'key2',
      BYOK2_MODEL: 'claude-opus-4-thinking-20250514',
    };

    const data = store.ensureProfilesExist(mockEnv);

    assert.equal(data.version, 1);
    assert.equal(data.profiles.length, 1);
    assert.equal(data.profiles[0].name, '方案 1');
    assert.equal(data.profiles[0].byok1.key, 'key1');
    assert.equal(data.activeId, data.profiles[0].id);

    const filePath = path.join(testDir, PROFILES_FILE);
    assert.ok(fs.existsSync(filePath));

    const stat = fs.statSync(filePath);
    assert.equal((stat.mode & 0o777).toString(8), '600');
  } finally {
    cleanTestEnv(testDir);
  }
});

test('listProfiles returns profile summaries with correct flags', async () => {
  const testDir = setupTestEnv();
  const store = await importFresh();

  try {
    const mockEnv = {
      BYOK1_ANTHROPIC_API_KEY: 'key1',
      BYOK1_MODEL: 'claude-opus-4-20250514',
      BYOK2_ANTHROPIC_API_KEY: 'key2',
      BYOK2_MODEL: 'claude-opus-4-thinking-20250514',
    };

    store.ensureProfilesExist(mockEnv);
    const list = store.listProfiles(mockEnv);

    assert.ok(Array.isArray(list.profiles));
    assert.equal(list.profiles.length, 1);
    assert.ok(list.activeId);
    assert.equal(list.profiles[0].isActive, true);
    assert.equal(list.profiles[0].byok1Configured, true);
    assert.equal(list.profiles[0].byok2Configured, true);
  } finally {
    cleanTestEnv(testDir);
  }
});

test('createProfile adds new profile to list', async () => {
  const testDir = setupTestEnv();
  const store = await importFresh();

  try {
    const mockEnv = {};

    store.ensureProfilesExist(mockEnv);
    const created = store.createProfile('测试方案', mockEnv);

    assert.ok(created.id);
    assert.equal(created.name, '测试方案');

    const list = store.listProfiles(mockEnv);
    assert.equal(list.profiles.length, 2);
  } finally {
    cleanTestEnv(testDir);
  }
});

test('updateProfile modifies profile fields and timestamp', async () => {
  const testDir = setupTestEnv();
  const store = await importFresh();

  try {
    const mockEnv = {};

    const data = store.ensureProfilesExist(mockEnv);
    const profileId = data.profiles[0].id;
    const oldUpdatedAt = data.profiles[0].updatedAt;

    const updated = store.updateProfile(
      profileId,
      {
        byok1: {
          host: 'new-host.example.com',
          key: 'new-key',
          model: 'new-model',
          thinkingEffort: '',
          anthropicPath: '',
          openaiPath: '',
        },
      },
      mockEnv
    );

    assert.equal(updated.byok1.host, 'new-host.example.com');
    assert.equal(updated.byok1.key, 'new-key');
    assert.ok(updated.updatedAt >= oldUpdatedAt);
  } finally {
    cleanTestEnv(testDir);
  }
});

test('activateProfile switches activeId', async () => {
  const testDir = setupTestEnv();
  const store = await importFresh();

  try {
    const mockEnv = {};

    store.ensureProfilesExist(mockEnv);
    const created = store.createProfile('新方案', mockEnv);
    store.activateProfile(created.id, mockEnv);

    const list = store.listProfiles(mockEnv);
    assert.equal(list.activeId, created.id);
    assert.equal(list.profiles.find((p) => p.id === created.id).isActive, true);
  } finally {
    cleanTestEnv(testDir);
  }
});

test('renameProfile updates profile name', async () => {
  const testDir = setupTestEnv();
  const store = await importFresh();

  try {
    const mockEnv = {};

    const data = store.ensureProfilesExist(mockEnv);
    const profileId = data.profiles[0].id;

    store.renameProfile(profileId, '新名称', mockEnv);

    const profile = store.getProfileById(profileId, mockEnv);
    assert.equal(profile.name, '新名称');
  } finally {
    cleanTestEnv(testDir);
  }
});

test('duplicateProfile creates copy with (副本) suffix', async () => {
  const testDir = setupTestEnv();
  const store = await importFresh();

  try {
    const mockEnv = {};

    const data = store.ensureProfilesExist(mockEnv);
    const profileId = data.profiles[0].id;

    const dup = store.duplicateProfile(profileId, mockEnv);

    assert.ok(dup.id !== profileId);
    assert.equal(dup.name, '方案 1 (副本)');

    const list = store.listProfiles(mockEnv);
    assert.equal(list.profiles.length, 2);
  } finally {
    cleanTestEnv(testDir);
  }
});

test('deleteProfile removes profile and switches activeId if deleted', async () => {
  const testDir = setupTestEnv();
  const store = await importFresh();

  try {
    const mockEnv = {};

    store.ensureProfilesExist(mockEnv);
    const created = store.createProfile('待删除', mockEnv);
    store.activateProfile(created.id, mockEnv);

    const result = store.deleteProfile(created.id, mockEnv);

    assert.equal(result.deletedId, created.id);
    assert.ok(result.newActiveId !== created.id);

    const list = store.listProfiles(mockEnv);
    assert.equal(list.profiles.length, 1);
    assert.equal(list.activeId, result.newActiveId);
  } finally {
    cleanTestEnv(testDir);
  }
});

test('deleteProfile prevents deleting last profile', async () => {
  const testDir = setupTestEnv();
  const store = await importFresh();

  try {
    const mockEnv = {};

    const data = store.ensureProfilesExist(mockEnv);
    const profileId = data.profiles[0].id;

    assert.throws(
      () => {
        store.deleteProfile(profileId, mockEnv);
      },
      /Cannot delete the last profile/
    );
  } finally {
    cleanTestEnv(testDir);
  }
});

test('projectToEnvConfig generates full env key set', async () => {
  const store = await importFresh();
  const profile = {
    byok1: {
      host: 'api1.example.com',
      key: 'key1',
      model: 'model1',
      thinkingEffort: 'medium',
      anthropicPath: '/v1/messages',
      openaiPath: '/v1/responses',
    },
    byok2: {
      host: 'api2.example.com',
      key: 'key2',
      model: 'model2',
      thinkingEffort: 'high',
      anthropicPath: '/v1/messages',
      openaiPath: '/v1/responses',
    },
    advanced: {
      hybridPort: '3006',
      inferencePort: '3001',
      anthropicPath: '/v1/messages',
      openaiPath: '/v1/responses',
      maxTokens: '64000',
      completionTimeout: '12000',
    },
  };

  const env = store.projectToEnvConfig(profile);

  assert.equal(env.BYOK1_ANTHROPIC_API_HOST, 'api1.example.com');
  assert.equal(env.BYOK1_ANTHROPIC_API_KEY, 'key1');
  assert.equal(env.BYOK1_MODEL, 'model1');
  assert.equal(env.BYOK1_THINKING_EFFORT, 'medium');
  assert.equal(env.BYOK2_ANTHROPIC_API_HOST, 'api2.example.com');
  assert.equal(env.BYOK2_ANTHROPIC_API_KEY, 'key2');
  assert.equal(env.BYOK2_MODEL, 'model2');
  assert.equal(env.ANTHROPIC_API_PATH, '/v1/messages');
  assert.equal(env.OPENAI_API_PATH, '/v1/responses');
  assert.equal(env.MAX_TOKENS, '64000');
  assert.equal(env.COMPLETION_TIMEOUT_MS, '12000');
  assert.equal(env.HYBRID_PORT, '3006');
  assert.equal(env.INFERENCE_PORT, '3001');
});
