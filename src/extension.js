'use strict';

const vscode = require('vscode');
const { SidebarProvider } = require('./providers/sidebarProvider');
const { ProxyManager } = require('./managers/proxyManager');
const { PatchManager } = require('./managers/patchManager');
const { reloadWorkbenchWindow } = require('./utils/reloadWorkbench');
const { getDeviceId, getClientVersion } = require('./utils/integrity');
const { checkForUpdate } = require('./services/updateChecker');

let proxyManager;
const KEY_AUTO_START_PROXY = 'devin-model-pro.autoStartProxy';
const LEGACY_KEY_AUTO_START_PROXY = 'windsurf-byok-plus.autoStartProxy';
const LEGACY_KEY_AUTO_START_PROXY_2 = 'devin-model-pro.autoStartProxy';
const KEY_ACCOUNT_MODE = 'devin-model-pro.accountMode';

// 首次启动选模式：通过 sidebar 自定义 modal 选，不用 vscode 系统弹窗
// sidebar 在 resolveWebviewView 后才 ready，没 ready 时轮询等待
async function ensureAccountModeSelected(context, sidebar) {
  const current = context.globalState.get(KEY_ACCOUNT_MODE);
  if (current === 'free' || current === 'pro') return current;
  // 等 sidebar ready
  for (let i = 0; i < 50; i++) {
    if (sidebar && sidebar.view && sidebar.view.webview) break;
    await new Promise(r => setTimeout(r, 100));
  }
  if (!sidebar || !sidebar.view || !sidebar.view.webview) return null;
  return new Promise((resolve) => {
    const onChoice = (mode) => {
      context.globalState.update(KEY_ACCOUNT_MODE, mode).then(() => resolve(mode));
    };
    sidebar.promptAccountModeChoice(onChoice);
  });
}

function activate(context) {
  try {
    const extensionPath = context.extensionPath;
    let deviceId = '';
    let clientVersion = '';
    try { deviceId = getDeviceId(context) || ''; } catch (e) { console.error('[Devin Model Pro] getDeviceId 失败:', e); }
    try { clientVersion = getClientVersion(extensionPath) || ''; } catch (e) { console.error('[Devin Model Pro] getClientVersion 失败:', e); }
    proxyManager = new ProxyManager(context, deviceId, clientVersion);
    const sidebar = new SidebarProvider(context, proxyManager, null);

    if (context.globalState.get(KEY_AUTO_START_PROXY) === undefined && context.globalState.get(LEGACY_KEY_AUTO_START_PROXY) === true) {
      context.globalState.update(KEY_AUTO_START_PROXY, true);
    }
    if (context.globalState.get(KEY_AUTO_START_PROXY) === undefined && context.globalState.get(LEGACY_KEY_AUTO_START_PROXY_2) === true) {
      context.globalState.update(KEY_AUTO_START_PROXY, true);
    }

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider('devin-model-pro.sidebar', sidebar),
      vscode.commands.registerCommand('devin-model-pro.startProxy', async () => {
        const mode = await ensureAccountModeSelected(context, sidebar);
        if (!mode) {
          vscode.window.showWarningMessage('未选择账号类型，代理未启动');
          return;
        }
        const runtime = sidebar.getRuntimeConfigForCurrentMode();
        runtime.ACCOUNT_MODE = mode;
        const ok = await proxyManager.start('both', runtime);
        if (ok) {
          await sidebar.ensurePatchAppliedAfterProxyStart(true);
          vscode.window.showInformationMessage('Devin Model Pro 已启动');
          sidebar.refresh();
        }
      }),
      vscode.commands.registerCommand('devin-model-pro.stopProxy', () => {
        proxyManager.stop();
        vscode.window.showInformationMessage('Devin Model Pro 已停止');
        sidebar.refresh();
      }),
      vscode.commands.registerCommand('devin-model-pro.applyPatch', async () => {
        const status = proxyManager.getStatus();
        const result = PatchManager.applyWithCustomUrls(
          PatchManager.loopbackApiUrl(status.hybridPort),
          PatchManager.loopbackApiUrl(status.inferencePort)
        );
        if (result.applied > 0) {
          vscode.window.showInformationMessage('已应用 ' + result.applied + ' 个补丁，需重启 Devin Desktop', '重启 Devin').then(choice => {
            if (choice === '重启 Devin') reloadWorkbenchWindow();
          });
        } else if (result.skipped > 0) {
          vscode.window.showInformationMessage('所有补丁已是最新');
        } else {
          vscode.window.showWarningMessage('未找到可应用的补丁，可能 Devin Desktop 版本不兼容');
        }
        sidebar.refresh();
      }),
      vscode.commands.registerCommand('devin-model-pro.revertPatch', async () => {
        if (PatchManager.revert()) {
          vscode.window.showInformationMessage('补丁已还原，需重启 Devin Desktop');
        } else {
          vscode.window.showWarningMessage('未找到备份文件');
        }
        sidebar.refresh();
      }),
      vscode.commands.registerCommand('devin-model-pro.reloadWorkbench', () => reloadWorkbenchWindow()),
      vscode.commands.registerCommand('devin-model-pro.checkForUpdates', () => {
        if (sidebar && sidebar.handleCheckForUpdates) sidebar.handleCheckForUpdates();
      }),
      vscode.commands.registerCommand('devin-model-pro.switchAccountMode', () => {
        if (sidebar && sidebar.handleSwitchAccountMode) sidebar.handleSwitchAccountMode();
      })
    );

    if (context.globalState.get(KEY_AUTO_START_PROXY) === true) {
      setTimeout(() => {
        ensureAccountModeSelected(context, sidebar).then(mode => {
          if (!mode) {
            console.log('[Devin Model Pro] 未选择账号类型，跳过自动启动');
            return;
          }
          const runtime = sidebar.getRuntimeConfigForCurrentMode();
          runtime.ACCOUNT_MODE = mode;
          return proxyManager.start('both', runtime).then(async ok => {
            if (ok) {
              // 自动启动时静默打补丁，打成功则自动重载窗口让补丁生效
              const before = sidebar.getPatchStatus();
              const needPatch = before.patches.some(p => p.status !== 'applied');
              if (needPatch && before.path) {
                await sidebar.ensurePatchAppliedAfterProxyStart(false);
                const after = sidebar.getPatchStatus();
                const stillNeed = after.patches.some(p => p.status !== 'applied');
                if (!stillNeed) {
                  reloadWorkbenchWindow();
                  return;
                }
              }
              sidebar.refresh();
            }
          });
        }).catch(e => console.error('[Devin Model Pro] 自动启动失败:', e));
      }, 2000);
    }
    console.log('[Devin Model Pro] 扩展已就绪');

    // 启动后静默检查更新（10 秒后，避免阻塞启动），有新版才通知 sidebar
    setTimeout(() => {
      checkForUpdate(context).then(result => {
        if (result && result.hasUpdate && sidebar && sidebar.notifyUpdateAvailable) {
          sidebar.notifyUpdateAvailable(result);
        }
      }).catch(e => {
        console.error('[Devin Model Pro] 静默更新检查失败:', e);
      });
    }, 10000);
  } catch (e) {
    console.error('[Devin Model Pro] activate 失败:', e);
    vscode.window.showErrorMessage('Devin Model Pro 启动失败: ' + (e instanceof Error ? e.message : String(e)));
  }
}

function deactivate() {
  try { proxyManager?.dispose(); } catch {}
}

exports.activate = activate;
exports.deactivate = deactivate;
