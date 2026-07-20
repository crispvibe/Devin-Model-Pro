/**
 * 节点+模型树形配置管理
 * 存储路径: ~/.devin-model-pro/config.json
 * 结构: { nodes: [{id,name,host,apiKey,protocol,models:[{id,name,thinkingEffort,serviceTier}]}], activeNodeId, activeModelId, advanced:{...} }
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_FILE = 'config.json';

function ensureUserConfigDir() {
  const dir = path.join(os.homedir(), '.devin-model-pro');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (error) {
      console.error('[NodeConfig] create dir failed:', error.message);
    }
  }
  return dir;
}

function getConfigFilePath() {
  return path.join(ensureUserConfigDir(), CONFIG_FILE);
}

function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function defaultConfig() {
  return {
    nodes: [],
    activeNodeId: '',
    activeModelId: '',
    advanced: {
      hybridPort: '3006',
      inferencePort: '3001',
      anthropicPath: '/v1/messages',
      openaiPath: '/v1/responses',
      maxTokens: '64000',
      completionTimeout: '12000',
      systemPromptPath: '',
      systemPromptOverride: '',
    },
  };
}

let _memoryCache = null;
let _writeLock = false;

function readConfig() {
  if (_memoryCache) return _memoryCache;
  const fp = getConfigFilePath();
  if (!fs.existsSync(fp)) {
    _memoryCache = defaultConfig();
    return _memoryCache;
  }
  try {
    const raw = fs.readFileSync(fp, 'utf-8');
    const parsed = JSON.parse(raw);
    _memoryCache = normalizeConfig(parsed);
    return _memoryCache;
  } catch (e) {
    console.error('[NodeConfig] read failed:', e.message);
    _memoryCache = defaultConfig();
    return _memoryCache;
  }
}

function normalizeConfig(cfg) {
  const base = defaultConfig();
  if (!cfg || typeof cfg !== 'object') return base;
  const nodes = Array.isArray(cfg.nodes) ? cfg.nodes.map(normalizeNode).filter(Boolean) : [];
  return {
    nodes,
    activeNodeId: typeof cfg.activeNodeId === 'string' ? cfg.activeNodeId : '',
    activeModelId: typeof cfg.activeModelId === 'string' ? cfg.activeModelId : '',
    advanced: { ...base.advanced, ...(cfg.advanced || {}) },
  };
}

function normalizeNode(n) {
  if (!n || typeof n !== 'object') return null;
  return {
    id: typeof n.id === 'string' && n.id ? n.id : genId('node'),
    name: typeof n.name === 'string' ? n.name : '',
    host: typeof n.host === 'string' ? n.host : '',
    apiKey: typeof n.apiKey === 'string' ? n.apiKey : '',
    protocol: ['anthropic', 'openai', ''].includes(n.protocol) ? n.protocol : '',
    models: Array.isArray(n.models) ? n.models.map(normalizeModel).filter(Boolean) : [],
  };
}

function normalizeModel(m) {
  if (!m || typeof m !== 'object') return null;
  return {
    id: typeof m.id === 'string' && m.id ? m.id : genId('model'),
    name: typeof m.name === 'string' ? m.name : '',
    thinkingEffort: ['', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(m.thinkingEffort) ? m.thinkingEffort : '',
    serviceTier: m.serviceTier === 'fast' ? 'fast' : '',
  };
}

function writeConfig(cfg) {
  if (_writeLock) {
    console.error('[NodeConfig] concurrent write rejected');
    return false;
  }
  _writeLock = true;
  const fp = getConfigFilePath();
  const normalized = normalizeConfig(cfg);
  try {
    fs.writeFileSync(fp, JSON.stringify(normalized, null, 2), 'utf-8');
    _memoryCache = normalized;
    return true;
  } catch (e) {
    console.error('[NodeConfig] write failed:', e.message);
    return false;
  } finally {
    _writeLock = false;
  }
}

function getActiveNode(cfg) {
  const c = cfg || readConfig();
  if (!c.activeNodeId) return c.nodes[0] || null;
  return c.nodes.find((n) => n.id === c.activeNodeId) || c.nodes[0] || null;
}

function getActiveModel(cfg) {
  const c = cfg || readConfig();
  const node = getActiveNode(c);
  if (!node || !node.models.length) return null;
  if (!c.activeModelId) return node.models[0];
  return node.models.find((m) => m.id === c.activeModelId) || node.models[0];
}

function getActiveRuntime(cfg) {
  const c = cfg || readConfig();
  const node = getActiveNode(c);
  const model = getActiveModel(c);
  if (!node || !model) return null;
  return {
    host: node.host,
    apiKey: node.apiKey,
    protocol: node.protocol,
    modelName: model.name,
    thinkingEffort: model.thinkingEffort || '',
    serviceTier: model.serviceTier || '',
    nodeId: node.id,
    modelId: model.id,
  };
}

function addNode(cfg, nodeData) {
  const c = normalizeConfig(cfg || readConfig());
  const node = normalizeNode({
    id: genId('node'),
    name: nodeData.name || '新节点',
    host: nodeData.host || '',
    apiKey: nodeData.apiKey || '',
    protocol: nodeData.protocol || '',
    models: [],
  });
  c.nodes.push(node);
  if (!c.activeNodeId) c.activeNodeId = node.id;
  writeConfig(c);
  return c;
}

function updateNode(cfg, nodeId, patch) {
  const c = normalizeConfig(cfg || readConfig());
  const node = c.nodes.find((n) => n.id === nodeId);
  if (!node) return c;
  if (Object.prototype.hasOwnProperty.call(patch, 'name')) node.name = String(patch.name || '');
  if (Object.prototype.hasOwnProperty.call(patch, 'host')) node.host = String(patch.host || '');
  if (Object.prototype.hasOwnProperty.call(patch, 'apiKey')) node.apiKey = String(patch.apiKey || '');
  if (Object.prototype.hasOwnProperty.call(patch, 'protocol')) node.protocol = ['anthropic', 'openai', ''].includes(patch.protocol) ? patch.protocol : node.protocol;
  writeConfig(c);
  return c;
}

function removeNode(cfg, nodeId) {
  const c = normalizeConfig(cfg || readConfig());
  c.nodes = c.nodes.filter((n) => n.id !== nodeId);
  if (c.activeNodeId === nodeId) {
    c.activeNodeId = c.nodes[0]?.id || '';
    c.activeModelId = '';
  }
  writeConfig(c);
  return c;
}

function addModel(cfg, nodeId, modelData) {
  const c = normalizeConfig(cfg || readConfig());
  const node = c.nodes.find((n) => n.id === nodeId);
  if (!node) return c;
  const model = normalizeModel({
    id: genId('model'),
    name: modelData.name || '新模型',
    thinkingEffort: modelData.thinkingEffort || '',
    serviceTier: modelData.serviceTier || '',
  });
  node.models.push(model);
  if (c.activeNodeId === nodeId && !c.activeModelId) {
    c.activeModelId = model.id;
  }
  writeConfig(c);
  return c;
}

function updateModel(cfg, nodeId, modelId, patch) {
  const c = normalizeConfig(cfg || readConfig());
  const node = c.nodes.find((n) => n.id === nodeId);
  if (!node) return c;
  const model = node.models.find((m) => m.id === modelId);
  if (!model) return c;
  if (Object.prototype.hasOwnProperty.call(patch, 'name')) model.name = String(patch.name || '');
  if (Object.prototype.hasOwnProperty.call(patch, 'thinkingEffort')) model.thinkingEffort = ['', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(patch.thinkingEffort) ? patch.thinkingEffort : '';
  if (Object.prototype.hasOwnProperty.call(patch, 'serviceTier')) model.serviceTier = patch.serviceTier === 'fast' ? 'fast' : '';
  writeConfig(c);
  return c;
}

function removeModel(cfg, nodeId, modelId) {
  const c = normalizeConfig(cfg || readConfig());
  const node = c.nodes.find((n) => n.id === nodeId);
  if (!node) return c;
  node.models = node.models.filter((m) => m.id !== modelId);
  if (c.activeModelId === modelId) c.activeModelId = node.models[0]?.id || '';
  writeConfig(c);
  return c;
}

function setActive(cfg, nodeId, modelId) {
  const c = normalizeConfig(cfg || readConfig());
  if (nodeId && c.nodes.some((n) => n.id === nodeId)) {
    c.activeNodeId = nodeId;
  }
  if (modelId) {
    const node = c.nodes.find((n) => n.id === (nodeId || c.activeNodeId));
    if (node && node.models.some((m) => m.id === modelId)) {
      c.activeModelId = modelId;
    }
  }
  writeConfig(c);
  return c;
}

function updateAdvanced(cfg, patch) {
  const c = normalizeConfig(cfg || readConfig());
  c.advanced = { ...c.advanced, ...(patch || {}) };
  writeConfig(c);
  return c;
}

module.exports = {
  getConfigFilePath,
  readConfig,
  writeConfig,
  normalizeConfig,
  getActiveNode,
  getActiveModel,
  getActiveRuntime,
  addNode,
  updateNode,
  removeNode,
  addModel,
  updateModel,
  removeModel,
  setActive,
  updateAdvanced,
  defaultConfig,
};
