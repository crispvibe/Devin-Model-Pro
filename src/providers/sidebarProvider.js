'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.SidebarProvider = undefined;
let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    window: {
      showInformationMessage: () => undefined,
      showWarningMessage: () => undefined,
      showErrorMessage: () => undefined,
      showQuickPick: () => undefined,
      showOpenDialog: () => undefined,
      createStatusBarItem: () => ({
        text: '',
        tooltip: '',
        command: '',
        show: () => undefined,
        dispose: () => undefined,
      }),
    },
    workspace: {
      openTextDocument: () => undefined,
    },
    env: {
      clipboard: {
        writeText: () => undefined,
      },
    },
    Uri: {
      joinPath: () => ({}),
    },
    StatusBarAlignment: {
      Left: 1,
    },
  };
}
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const os = require('os');
const child_process_1 = require('child_process');
const patchManager_1 = require('../managers/patchManager');
const reloadWorkbench_1 = require('../utils/reloadWorkbench');
const thinkingEffort_1 = require('../services/thinkingEffort');
const externalConfigImporter_1 = require('../services/externalConfigImporter');
const sidebarHtml_1 = require('../views/sidebarHtml');
const gatewayUrl_1 = require('../utils/gatewayUrl');
const sidebarTemplate_1 = require('../views/sidebarTemplate');
const sidebarUtils_1 = require('./sidebar-utils');
const modelFetcher_1 = require('../services/modelFetcher');
const profileStore_1 = require('../services/profileStore');
const diagnostics_1 = require('../services/diagnostics');
const promptTemplates_1 = require('../services/promptTemplates');
const nodeConfig_1 = require('../managers/node-config');
const KEY_AUTO_START_PROXY = 'devin-model-pro.autoStartProxy';
const KEY_PATCH_EXTENSION_PATH = 'devin-model-pro.patchExtensionPath';
const LEGACY_KEY_PATCH_EXTENSION_PATH = 'windsurf-byok-plus.patchExtensionPath';
const LEGACY_KEY_PATCH_EXTENSION_PATH_2 = 'devin-model-pro.patchExtensionPath';
function getWebviewNonce() {
  let tmp02 = '';
  const tmp1 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let tmp03 = 0; tmp03 < 32; tmp03++) {
    tmp02 += tmp1.charAt(Math.floor(Math.random() * tmp1.length));
  }
  return tmp02;
}
class SidebarProvider {
  constructor(tmp02, tmp1) {
    this.context = tmp02;
    this.logLines = [];
    this.lastStatusPostMs = 0;
    this.editingProfileId = null;
    this.proxyManager = tmp1;
    this.proxyManager.onLog((arg0) => {
      this.logLines.push(arg0);
      if (this.logLines.length > 200) {
        this.logLines = this.logLines.slice(-100);
      }
      if (this.view) {
        const tmp03 = {
          type: 'log',
          line: arg0,
        };
        this.view.webview.postMessage(tmp03);
        const tmp12 = Date.now();
        if (tmp12 - this.lastStatusPostMs > 500) {
          this.lastStatusPostMs = tmp12;
          this.view.webview.postMessage({
            type: 'status',
            proxy: this.proxyManager.getStatus(),
          });
        }
      }
    });
  }
  renderFallbackHtml(tmp02) {
    const tmp1 = esc(tmp02 instanceof Error ? tmp02.message : String(tmp02));
    return (
      '<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',system-ui,sans-serif;padding:12px;color:var(--vscode-foreground);background:var(--vscode-sideBar-background,var(--vscode-editor-background));font-size:12px;line-height:1.5}.box{border:1px solid var(--vscode-panel-border);border-radius:8px;padding:12px;background:var(--vscode-editorWidget-background)}b{display:block;margin-bottom:6px;color:var(--vscode-errorForeground,#f87171)}code{word-break:break-all}</style></head><body><div class="box"><b>控制面板加载失败</b><div><code>' +
      tmp1 +
      '</code></div><div style="margin-top:8px">请重载窗口或重新打开侧栏。</div></div></body></html>'
    );
  }
  resolveWebviewView(tmp02) {
    this.view = tmp02;
    const tmp1 = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };
    tmp02.webview.options = tmp1;
    try {
      tmp02.webview.html = this.getHtml();
    } catch (tmp03) {
      const tmp12 = tmp03 instanceof Error ? tmp03.stack || tmp03.message : String(tmp03);
      this.logLines.push('侧栏加载失败: ' + tmp12);
      if (this.logLines.length > 200) {
        this.logLines = this.logLines.slice(-100);
      }
      tmp02.webview.html = this.renderFallbackHtml(tmp03);
      vscode.window.showErrorMessage(
        'Devin BYOK Bridge 控制面板加载失败：' +
          (tmp03 instanceof Error ? tmp03.message : String(tmp03))
      );
    }
    tmp02.webview.onDidReceiveMessage((arg0) => this.handleMessage(arg0));
    if (this.proxyManager.getStatus().running) {
      this.refresh();
    }
  }
  async checkHttpHealth(tmp02, tmp1 = 5000) {
    const tmp2 = Date.now();
    return new Promise((fn) => {
      let tmp12 = false;
      const fn2 = (arg0) => {
        if (tmp12) {
          return;
        }
        tmp12 = true;
        fn({
          ...arg0,
          elapsedMs: Date.now() - tmp2,
        });
      };
      const tmp3 = new URL(tmp02);
      const tmp4 = tmp3.protocol === 'http:' ? http : https;
      const tmp5 = {
        method: 'GET',
        timeout: tmp1,
        agent: false,
      };
      const tmp6 = tmp4.request(tmp3, tmp5, (arg0) => {
        arg0.resume();
        arg0.on('end', () =>
          fn2({
            ok: !!arg0.statusCode && arg0.statusCode >= 200 && arg0.statusCode < 400,
            statusCode: arg0.statusCode,
          })
        );
      });
      tmp6.on('error', (arg0) =>
        fn2({
          ok: false,
          error: arg0.message,
        })
      );
      tmp6.on('timeout', () => {
        tmp6.destroy();
        fn2({
          ok: false,
          error: 'timeout',
        });
      });
      tmp6.end();
    });
  }
  refresh() {
    if (!this.view) {
      return;
    }
    this.postStatusSnapshot();
  }
  async postStatusSnapshot() {
    if (!this.view) return;
    const nodeCfg = nodeConfig_1.readConfig();
    this.view.webview.postMessage({
      type: 'status',
      proxy: this.proxyManager.getStatus(),
      patch: this.getPatchStatus(),
      config: this.getEditingScopedConfig(),
      logs: this.logLines.slice(-50),
      nodeTree: {
        nodes: nodeCfg.nodes,
        activeNodeId: nodeCfg.activeNodeId,
        activeModelId: nodeCfg.activeModelId,
      },
    });
  }
  getEditingScopedConfig() {
    const envConfig = this.proxyManager.readEnvConfig();
    if (this.editingProfileId) {
      const profile = profileStore_1.getProfileById(this.editingProfileId, envConfig);
      if (profile) {
        return this.getModeScopedConfig(profileStore_1.projectToEnvConfig(profile));
      }
    }
    return this.getModeScopedConfig(envConfig);
  }
  postProfileList() {
    if (!this.view) return;
    const envConfig = this.proxyManager.readEnvConfig();
    const list = profileStore_1.listProfiles(envConfig);
    if (!this.editingProfileId || !list.profiles.some((p) => p.id === this.editingProfileId)) {
      this.editingProfileId = list.activeId;
    }
    this.view.webview.postMessage({
      type: 'profileList',
      profiles: list.profiles,
      activeId: list.activeId,
      editingId: this.editingProfileId,
    });
  }
  postNodeTree() {
    if (!this.view) return;
    const cfg = nodeConfig_1.readConfig();
    this.view.webview.postMessage({
      type: 'nodeTree',
      nodes: cfg.nodes,
      activeNodeId: cfg.activeNodeId,
      activeModelId: cfg.activeModelId,
    });
  }
  buildEnvFromNodeConfig(cfg) {
    const runtime = nodeConfig_1.getActiveRuntime(cfg);
    const env = {
      BYOK1_ANTHROPIC_API_HOST: runtime ? runtime.host : '',
      BYOK1_ANTHROPIC_API_KEY: runtime ? runtime.apiKey : '',
      BYOK1_OPENAI_API_HOST: runtime ? runtime.host : '',
      BYOK1_OPENAI_API_KEY: runtime ? runtime.apiKey : '',
      BYOK1_MODEL: runtime ? runtime.modelName : '',
      BYOK1_THINKING_EFFORT: runtime ? runtime.thinkingEffort : '',
      BYOK1_OPENAI_SERVICE_TIER: runtime ? runtime.serviceTier : '',
      BYOK1_PROTOCOL: runtime ? runtime.protocol : '',
      BYOK2_ANTHROPIC_API_HOST: '', BYOK2_ANTHROPIC_API_KEY: '', BYOK2_MODEL: '', BYOK2_THINKING_EFFORT: '', BYOK2_OPENAI_SERVICE_TIER: '', BYOK2_PROTOCOL: '',
      BYOK3_ANTHROPIC_API_HOST: '', BYOK3_ANTHROPIC_API_KEY: '', BYOK3_MODEL: '', BYOK3_THINKING_EFFORT: '', BYOK3_OPENAI_SERVICE_TIER: '', BYOK3_PROTOCOL: '',
      BYOK4_ANTHROPIC_API_HOST: '', BYOK4_ANTHROPIC_API_KEY: '', BYOK4_MODEL: '', BYOK4_THINKING_EFFORT: '', BYOK4_OPENAI_SERVICE_TIER: '', BYOK4_PROTOCOL: '',
    };
    if (cfg.advanced) {
      if (cfg.advanced.hybridPort) env.HYBRID_PORT = cfg.advanced.hybridPort;
      if (cfg.advanced.inferencePort) env.INFERENCE_PORT = cfg.advanced.inferencePort;
      if (cfg.advanced.maxTokens) env.MAX_TOKENS = cfg.advanced.maxTokens;
      if (cfg.advanced.completionTimeout) env.COMPLETION_TIMEOUT_MS = cfg.advanced.completionTimeout;
      if (cfg.advanced.systemPromptPath) env.SYSTEM_PROMPT_PATH = cfg.advanced.systemPromptPath;
      if (cfg.advanced.systemPromptOverride) env.SYSTEM_PROMPT_OVERRIDE = cfg.advanced.systemPromptOverride;
    }
    return env;
  }
  async applyNodeConfigToRuntime(silent) {
    const cfg = nodeConfig_1.readConfig();
    const activeRuntime = nodeConfig_1.getActiveRuntime(cfg);
    if (!activeRuntime) {
      if (!silent) {
        this.postActionState('config', 'error', '未选择节点或模型，无法切换');
      }
      this.postNodeTree();
      return { merged: null, message: '未选择节点或模型' };
    }
    const envPatch = this.buildEnvFromNodeConfig(cfg);
    const merged = this.writeModeScopedConfig(envPatch);
    const runtime = this.getRuntimeConfigForCurrentMode(merged);
    const status = this.proxyManager.getStatus();
    let message = '已切换；代理未运行，下次启动生效';
    if (status.running) {
      const { hybridPort, inferencePort } = this.proxyManager.portsFromConfig(merged);
      const portsChanged = status.hybridPort !== hybridPort || status.inferencePort !== inferencePort;
      if (portsChanged) {
        this.proxyManager.stop();
        const started = await this.proxyManager.start('both', runtime);
        message = started ? '已切换；端口变更，代理已重启' : '已切换；端口变更但代理重启失败：' + (this.proxyManager.getLastStartError() || '未知错误');
      } else {
        const result = await this.proxyManager.reloadRuntimeConfig(runtime, { hybridPort, inferencePort });
        if (result.ok) {
          message = '已切换，热更新生效';
        } else {
          const errMsg = result.errors.join('；') || '未知错误';
          this.proxyManager.stop();
          await new Promise((r) => setTimeout(r, 500));
          const started = await this.proxyManager.start('both', runtime);
          message = started ? '已切换；热更新失败但已自动重启（' + errMsg + '）' : '已切换；热更新失败且重启失败：' + (this.proxyManager.getLastStartError() || errMsg);
        }
      }
    }
    if (!silent) {
      this.postActionState('config', message.includes('失败') ? 'error' : 'success', message);
    }
    this.postNodeTree();
    return { merged, message };
  }
  postEditingConfig() {
    if (!this.view || !this.editingProfileId) return;
    const envConfig = this.proxyManager.readEnvConfig();
    const profile = profileStore_1.getProfileById(this.editingProfileId, envConfig);
    if (!profile) return;
    const scoped = this.getModeScopedConfig(profileStore_1.projectToEnvConfig(profile));
    this.view.webview.postMessage({
      type: 'status',
      proxy: this.proxyManager.getStatus(),
      patch: this.getPatchStatus(),
      config: scoped,
    });
  }
  getStoredPatchExtensionPath() {
    let tmp02 = this.context.globalState.get(KEY_PATCH_EXTENSION_PATH);
    if (!tmp02) {
      tmp02 = this.context.globalState.get(LEGACY_KEY_PATCH_EXTENSION_PATH_2);
      if (tmp02) {
        this.context.globalState.update(KEY_PATCH_EXTENSION_PATH, tmp02);
      }
    }
    if (!tmp02) {
      tmp02 = this.context.globalState.get(LEGACY_KEY_PATCH_EXTENSION_PATH);
      if (tmp02) {
        this.context.globalState.update(KEY_PATCH_EXTENSION_PATH, tmp02);
      }
    }
    if (typeof tmp02 === 'string' && tmp02.trim()) {
      return tmp02.trim();
    } else {
      return undefined;
    }
  }
  getModeScopedConfig(tmp02 = this.proxyManager.readEnvConfig()) {
    const tmp1 = modelFetcher_1.normalizeProviderBaseUrl({
      ...tmp02,
    });
    if (!String(tmp1.BYOK1_MODEL || '').trim()) {
      tmp1.BYOK1_ANTHROPIC_API_HOST =
        tmp1.BYOK1_ANTHROPIC_API_HOST || tmp1.ANTHROPIC_API_HOST || '';
      tmp1.BYOK1_ANTHROPIC_API_KEY = tmp1.BYOK1_ANTHROPIC_API_KEY || tmp1.ANTHROPIC_API_KEY || '';
      tmp1.BYOK1_OPENAI_API_HOST =
        tmp1.BYOK1_OPENAI_API_HOST || tmp1.OPENAI_API_HOST || tmp1.BYOK1_ANTHROPIC_API_HOST || '';
      tmp1.BYOK1_OPENAI_API_KEY =
        tmp1.BYOK1_OPENAI_API_KEY || tmp1.OPENAI_API_KEY || tmp1.BYOK1_ANTHROPIC_API_KEY || '';
      tmp1.BYOK1_MODEL = tmp1.DEFAULT_MODEL || '';
    }
    if (!String(tmp1.BYOK1_THINKING_EFFORT || '').trim()) {
      tmp1.BYOK1_THINKING_EFFORT = tmp1.OPENAI_REASONING_EFFORT || '';
    }
    if (!String(tmp1.BYOK1_OPENAI_SERVICE_TIER || '').trim()) {
      tmp1.BYOK1_OPENAI_SERVICE_TIER = tmp1.OPENAI_SERVICE_TIER || '';
    }
    return tmp1;
  }
  validateByokSlots(tmp02) {
    const tmp1 = [];
    if (!String(tmp02.BYOK1_ANTHROPIC_API_KEY || '').trim()) {
      tmp1.push('BYOK #1 未填写 API Key');
    }
    if (!String(tmp02.BYOK1_MODEL || '').trim()) {
      tmp1.push('BYOK #1 未选择模型');
    }
    if (!String(tmp02.BYOK2_ANTHROPIC_API_KEY || '').trim()) {
      tmp1.push('BYOK #2 未填写 API Key');
    }
    if (!String(tmp02.BYOK2_MODEL || '').trim()) {
      tmp1.push('BYOK #2 未选择模型');
    }
    return tmp1;
  }
  getRuntimeConfigForCurrentMode(tmp02 = this.proxyManager.readEnvConfig()) {
    return this.getModeScopedConfig(tmp02);
  }
  writeModeScopedConfig(tmp02) {
    const merged = modelFetcher_1.normalizeProviderBaseUrl({
      ...this.proxyManager.readEnvConfig(),
      ...tmp02,
    });
    this.proxyManager.writeEnvConfig(merged);
    return merged;
  }
  envConfigToProfileFields(cfg) {
    const norm = modelFetcher_1.normalizeProviderBaseUrl({ ...cfg });
    return {
      byok1: {
        host: norm.BYOK1_ANTHROPIC_API_HOST ? this.stripProtocol(norm.BYOK1_ANTHROPIC_API_HOST) : '',
        key: norm.BYOK1_ANTHROPIC_API_KEY || '',
        model: norm.BYOK1_MODEL || '',
        thinkingEffort: norm.BYOK1_THINKING_EFFORT || '',
        protocol: profileStore_1.sanitizeProtocol(norm.BYOK1_PROTOCOL || ''),
        anthropicPath: norm.BYOK1_ANTHROPIC_API_PATH || '',
        openaiPath: norm.BYOK1_OPENAI_API_PATH || '',
      },
      byok2: {
        host: norm.BYOK2_ANTHROPIC_API_HOST ? this.stripProtocol(norm.BYOK2_ANTHROPIC_API_HOST) : '',
        key: norm.BYOK2_ANTHROPIC_API_KEY || '',
        model: norm.BYOK2_MODEL || '',
        thinkingEffort: norm.BYOK2_THINKING_EFFORT || '',
        protocol: profileStore_1.sanitizeProtocol(norm.BYOK2_PROTOCOL || ''),
        anthropicPath: norm.BYOK2_ANTHROPIC_API_PATH || '',
        openaiPath: norm.BYOK2_OPENAI_API_PATH || '',
      },
      byok3: {
        host: norm.BYOK3_ANTHROPIC_API_HOST ? this.stripProtocol(norm.BYOK3_ANTHROPIC_API_HOST) : '',
        key: norm.BYOK3_ANTHROPIC_API_KEY || '',
        model: norm.BYOK3_MODEL || '',
        thinkingEffort: norm.BYOK3_THINKING_EFFORT || '',
        protocol: profileStore_1.sanitizeProtocol(norm.BYOK3_PROTOCOL || ''),
        anthropicPath: norm.BYOK3_ANTHROPIC_API_PATH || '',
        openaiPath: norm.BYOK3_OPENAI_API_PATH || '',
      },
      byok4: {
        host: norm.BYOK4_ANTHROPIC_API_HOST ? this.stripProtocol(norm.BYOK4_ANTHROPIC_API_HOST) : '',
        key: norm.BYOK4_ANTHROPIC_API_KEY || '',
        model: norm.BYOK4_MODEL || '',
        thinkingEffort: norm.BYOK4_THINKING_EFFORT || '',
        protocol: profileStore_1.sanitizeProtocol(norm.BYOK4_PROTOCOL || ''),
        anthropicPath: norm.BYOK4_ANTHROPIC_API_PATH || '',
        openaiPath: norm.BYOK4_OPENAI_API_PATH || '',
      },
      advanced: {
        hybridPort: norm.HYBRID_PORT || '',
        inferencePort: norm.INFERENCE_PORT || '',
        anthropicPath: norm.ANTHROPIC_API_PATH || '/v1/messages',
        openaiPath: norm.OPENAI_API_PATH || '/v1/responses',
        maxTokens: norm.MAX_TOKENS || '64000',
        completionTimeout: norm.COMPLETION_TIMEOUT_MS || '12000',
      },
    };
  }
  stripProtocol(v) {
    return gatewayUrl_1.stripProtoServer(v);
  }
  async applyProfileToRuntime(profile, silent) {
    const patch = profileStore_1.projectToEnvConfig(profile);
    const merged = this.writeModeScopedConfig(patch);
    const runtime = this.getRuntimeConfigForCurrentMode(merged);
    const status = this.proxyManager.getStatus();
    let message = '已切换方案；代理未运行，下次启动生效';
    if (status.running) {
      const { hybridPort, inferencePort } = this.proxyManager.portsFromConfig(merged);
      const portsChanged = status.hybridPort !== hybridPort || status.inferencePort !== inferencePort;
      if (portsChanged) {
        this.proxyManager.stop();
        const started = await this.proxyManager.start('both', runtime);
        message = started
          ? '已切换方案；端口变更，代理已重启'
          : '已切换方案；端口变更但代理重启失败：' +
            (this.proxyManager.getLastStartError() || '未知错误');
      } else {
        const result = await this.proxyManager.reloadRuntimeConfig(runtime, {
          hybridPort,
          inferencePort,
        });
        if (result.ok) {
          message = '已切换方案，并已热更新到运行中的代理';
        } else {
          const errMsg = result.errors.join('；') || '未知错误';
          this.proxyManager.stop();
          await new Promise((r) => setTimeout(r, 500));
          const started = await this.proxyManager.start('both', runtime);
          message = started
            ? '已切换方案；热更新失败但已自动重启代理生效（' + errMsg + '）'
            : '已切换方案；热更新失败且代理重启失败：' +
              (this.proxyManager.getLastStartError() || errMsg);
        }
      }
    }
    if (!silent) {
      this.postActionState('config', message.includes('失败') ? 'error' : 'success', message);
    }
    return { merged, message };
  }
  async checkGatewayModelCatalog(tmp02) {
    const tmp1 = tmp02.ANTHROPIC_API_KEY || tmp02.OPENAI_API_KEY || '';
    const tmp2 = String(tmp02.DEFAULT_MODEL || '').trim();
    if (!tmp1) {
      return sidebarUtils_1.envCheckItem(
        'model-catalog',
        '模型权限',
        'warning',
        '未配置 API Key，无法检查模型列表权限',
        false
      );
    }
    try {
      const tmp03 = await modelFetcher_1.fetchModelsFromGateway(tmp1, undefined, this.proxyManager);
      const tmp12 = modelFetcher_1.flattenModelIds(tmp03);
      const tmp22 = tmp12.filter((arg0) => /opus/i.test(arg0));
      const tmp3 = modelFetcher_1.modelIdMatches(tmp12, tmp2);
      if (tmp12.length === 0) {
        return sidebarUtils_1.envCheckItem(
          'model-catalog',
          '模型权限',
          'warning',
          '模型列表为空；本地环境正常不代表模型可调用',
          false
        );
      }
      const tmp4 = tmp2
        ? '默认模型 ' + (tmp3 ? '可见' : '未在列表中') + '：' + tmp2
        : '未设置默认模型';
      const tmp5 =
        tmp22.length > 0
          ? 'Opus 可见：' + tmp22.slice(0, 3).join(', ')
          : 'Opus 未在模型列表中，选择 Opus 可能失败或无可用返回';
      return sidebarUtils_1.envCheckItem(
        'model-catalog',
        '模型权限',
        !tmp3 || tmp22.length === 0 ? 'warning' : 'ok',
        '可见模型 ' + tmp12.length + ' 个；' + tmp4 + '；' + tmp5,
        false
      );
    } catch (tmp03) {
      const tmp12 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
      return sidebarUtils_1.envCheckItem(
        'model-catalog',
        '模型权限',
        'warning',
        '模型列表检查失败：' + tmp12,
        false
      );
    }
  }
  async setStoredPatchExtensionPath(tmp02) {
    const tmp1 = typeof tmp02 === 'string' && tmp02.trim() ? tmp02.trim() : undefined;
    await this.context.globalState.update(KEY_PATCH_EXTENSION_PATH, tmp1);
  }
  getPatchStatus() {
    const tmp02 = this.proxyManager.getStatus();
    return patchManager_1.PatchManager.getStatus(
      this.getStoredPatchExtensionPath(),
      patchManager_1.PatchManager.loopbackApiUrl(tmp02.hybridPort),
      patchManager_1.PatchManager.loopbackApiUrl(tmp02.inferencePort)
    );
  }
  readProxyDependencyKeys() {
    const tmp02 = path.join(this.proxyManager.getProxyRootPath(), 'package.json');
    if (!fs.existsSync(tmp02)) {
      return undefined;
    }
    try {
      const tmp03 = JSON.parse(fs.readFileSync(tmp02, 'utf-8'));
      const tmp1 = {
        ...tmp03.dependencies,
        ...tmp03.devDependencies,
        ...tmp03.optionalDependencies,
      };
      return Object.keys(tmp1);
    } catch {
      return undefined;
    }
  }
  readExtensionPackageInfo() {
    const tmp02 = diagnostics_1.readJsonObject(path.join(this.context.extensionPath, 'package.json')) || {};
    return {
      name: String(tmp02.name || ''),
      displayName: String(tmp02.displayName || ''),
      version: String(tmp02.version || ''),
      publisher: String(tmp02.publisher || ''),
    };
  }
  postActionState(tmp02, tmp1, tmp2) {
    const tmp3 = {
      type: 'actionState',
      section: tmp02,
      state: tmp1,
      message: tmp2,
    };
    this.view?.webview.postMessage(tmp3);
  }
  postToast(tmp02, tmp1) {
    this.view?.webview.postMessage({
      type: 'toast',
      state: tmp02,
      message: tmp1,
    });
  }
  async ensurePatchAppliedAfterProxyStart(tmp02 = true) {
    const tmp1 = this.getPatchStatus();
    const tmp2 = tmp1.patches.some((arg0) => arg0.status !== 'applied');
    if (!tmp2 || !tmp1.path) {
      return;
    }
    const tmp3 = this.proxyManager.getStatus();
    const tmp4 = patchManager_1.PatchManager.loopbackApiUrl(tmp3.hybridPort);
    const tmp5 = patchManager_1.PatchManager.loopbackApiUrl(tmp3.inferencePort);
    const tmp6 = this.getStoredPatchExtensionPath();
    const tmp7 = patchManager_1.PatchManager.applyWithCustomUrls(tmp4, tmp5, tmp6);
    if (tmp7.applied <= 0) {
      return;
    }
    const tmp8 =
      '检测到 Devin Desktop 补丁丢失，已自动恢复 ' + tmp7.applied + ' 个，需重载窗口生效';
    this.logLines.push(tmp8);
    if (this.logLines.length > 200) {
      this.logLines = this.logLines.slice(-100);
    }
    const tmp9 = {
      type: 'log',
      line: tmp8,
    };
    this.view?.webview.postMessage(tmp9);
    this.postActionState('patch', 'success', tmp8);
    if (!tmp02) {
      return;
    }
    const tmp10 = await vscode.window.showInformationMessage(tmp8, '重载窗口');
    if (tmp10 === '重载窗口') {
      await (0, reloadWorkbench_1.reloadWorkbenchWindow)();
    }
  }
  runDetachedCacheCleaner(tmp02) {
    if (process.platform === 'win32') {
      (0, child_process_1.spawn)('cmd.exe', ['/c', 'start', '', tmp02], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      }).unref();
      return;
    }
    if (process.platform === 'darwin') {
      (0, child_process_1.spawn)(
        'osascript',
        [
          '-e',
          'tell application "Terminal" to do script "sh ' +
            sidebarUtils_1.shellQuote(tmp02).replace(/"/g, '\\"') +
            '"',
        ],
        {
          detached: true,
          stdio: 'ignore',
        }
      ).unref();
      return;
    }
    (0, child_process_1.spawn)('sh', [tmp02], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  }
  async clearWindsurfCache() {
    const tmp02 = await vscode.window.showWarningMessage(
      '将关闭 Devin Desktop/Codeium，只清理运行缓存目录；不会删除 Devin Desktop 历史记录、工作区数据、聊天记录或配置。是否继续？',
      {
        modal: true,
      },
      '安全清理缓存'
    );
    if (tmp02 !== '安全清理缓存') {
      return;
    }
    const tmp1 = path.join(
      os.tmpdir(),
      'devin-model-pro-clear-cache-' + Date.now() + (process.platform === 'win32' ? '.cmd' : '.sh')
    );
    if (process.platform === 'win32') {
      fs.writeFileSync(
        tmp1,
        [
          '@echo off',
          'timeout /t 1 /nobreak >nul 2>&1',
          'taskkill /f /im Devin.exe >nul 2>&1',
          'taskkill /f /im Windsurf.exe >nul 2>&1',
          'taskkill /f /im language_server.exe >nul 2>&1',
          'taskkill /f /im codeium.exe >nul 2>&1',
          'taskkill /f /im Codeium.exe >nul 2>&1',
          'timeout /t 2 /nobreak >nul 2>&1',
          'echo 正在安全清除运行缓存...',
          'rd /s /q "%APPDATA%\\Devin\\Cache" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Windsurf\\Cache" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Devin\\CachedData" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Windsurf\\CachedData" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Devin\\CachedExtensionVSIXs" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Windsurf\\CachedExtensionVSIXs" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Devin\\Code Cache" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Windsurf\\Code Cache" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Devin\\DawnCache" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Windsurf\\DawnCache" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Devin\\GPUCache" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Windsurf\\GPUCache" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Devin\\Cache" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Windsurf\\Cache" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Devin\\CachedData" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Windsurf\\CachedData" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Devin\\Code Cache" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Windsurf\\Code Cache" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Devin\\DawnCache" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Windsurf\\DawnCache" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Devin\\GPUCache" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Windsurf\\GPUCache" >nul 2>&1',
          'rd /s /q "%TEMP%\\codeium" >nul 2>&1',
          'echo 运行缓存已清除完毕，Devin Desktop 历史记录已保留，请重新打开 Devin Desktop',
          'pause',
          '',
        ].join('\r\n'),
        'utf-8'
      );
    } else {
      fs.writeFileSync(
        tmp1,
        [
          '#!/bin/sh',
          'sleep 1',
          'pkill -f "Devin" >/dev/null 2>&1 || true',
          'pkill -f "Windsurf" >/dev/null 2>&1 || true',
          'pkill -f "Codeium" >/dev/null 2>&1 || true',
          'pkill -f "codeium" >/dev/null 2>&1 || true',
          'sleep 1',
          'echo 正在安全清除运行缓存...',
          'rm -rf "$HOME/Library/Caches/Devin"',
          'rm -rf "$HOME/Library/Caches/Windsurf"',
          'rm -rf "$HOME/Library/Caches/Codeium"',
          'rm -rf "$HOME/.cache/Devin"',
          'rm -rf "$HOME/.cache/Windsurf"',
          'rm -rf "$HOME/.cache/Codeium"',
          'rm -rf "${TMPDIR:-/tmp}/codeium"',
          'rm -rf "/tmp/codeium"',
          'echo 运行缓存已清除完毕，Devin Desktop 历史记录已保留，请重新打开 Devin Desktop',
          'printf "Press Enter to close..."',
          'read _',
          '',
        ].join('\n'),
        'utf-8'
      );
      fs.chmodSync(tmp1, 493);
    }
    this.runDetachedCacheCleaner(tmp1);
    this.postActionState(
      'config',
      'success',
      '安全清理缓存脚本已启动，历史记录会保留，Devin Desktop 即将关闭'
    );
  }
  getSystemPromptTargetPath(tmp02, tmp1) {
    const tmp2 = {
      ...tmp02,
    };
    const tmp3 = tmp2;
    if (typeof tmp1 === 'string') {
      tmp3.SYSTEM_PROMPT_PATH = tmp1.trim() || './prompts/system-prompt.md';
    }
    return this.proxyManager.getResolvedSystemPromptPath(tmp3);
  }
  async restartProxyForPromptConfigIfRunning() {
    const tmp02 = this.proxyManager.getStatus();
    if (!tmp02.running) {
      return false;
    }
    const tmp1 = await vscode.window.showInformationMessage(
      '提示词配置已更新，需要重启代理后生效。是否立即重启？',
      '立即重启',
      '稍后手动重启'
    );
    if (tmp1 !== '立即重启') {
      return false;
    }
    this.proxyManager.stop();
    await new Promise((arg0) => setTimeout(arg0, 500));
    const tmp2 = await this.proxyManager.start('both', this.getRuntimeConfigForCurrentMode());
    this.postActionState(
      'proxy',
      tmp2 ? 'success' : 'error',
      tmp2 ? '代理已重启，提示词已生效' : this.proxyManager.getLastStartError() || '代理重启失败'
    );
    return tmp2;
  }
  async applySystemPromptContent(tmp02, tmp1, tmp2) {
    const tmp3 = this.proxyManager.readEnvConfig();
    const tmp4 = tmp2?.trim() || './prompts/system-prompt.md';
    const tmp5 = this.getSystemPromptTargetPath(tmp3, tmp4);
    if (fs.existsSync(tmp5)) {
      const tmp03 = fs.readFileSync(tmp5, 'utf-8').trim();
      if (tmp03 && tmp03 !== tmp02.trim()) {
        const tmp04 = await vscode.window.showWarningMessage(
          '将覆盖当前提示词文件：' + tmp5,
          {
            modal: true,
          },
          '覆盖'
        );
        if (tmp04 !== '覆盖') {
          this.postActionState('config', 'success', '已取消应用提示词模板');
          return;
        }
      }
    }
    fs.mkdirSync(path.dirname(tmp5), {
      recursive: true,
    });
    fs.writeFileSync(tmp5, tmp02.trim() + '\n', 'utf-8');
    const tmp6 = {
      ...tmp3,
    };
    tmp6.SYSTEM_PROMPT_OVERRIDE = 'true';
    tmp6.SYSTEM_PROMPT_PATH = tmp4;
    const tmp7 = tmp6;
    this.proxyManager.writeEnvConfig(tmp7);
    this.postActionState('config', 'success', '已应用提示词：' + tmp1);
    await this.restartProxyForPromptConfigIfRunning();
    this.refresh();
  }
  async openPromptTemplatePicker() {
    const items = [
      ...promptTemplates_1.BUILT_IN_PROMPT_TEMPLATES.map((arg0) => ({
        label: arg0.label,
        description: arg0.description,
        action: 'template',
        template: arg0,
      })),
      { label: '自定义提示词', description: '打开并编辑 system-prompt.md', action: 'custom' },
      { label: '关闭提示词覆盖', description: '恢复使用 Devin Desktop 原始系统提示词', action: 'disable' },
    ];
    this.view?.webview.postMessage({ type: 'showPicker', title: '提示词模板', items, pickerId: 'promptTemplate' });
  }
  async executePromptTemplateAction(item) {
    if (item.action === 'custom') {
      const tmp03 = this.proxyManager.readEnvConfig();
      const tmp12 = { ...tmp03 };
      tmp12.SYSTEM_PROMPT_OVERRIDE = 'true';
      tmp12.SYSTEM_PROMPT_PATH = tmp03.SYSTEM_PROMPT_PATH || './prompts/system-prompt.md';
      this.proxyManager.writeEnvConfig(tmp12);
      await this.openSystemPromptEditor(tmp12.SYSTEM_PROMPT_PATH);
      this.postActionState('config', 'success', '已启用并打开自定义提示词文件');
      await this.restartProxyForPromptConfigIfRunning();
      this.refresh();
      return;
    }
    if (item.action === 'disable') {
      const tmp03 = this.proxyManager.readEnvConfig();
      const tmp12 = { ...tmp03 };
      tmp12.SYSTEM_PROMPT_OVERRIDE = '';
      this.proxyManager.writeEnvConfig(tmp12);
      this.postActionState('config', 'success', '已关闭提示词覆盖');
      await this.restartProxyForPromptConfigIfRunning();
      this.refresh();
      return;
    }
    await this.applySystemPromptContent(item.template.content, item.template.label);
  }
  async openSystemPromptEditor(tmp02) {
    const tmp1 = this.proxyManager.readEnvConfig();
    const tmp2 = this.getSystemPromptTargetPath(tmp1, tmp02);
    if (!fs.existsSync(tmp2)) {
      fs.mkdirSync(path.dirname(tmp2), {
        recursive: true,
      });
      const tmp03 = {
        ...tmp1,
      };
      tmp03.SYSTEM_PROMPT_PATH = './prompts/system-prompt.md';
      const tmp12 = this.proxyManager.getResolvedSystemPromptPath(tmp03);
      if (fs.existsSync(tmp12) && path.normalize(tmp12) !== path.normalize(tmp2)) {
        fs.copyFileSync(tmp12, tmp2);
      } else {
        fs.writeFileSync(tmp2, '', 'utf-8');
      }
    }
    const tmp3 = await vscode.workspace.openTextDocument(vscode.Uri.file(tmp2));
    await vscode.window.showTextDocument(tmp3, {
      preview: false,
    });
  }
  async handleMessage(tmp02) {
    switch (tmp02.command) {
      case 'startProxy': {
        const nodeCfg = nodeConfig_1.readConfig();
        const activeRuntime = nodeConfig_1.getActiveRuntime(nodeCfg);
        if (activeRuntime) {
          const nodeErrors = [];
          if (!String(activeRuntime.host || '').trim()) {
            nodeErrors.push('节点未填写 Base URL');
          }
          if (!String(activeRuntime.apiKey || '').trim()) {
            nodeErrors.push('节点未填写 API Key');
          }
          if (!String(activeRuntime.modelName || '').trim()) {
            nodeErrors.push('节点未选择模型');
          }
          if (nodeErrors.length) {
            const nodeMsg = nodeErrors.join('；');
            this.postActionState('proxy', 'error', nodeMsg);
            await vscode.window.showErrorMessage(nodeMsg);
            break;
          }
          const envPatch = this.buildEnvFromNodeConfig(nodeCfg);
          const nodeMerged = this.writeModeScopedConfig(envPatch);
          const nodeRuntime = this.getRuntimeConfigForCurrentMode(nodeMerged);
          const nodeStarted = await this.proxyManager.start(tmp02.mode || 'both', nodeRuntime);
          if (!nodeStarted) {
            this.postActionState(
              'proxy',
              'error',
              this.proxyManager.getLastStartError() || '启动失败，请查看通知或日志'
            );
            break;
          }
          const nodeWarning = this.proxyManager.getLastStartWarning();
          this.postActionState('proxy', 'success', nodeWarning ? '代理已启动；' + nodeWarning : '代理已启动');
          await this.ensurePatchAppliedAfterProxyStart(true);
          this.refresh();
          break;
        }
        const tmp03 = tmp02.config;
        if (tmp03) {
          const tmp04 = this.validateByokSlots(tmp03).join('；');
          if (tmp04) {
            this.postActionState('proxy', 'error', tmp04);
            await vscode.window.showErrorMessage(tmp04);
            break;
          }
        }
        let tmp1;
        if (tmp03) {
          tmp1 = this.writeModeScopedConfig(tmp03);
        }
        const tmp2 = this.getRuntimeConfigForCurrentMode(tmp1);
        const tmp3 = await this.proxyManager.start(tmp02.mode || 'both', tmp2);
        if (!tmp3) {
          this.postActionState(
            'proxy',
            'error',
            this.proxyManager.getLastStartError() || '启动失败，请查看通知或日志'
          );
          break;
        }
        const tmp4 = this.proxyManager.getLastStartWarning();
        this.postActionState('proxy', 'success', tmp4 ? '代理已启动；' + tmp4 : '代理已启动');
        await this.ensurePatchAppliedAfterProxyStart(true);
        this.refresh();
        break;
      }
      case 'stopProxy':
        this.proxyManager.stop();
        this.postActionState('proxy', 'success', '代理已停止');
        this.refresh();
        break;
      case 'saveConfig': {
        const tmp03 = tmp02.config;
        const silent = tmp02.silent === true;
        const profileName = typeof tmp02.profileName === 'string' ? tmp02.profileName.trim() : '';
        const envConfig = this.proxyManager.readEnvConfig();
        const list = profileStore_1.listProfiles(envConfig);
        if (!this.editingProfileId || !list.profiles.some((p) => p.id === this.editingProfileId)) {
          this.editingProfileId = list.activeId;
        }
        const fields = this.envConfigToProfileFields(tmp03);
        profileStore_1.updateProfile(this.editingProfileId, fields, envConfig);
        // 同步方案名（如果 webview 提供了名字）
        if (profileName) {
          const current = profileStore_1.getProfileById(this.editingProfileId, envConfig);
          if (current && current.name !== profileName) {
            profileStore_1.renameProfile(this.editingProfileId, profileName, envConfig);
          }
        }
        const isEditingActive = this.editingProfileId === list.activeId;
        if (!isEditingActive) {
          if (!silent) {
            this.postActionState('config', 'success', '已保存到方案（未启用，不影响当前运行）');
          }
          this.postProfileList();
          this.refresh();
          break;
        }
        const nodeCfg = nodeConfig_1.readConfig();
        const activeRuntime = nodeConfig_1.getActiveRuntime(nodeCfg);
        if (activeRuntime) {
          await this.applyNodeConfigToRuntime(silent);
          this.postProfileList();
          this.refresh();
          break;
        }
        const validationError = this.validateByokSlots(tmp03).join('；');
        if (validationError) {
          if (!silent) {
            this.postActionState('config', 'error', validationError);
            await vscode.window.showErrorMessage(validationError);
          }
          this.postProfileList();
          break;
        }
        const activeProfile = profileStore_1.getProfileById(this.editingProfileId, envConfig);
        await this.applyProfileToRuntime(activeProfile, silent);
        this.postProfileList();
        this.refresh();
        break;
      }
      case 'getNodeTree': {
        this.postNodeTree();
        break;
      }
      case 'addNode': {
        nodeConfig_1.addNode(null, tmp02.node || {});
        this.postNodeTree();
        break;
      }
      case 'updateNode': {
        nodeConfig_1.updateNode(null, tmp02.nodeId, tmp02.patch || {});
        if (nodeConfig_1.readConfig().activeNodeId === tmp02.nodeId) {
          await this.applyNodeConfigToRuntime(true);
        }
        this.postNodeTree();
        break;
      }
      case 'removeNode': {
        nodeConfig_1.removeNode(null, tmp02.nodeId);
        this.postNodeTree();
        break;
      }
      case 'addModel': {
        nodeConfig_1.addModel(null, tmp02.nodeId, tmp02.model || {});
        this.postNodeTree();
        break;
      }
      case 'updateModel': {
        nodeConfig_1.updateModel(null, tmp02.nodeId, tmp02.modelId, tmp02.patch || {});
        const cfg = nodeConfig_1.readConfig();
        if (cfg.activeNodeId === tmp02.nodeId && cfg.activeModelId === tmp02.modelId) {
          await this.applyNodeConfigToRuntime(true);
        }
        this.postNodeTree();
        break;
      }
      case 'removeModel': {
        nodeConfig_1.removeModel(null, tmp02.nodeId, tmp02.modelId);
        this.postNodeTree();
        break;
      }
      case 'switchActive': {
        if (tmp02.nodeId) {
          nodeConfig_1.setActive(null, tmp02.nodeId, tmp02.modelId || '');
        }
        const result = await this.applyNodeConfigToRuntime(true);
        this.postNodeTree();
        this.postToast(!result.merged || result.message.includes('失败') ? 'error' : 'success', result.message);
        break;
      }
      case 'importNodeConfig': {
        const src = String(tmp02.source || 'claude').trim().toLowerCase();
        const imp = externalConfigImporter_1.readExternalUserConfig(src);
        if (!imp.ok) {
          const msg = imp.error || '导入失败';
          this.postActionState('config', 'error', msg);
          await vscode.window.showErrorMessage(msg);
          break;
        }
        const protocol = imp.source === 'codex' ? 'openai' : imp.source === 'claude' ? 'anthropic' : '';
        nodeConfig_1.updateNode(null, tmp02.nodeId, {
          host: imp.host || '',
          apiKey: imp.apiKey || '',
          protocol,
        });
        if (imp.model) {
          const node = nodeConfig_1.readConfig().nodes.find(n => n.id === tmp02.nodeId);
          if (node && (!node.models || !node.models.find(m => m.name === imp.model))) {
            nodeConfig_1.addModel(null, tmp02.nodeId, {
              id: 'model_' + Date.now().toString(36),
              name: imp.model,
              thinkingEffort: imp.thinkingEffort || '',
            });
          }
        }
        this.postNodeTree();
        this.postActionState('config', 'success', '已从 ' + imp.label + ' 导入到当前节点');
        if (imp.apiKey && imp.host) {
          try {
            const resp = await modelFetcher_1.fetchModelsFromGateway(imp.apiKey, imp.host, this.proxyManager);
            const ids = modelFetcher_1.flattenModelIds(resp);
            const node2 = nodeConfig_1.readConfig().nodes.find(n => n.id === tmp02.nodeId);
            const existing = new Set((node2 && node2.models || []).map(m => m.name));
            let added = 0;
            for (const id of ids) {
              if (id && !existing.has(id)) {
                nodeConfig_1.addModel(null, tmp02.nodeId, { id: 'model_' + Date.now().toString(36) + added, name: id });
                added++;
              }
            }
            this.postNodeTree();
            this.view?.webview.postMessage({ type: 'nodeModelsFetched', nodeId: tmp02.nodeId, data: ids });
          } catch (e) {
            this.view?.webview.postMessage({ type: 'nodeModelsFetched', nodeId: tmp02.nodeId, error: modelFetcher_1.formatModelFetchError(e) });
          }
        }
        break;
      }
      case 'readExternalConfig': {
        const src = String(tmp02.source || 'claude').trim().toLowerCase();
        const imp = externalConfigImporter_1.readExternalUserConfig(src);
        if (!imp.ok) {
          this.view?.webview.postMessage({
            type: 'externalConfigRead',
            ok: false,
            error: imp.error || '导入失败',
          });
          this.postActionState('config', 'error', imp.error || '导入失败');
          break;
        }
        const protocol = imp.source === 'codex' ? 'openai' : imp.source === 'claude' ? 'anthropic' : '';
        this.view?.webview.postMessage({
          type: 'externalConfigRead',
          ok: true,
          source: imp.source,
          host: imp.host || '',
          apiKey: imp.apiKey || '',
          model: imp.model || '',
          thinkingEffort: imp.thinkingEffort || '',
          protocol,
          label: imp.label,
        });
        break;
      }
      case 'fetchNodeModels': {
        const node = nodeConfig_1.readConfig().nodes.find(n => n.id === tmp02.nodeId);
        if (!node || !node.apiKey || !node.host) {
          this.view?.webview.postMessage({ type: 'nodeModelsFetched', nodeId: tmp02.nodeId, error: '请先填写 Base URL 和 API Key' });
          this.postActionState('config', 'error', '请先填写 Base URL 和 API Key');
          break;
        }
        try {
          const resp = await modelFetcher_1.fetchModelsFromGateway(node.apiKey, node.host, this.proxyManager);
          const ids = modelFetcher_1.flattenModelIds(resp);
          // 把拉取的模型批量加入节点（去重）
          const existing = new Set((node.models || []).map(m => m.name));
          let added = 0;
          for (const id of ids) {
            if (id && !existing.has(id)) {
              nodeConfig_1.addModel(null, tmp02.nodeId, { id: 'model_' + Date.now().toString(36) + added, name: id });
              added++;
            }
          }
          this.postNodeTree();
          this.view?.webview.postMessage({ type: 'nodeModelsFetched', nodeId: tmp02.nodeId, data: ids });
          this.postActionState('config', 'success', '已拉取 ' + ids.length + ' 个模型' + (added > 0 ? '，新增 ' + added + ' 个；点击模型即可切换' : ''));
        } catch (e) {
          const msg = modelFetcher_1.formatModelFetchError(e);
          this.view?.webview.postMessage({ type: 'nodeModelsFetched', nodeId: tmp02.nodeId, error: msg });
          this.postActionState('config', 'error', msg);
        }
        break;
      }
      case 'testNodeModel': {
        const node = nodeConfig_1.readConfig().nodes.find(n => n.id === tmp02.nodeId);
        const modelName = String(tmp02.modelName || '').trim();
        if (!node || !node.apiKey || !node.host || !modelName) {
          this.postActionState('config', 'error', '缺少节点配置或模型名');
          break;
        }
        try {
          const resp = await modelFetcher_1.fetchModelsFromGateway(node.apiKey, node.host, this.proxyManager);
          const ids = modelFetcher_1.flattenModelIds(resp);
          if (modelFetcher_1.modelIdMatches(ids, modelName)) {
            this.postActionState('config', 'success', '测试通过：' + modelName + ' 可用（共 ' + ids.length + ' 个模型）');
          } else {
            this.postActionState('config', 'error', '测试失败：' + modelName + ' 不在可用模型列表中');
          }
        } catch (e) {
          this.postActionState('config', 'error', '测试失败：' + modelFetcher_1.formatModelFetchError(e));
        }
        break;
      }
      case 'saveNodeConfig': {
        await this.applyNodeConfigToRuntime(tmp02.silent === true);
        break;
      }
      case 'getProfiles': {
        this.postProfileList();
        break;
      }
      case 'createProfile': {
        const envConfig = this.proxyManager.readEnvConfig();
        const created = profileStore_1.createProfile(null, envConfig);
        this.editingProfileId = created.id;
        this.postActionState('config', 'success', '已创建新方案：' + created.name);
        this.postProfileList();
        // 新建后自动打开编辑器
        const scoped = this.getModeScopedConfig(profileStore_1.projectToEnvConfig(created));
        if (this.view) {
          this.view.webview.postMessage({
            type: 'openProfileEditor',
            profileId: created.id,
            profileName: created.name,
            isActive: created.id === profileStore_1.listProfiles(envConfig).activeId,
            config: scoped,
          });
        }
        this.refresh();
        break;
      }
      case 'editProfile': {
        const pid = tmp02.profileId;
        const envConfig = this.proxyManager.readEnvConfig();
        const profile = profileStore_1.getProfileById(pid, envConfig);
        if (!profile) {
          this.postActionState('config', 'error', '方案不存在');
          break;
        }
        this.editingProfileId = pid;
        const scoped = this.getModeScopedConfig(profileStore_1.projectToEnvConfig(profile));
        if (this.view) {
          const activeId = profileStore_1.listProfiles(envConfig).activeId;
          this.view.webview.postMessage({
            type: 'openProfileEditor',
            profileId: profile.id,
            profileName: profile.name,
            isActive: profile.id === activeId,
            config: scoped,
          });
        }
        this.postProfileList();
        break;
      }
      case 'closeProfileEditor': {
        this.editingProfileId = null;
        this.postProfileList();
        break;
      }
      case 'resetProfileEditor': {
        const pid = tmp02.profileId || this.editingProfileId;
        if (!pid) break;
        const envConfig = this.proxyManager.readEnvConfig();
        const profile = profileStore_1.getProfileById(pid, envConfig);
        if (!profile) {
          this.postActionState('config', 'error', '方案不存在');
          break;
        }
        const scoped = this.getModeScopedConfig(profileStore_1.projectToEnvConfig(profile));
        if (this.view) {
          const activeId = profileStore_1.listProfiles(envConfig).activeId;
          this.view.webview.postMessage({
            type: 'openProfileEditor',
            profileId: profile.id,
            profileName: profile.name,
            isActive: profile.id === activeId,
            config: scoped,
            reset: true,
          });
        }
        this.postActionState('config', 'success', '已重置到方案已保存的值');
        break;
      }
      case 'activateProfile': {
        const pid = tmp02.profileId;
        const envConfig = this.proxyManager.readEnvConfig();
        const profile = profileStore_1.getProfileById(pid, envConfig);
        if (!profile) {
          this.postActionState('config', 'error', '方案不存在');
          break;
        }
        const nodeCfg = nodeConfig_1.readConfig();
        const activeRuntime = nodeConfig_1.getActiveRuntime(nodeCfg);
        if (activeRuntime) {
          profileStore_1.activateProfile(pid, envConfig);
          this.editingProfileId = pid;
          await this.applyNodeConfigToRuntime(false);
          this.postProfileList();
          this.refresh();
          break;
        }
        const validationError = this.validateByokSlots(
          profileStore_1.projectToEnvConfig(profile)
        ).join('；');
        if (validationError) {
          this.postActionState('config', 'error', '该方案未配齐：' + validationError);
          await vscode.window.showErrorMessage('该方案未配齐：' + validationError);
          break;
        }
        profileStore_1.activateProfile(pid, envConfig);
        this.editingProfileId = pid;
        await this.applyProfileToRuntime(profile, false);
        this.postProfileList();
        this.refresh();
        break;
      }
      case 'renameProfile': {
        const pid = tmp02.profileId;
        const envConfig = this.proxyManager.readEnvConfig();
        const profile = profileStore_1.getProfileById(pid, envConfig);
        if (!profile) {
          this.postActionState('config', 'error', '方案不存在');
          break;
        }
        const newName = await vscode.window.showInputBox({
          prompt: '重命名方案',
          value: profile.name,
          validateInput: (v) => (v && v.trim() ? null : '名称不能为空'),
        });
        if (newName && newName.trim()) {
          profileStore_1.renameProfile(pid, newName, envConfig);
          this.postActionState('config', 'success', '已重命名为：' + newName.trim());
          this.postProfileList();
        }
        break;
      }
      case 'duplicateProfile': {
        const pid = tmp02.profileId;
        const envConfig = this.proxyManager.readEnvConfig();
        const dup = profileStore_1.duplicateProfile(pid, envConfig);
        this.editingProfileId = dup.id;
        this.postActionState('config', 'success', '已复制为：' + dup.name);
        this.postProfileList();
        break;
      }
      case 'deleteProfile': {
        const pid = tmp02.profileId;
        const envConfig = this.proxyManager.readEnvConfig();
        const list = profileStore_1.listProfiles(envConfig);
        if (list.profiles.length <= 1) {
          this.postActionState('config', 'error', '至少需要保留一个方案');
          await vscode.window.showWarningMessage('至少需要保留一个方案，无法删除');
          break;
        }
        const profile = profileStore_1.getProfileById(pid, envConfig);
        const confirm = await vscode.window.showWarningMessage(
          '确认删除方案「' + (profile ? profile.name : pid) + '」？此操作不可撤销',
          { modal: true },
          '删除'
        );
        if (confirm !== '删除') {
          break;
        }
        const wasActive = pid === list.activeId;
        const result = profileStore_1.deleteProfile(pid, envConfig);
        if (this.editingProfileId === pid) {
          this.editingProfileId = result.newActiveId;
        }
        if (wasActive) {
          const newActive = profileStore_1.getProfileById(result.newActiveId, envConfig);
          await this.applyProfileToRuntime(newActive, false);
          this.postActionState('config', 'success', '已删除并切换到：' + newActive.name);
        } else {
          this.postActionState('config', 'success', '已删除方案');
        }
        this.postProfileList();
        this.refresh();
        break;
      }
      case 'reloadIdeWindow': {
        await (0, reloadWorkbench_1.reloadWorkbenchWindow)();
        break;
      }
      case 'openPromptTemplates': {
        try {
          await this.openPromptTemplatePicker();
        } catch (tmp03) {
          const tmp1 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
          this.postActionState('config', 'error', '提示词操作失败：' + tmp1);
        }
        break;
      }
      case 'openSystemPrompt': {
        try {
          const tmp03 = this.proxyManager.readEnvConfig();
          const tmp1 =
            typeof tmp02.path === 'string' && tmp02.path.trim()
              ? tmp02.path.trim()
              : './prompts/system-prompt.md';
          const tmp2 = {
            ...tmp03,
          };
          tmp2.SYSTEM_PROMPT_OVERRIDE = 'true';
          tmp2.SYSTEM_PROMPT_PATH = tmp1;
          this.proxyManager.writeEnvConfig(tmp2);
          await this.openSystemPromptEditor(tmp1);
          this.postActionState('config', 'success', '已启用并打开自定义提示词文件');
          await this.restartProxyForPromptConfigIfRunning();
          this.refresh();
        } catch (tmp03) {
          const tmp1 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
          this.postActionState('config', 'error', '打开提示词失败：' + tmp1);
        }
        break;
      }
      case 'setAutoStartProxy': {
        await this.context.globalState.update(KEY_AUTO_START_PROXY, tmp02.value === true);
        break;
      }
      case 'pickerAction': {
        try {
          if (tmp02.pickerId === 'promptTemplate') {
            await this.executePromptTemplateAction(tmp02);
          }
        } catch (tmp03) {
          const tmp1 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
          this.postActionState('config', 'error', '操作失败：' + tmp1);
        }
        break;
      }
      case 'clearCache': {
        try {
          await this.clearWindsurfCache();
        } catch (tmp03) {
          const tmp1 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
          this.postActionState('config', 'error', '清理缓存失败：' + tmp1);
        }
        break;
      }
      case 'importExternalConfig': {
        const tmp03 = [1, 2, 3, 4].includes(Number(tmp02.slot)) ? Number(tmp02.slot) : 1;
        const tmp04 = String(tmp02.source || 'claude')
          .trim()
          .toLowerCase();
        const tmp1 = externalConfigImporter_1.readExternalUserConfig(tmp04);
        if (!tmp1.ok) {
          const tmp2 = tmp1.error || '导入失败';
          this.postActionState('config', 'error', tmp2);
          await vscode.window.showErrorMessage(tmp2);
          break;
        }
        const tmp5 = 'BYOK' + tmp03 + '_';
        // 根据导入来源自动同步协议：Claude→anthropic / Codex(GPT)→openai
        const importedProtocol =
          tmp1.source === 'codex' ? 'openai' : tmp1.source === 'claude' ? 'anthropic' : '';
        const tmp6 = {
          [tmp5 + 'ANTHROPIC_API_HOST']: tmp1.host || '',
          [tmp5 + 'ANTHROPIC_API_KEY']: tmp1.apiKey || '',
          [tmp5 + 'OPENAI_API_HOST']: tmp1.host || '',
          [tmp5 + 'OPENAI_API_KEY']: tmp1.apiKey || '',
          [tmp5 + 'MODEL']: tmp1.model || '',
          [tmp5 + 'THINKING_EFFORT']: tmp1.thinkingEffort || '',
          [tmp5 + 'PROTOCOL']: importedProtocol,
        };
        const tmp7 = this.writeModeScopedConfig(tmp6);
        const tmp8 = this.getRuntimeConfigForCurrentMode(tmp7);
        const tmp9 = this.proxyManager.getStatus();
        let tmp10 = '';
        if (tmp9.running) {
          const tmp11 = await this.proxyManager.reloadRuntimeConfig(tmp8, {
            hybridPort: tmp9.hybridPort,
            inferencePort: tmp9.inferencePort,
          });
          if (!tmp11.ok) {
            tmp10 = '；代理热更新失败：' + tmp11.errors.join('；');
          }
        }
        const tmp3 =
          '已从 ' +
          tmp1.label +
          ' 导入并保存到 BYOK #' +
          tmp03 +
          '（' +
          tmp1.filePath +
          '）' +
          (tmp1.model ? '' : '；正在加载模型列表') +
          tmp10;
        this.view?.webview.postMessage({
          type: 'externalConfigImported',
          slot: tmp03,
          host: tmp1.host || '',
          apiKey: tmp1.apiKey || '',
          model: tmp1.model || '',
          thinkingEffort: tmp1.thinkingEffort || '',
          protocol: importedProtocol,
          message: tmp3,
        });
        if (tmp1.apiKey && tmp1.host) {
          this.view?.webview.postMessage({
            type: 'modelList',
            slot: tmp03,
            loading: true,
          });
          try {
            const tmp11 = await modelFetcher_1.fetchModelsFromGateway(
              tmp1.apiKey,
              tmp1.host,
              this.proxyManager
            );
            this.view?.webview.postMessage({
              type: 'modelList',
              slot: tmp03,
              data: tmp11,
            });
          } catch (tmp11) {
            this.view?.webview.postMessage({
              type: 'modelList',
              slot: tmp03,
              error: modelFetcher_1.formatModelFetchError(tmp11),
            });
          }
        }
        this.postActionState('config', 'success', tmp3);
        break;
      }
      case 'fetchModels': {
        const tmp03 = [1, 2, 3, 4].includes(Number(tmp02.slot)) ? Number(tmp02.slot) : 1;
        this.view?.webview.postMessage({
          type: 'modelList',
          slot: tmp03,
          loading: true,
        });
        try {
          const tmp04 = modelFetcher_1.resolveModelFetchCredentials(tmp02.apiKey, tmp02.baseUrl);
          const tmp1 = await modelFetcher_1.fetchModelsFromGateway(
            tmp04.apiKey,
            tmp04.baseUrl,
            this.proxyManager
          );
          const tmp2 = {
            type: 'modelList',
            slot: tmp03,
            data: tmp1,
          };
          this.view?.webview.postMessage(tmp2);
        } catch (tmp04) {
          const tmp1 = modelFetcher_1.formatModelFetchError(tmp04);
          const tmp2 = {
            type: 'modelList',
            slot: tmp03,
            error: tmp1,
          };
          this.view?.webview.postMessage(tmp2);
          await vscode.window.showErrorMessage(tmp1);
        }
        break;
      }
      case 'applyPatch': {
        const tmp03 = this.proxyManager.getStatus();
        const tmp1 = patchManager_1.PatchManager.loopbackApiUrl(tmp03.hybridPort);
        const tmp2 = patchManager_1.PatchManager.loopbackApiUrl(tmp03.inferencePort);
        const tmp3 = tmp02.apiUrl || tmp1;
        const tmp4 = tmp02.inferenceUrl || tmp2;
        const tmp5 = tmp02.extJsPath || this.getStoredPatchExtensionPath() || undefined;
        const tmp6 = patchManager_1.PatchManager.applyWithCustomUrls(tmp3, tmp4, tmp5);
        const tmp7 =
          tmp6.applied > 0
            ? '补丁已应用 ' +
              tmp6.applied +
              '/' +
              (tmp6.applied + tmp6.skipped + tmp6.failed) +
              '，需重载窗口生效'
            : tmp6.skipped > 0
              ? '所有补丁已是最新'
              : '未找到可应用的补丁';
        const tmp8 = '重载窗口';
        if (tmp6.applied > 0) {
          this.postActionState('patch', 'success', tmp7);
          const tmp04 = await vscode.window.showInformationMessage(tmp7, tmp8);
          if (tmp04 === tmp8) {
            await (0, reloadWorkbench_1.reloadWorkbenchWindow)();
          }
        } else {
          this.postActionState('patch', tmp6.skipped > 0 ? 'success' : 'error', tmp7);
          await vscode.window.showInformationMessage(tmp7);
        }
        this.refresh();
        break;
      }
      case 'refreshPatchStatus':
        this.postActionState('patch', 'success', '补丁状态已刷新');
        this.refresh();
        break;
      case 'locateExtJs': {
        const tmp03 = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          filters: {
            JavaScript: ['js'],
          },
          title: '选择 Devin Desktop extension.js',
        });
        if (tmp03 && tmp03.length > 0) {
          await this.setStoredPatchExtensionPath(tmp03[0].fsPath);
          this.postActionState('patch', 'success', '已选择 extension.js');
          this.refresh();
        } else {
          this.postActionState('patch', 'success', '已取消选择');
        }
        break;
      }
      case 'clearExtJsPath':
        await this.setStoredPatchExtensionPath(undefined);
        this.postActionState('patch', 'success', '已切回自动检测');
        this.refresh();
        break;
      case 'revertPatch': {
        const tmp03 = patchManager_1.PatchManager.revert(
          tmp02.extJsPath || this.getStoredPatchExtensionPath() || undefined
        );
        const tmp1 = '重载窗口';
        if (tmp03) {
          this.postActionState('patch', 'success', '补丁已还原，需重载窗口生效');
          const tmp04 = await vscode.window.showInformationMessage(
            '补丁已还原，需重载窗口生效',
            tmp1
          );
          if (tmp04 === tmp1) {
            await (0, reloadWorkbench_1.reloadWorkbenchWindow)();
          }
        } else {
          this.postActionState('patch', 'error', '未找到备份文件');
          await vscode.window.showInformationMessage('未找到备份文件');
        }
        this.refresh();
        break;
      }
      case 'getStatus': {
        await this.postStatusSnapshot();
        break;
      }
    }
  }
  getHtml() {
    const tmp02 = this.proxyManager.getStatus();
    const tmp1 = this.getPatchStatus();
    const tmp2 = this.getModeScopedConfig(this.proxyManager.readEnvConfig());
    const tmp3 = patchManager_1.PatchManager.loopbackApiUrl(tmp02.hybridPort);
    const tmp4 = patchManager_1.PatchManager.loopbackApiUrl(tmp02.inferencePort);
    const tmp5 = this.context.globalState.get(KEY_AUTO_START_PROXY) === true;
    const tmp6 = tmp1.path
      ? tmp1.path.replace(/\\/g, '/').split('/').slice(-4).join('/')
      : '未找到';
    const tmp7 = tmp1.patches.filter((arg0) => arg0.status === 'applied').length;
    const tmp8 = this.proxyManager.getSystemPromptConfigPath(tmp2);
    const tmp9 = tmp2.SYSTEM_PROMPT_OVERRIDE === 'true';
    const tmp10 = getWebviewNonce();
    const tmp11 = this.view?.webview.cspSource ?? '';
    const tmp12 = this.view.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'webviews', 'sidebar.js')
    );
    const tmp12a = this.view.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'webviews', 'dist', 'sidebar.css')
    );
    const tmp13 = 'var(--vscode-button-background,#0d9488)';
    const tmp14 = 'var(--vscode-button-hoverBackground,#0f766e)';
    const tmp15 = 'var(--vscode-textLink-foreground,#5eead4)';
    const tmp16 = 'var(--vscode-descriptionForeground,#71717a)';
    const tmp17 = 'var(--vscode-disabledForeground,#52525b)';
    const tmp18 = 'var(--vscode-sideBar-background,var(--vscode-editor-background,#1a1a2e))';
    const tmp19 = 'var(--vscode-editorWidget-background,var(--vscode-sideBar-background,#16162a))';
    const tmp20 = 'var(--vscode-input-background,var(--vscode-editor-background,#0f0f1e))';
    const tmp21 = 'var(--vscode-panel-border,var(--vscode-widget-border,#2a2a4a))';
    const tmp22 = 'var(--vscode-foreground,#d4d4d8)';
    const tmp23 = 'var(--vscode-input-foreground,var(--vscode-foreground,#e4e4e7))';
    const tmp24 = "'Cascadia Code','Fira Code',monospace";
    // 注意：以下 BYOK 字段传入原始值，转义统一由 sidebarTemplate 数据准备层处理，避免双重转义
    const tmp25 = tmp2.BYOK1_ANTHROPIC_API_HOST || tmp2.ANTHROPIC_API_HOST || '';
    const tmp26 = tmp2.BYOK1_ANTHROPIC_API_KEY || tmp2.ANTHROPIC_API_KEY || '';
    const tmp27 = tmp2.BYOK1_MODEL || tmp2.DEFAULT_MODEL || '';
    const tmp28 = tmp2.BYOK2_ANTHROPIC_API_HOST || '';
    const tmp29 = tmp2.BYOK2_ANTHROPIC_API_KEY || '';
    const tmp30 = tmp2.BYOK2_MODEL || '';
    const tmp31 = tmp2.BYOK1_THINKING_EFFORT || tmp2.OPENAI_REASONING_EFFORT || '';
    const tmp32 = tmp2.BYOK2_THINKING_EFFORT || '';
    const tmp33 = Object.prototype.hasOwnProperty.call(tmp2, 'OPENAI_REASONING_EFFORT')
      ? tmp2.OPENAI_REASONING_EFFORT
      : '';
    const tmp33a = tmp2.BYOK3_ANTHROPIC_API_HOST || '';
    const tmp33b = tmp2.BYOK3_ANTHROPIC_API_KEY || '';
    const tmp33c = tmp2.BYOK3_MODEL || '';
    const tmp33d = tmp2.BYOK3_THINKING_EFFORT || '';
    const tmp33e = tmp2.BYOK4_ANTHROPIC_API_HOST || '';
    const tmp33f = tmp2.BYOK4_ANTHROPIC_API_KEY || '';
    const tmp33g = tmp2.BYOK4_MODEL || '';
    const tmp33h = tmp2.BYOK4_THINKING_EFFORT || '';
    const tmp34 = tmp7 === tmp1.patches.length ? 'badge-ok' : 'badge-warn';
    const tmp35 = tmp7 === tmp1.patches.length ? '已就绪' : '需安装';
    const tmp36 =
      this.logLines.length === 0
        ? '<div class="log-line dim">等待日志...</div>'
        : this.logLines
            .slice(-30)
            .map((arg0) => {
              const tmp110 = /→.*GetChatMessage|GetStreamingCompletions|GetEmbeddings/.test(arg0)
                ? ' hi'
                : /err|stderr/i.test(arg0)
                  ? ' err'
                  : '';
              return '<div class="log-line' + tmp110 + '">' + esc(arg0) + '</div>';
            })
            .join('');

    return sidebarTemplate_1.renderSidebarHtml({
      nonce: tmp10,
      cspSource: tmp11,
      scriptUri: tmp12,
      cssUri: tmp12a,
      // 原始 tmp 变量（保持向后兼容）
      tmp02,
      tmp1,
      tmp2,
      tmp3,
      tmp4,
      tmp5,
      tmp6,
      tmp7,
      tmp8,
      tmp9,
      tmp10,
      tmp11,
      tmp12,
      tmp12a,
      tmp13,
      tmp14,
      tmp15,
      tmp16,
      tmp17,
      tmp18,
      tmp19,
      tmp20,
      tmp21,
      tmp22,
      tmp23,
      tmp24,
      tmp25,
      tmp26,
      tmp27,
      tmp28,
      tmp29,
      tmp30,
      tmp31,
      tmp32,
      tmp33,
      tmp33a,
      tmp33b,
      tmp33c,
      tmp33d,
      tmp33e,
      tmp33f,
      tmp33g,
      tmp33h,
      tmp34,
      tmp35,
      tmp36,
    });
  }
}
exports.SidebarProvider = SidebarProvider;
function buildThinkingEffortOptions(arg0, arg1) {
  return thinkingEffort_1.buildThinkingEffortOptionsHtml(arg0, arg1);
}
function esc(arg0) {
  return sidebarHtml_1.esc(arg0);
}
function stripProtoServer(arg0) {
  return gatewayUrl_1.stripProtoServer(arg0);
}
function shouldUseHttpGateway(arg0) {
  return gatewayUrl_1.shouldUseHttpGateway(arg0);
}
function ensureGatewayUrl(arg0) {
  return gatewayUrl_1.ensureGatewayUrl(arg0);
}
function formatUptime(arg0) {
  return sidebarHtml_1.formatUptime(arg0);
}
