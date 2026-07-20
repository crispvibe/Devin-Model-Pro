'use strict';

const vscode = require('vscode');
const { SidebarProvider } = require('./providers/sidebarProvider');
const { ProxyManager } = require('./managers/proxyManager');
const { PatchManager } = require('./managers/patchManager');
const { reloadWorkbenchWindow } = require('./utils/reloadWorkbench');
const { getDeviceId, getClientVersion } = require('./utils/integrity');
const { checkForUpdate } = require('./services/updateChecker');

let proxyManager;
let activateTimers = [];
const KEY_AUTO_START_PROXY = 'devin-model-pro.autoStartProxy';
const LEGACY_KEY_AUTO_START_PROXY = 'windsurf-byok-plus.autoStartProxy';
const LEGACY_KEY_AUTO_START_PROXY_2 = 'devin-model-pro.autoStartProxy';
const KEY_ACCOUNT_MODE = 'devin-model-pro.accountMode';
const KEY_PROXY_MODE = 'devin-model-pro.proxyMode'; // 'devin' | 'cascade'

async function ensureAccountModeSelected(context) {
  const current = context.globalState.get(KEY_ACCOUNT_MODE);
  if (current === 'free' || current === 'pro') return current;
  const choice = await vscode.window.showInformationMessage(
    '请选择你的 Devin 账号类型（决定注入哪个 SWE 版本）',
    { modal: true },
    'Free（注入 swe-1-6）',
    'Pro（注入 swe-1-7）'
  );
  if (choice === 'Free（注入 swe-1-6）') {
    await context.globalState.update(KEY_ACCOUNT_MODE, 'free');
    return 'free';
  }
  if (choice === 'Pro（注入 swe-1-7）') {
    await context.globalState.update(KEY_ACCOUNT_MODE, 'pro');
    return 'pro';
  }
  return null;
}

function getProxyMode(context) {
  const mode = context.globalState.get(KEY_PROXY_MODE);
  return mode === 'cascade' ? 'cascade' : 'devin';
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
        const mode = await ensureAccountModeSelected(context);
        if (!mode) {
          vscode.window.showWarningMessage('未选择账号类型，代理未启动');
          return;
        }
        const runtime = sidebar.getRuntimeConfigForCurrentMode();
        runtime.ACCOUNT_MODE = mode;
        runtime.PROXY_MODE = getProxyMode(context);
        const ok = await proxyManager.start('both', runtime);
        if (ok) {
          await sidebar.ensurePatchAppliedAfterProxyStart(true);
          vscode.window.showInformationMessage('Devin Model Pro 已启动');
          sidebar.refresh();
        }
      }),
      vscode.commands.registerCommand('devin-model-pro.stopProxy', () => {
        try {
          proxyManager.stop();
          vscode.window.showInformationMessage('Devin Model Pro 已停止');
        } catch (e) {
          vscode.window.showErrorMessage('停止代理失败: ' + (e instanceof Error ? e.message : String(e)));
        }
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
      vscode.commands.registerCommand('devin-model-pro.switchAccountMode', async () => {
        const choice = await vscode.window.showInformationMessage(
          '切换账号类型（需重启代理生效）',
          { modal: true },
          'Free（注入 swe-1-6）',
          'Pro（注入 swe-1-7）'
        );
        if (choice === 'Free（注入 swe-1-6）') {
          await context.globalState.update(KEY_ACCOUNT_MODE, 'free');
          if (proxyManager.getStatus().running) {
            proxyManager.stop();
            const runtime = sidebar.getRuntimeConfigForCurrentMode();
            runtime.ACCOUNT_MODE = 'free';
            runtime.PROXY_MODE = getProxyMode(context);
            const ok = await proxyManager.start('both', runtime);
            vscode.window.showInformationMessage(ok ? '已切换到 Free 模式，代理已重启' : '已切换到 Free 模式，但代理重启失败，请查看日志');
          } else {
            vscode.window.showInformationMessage('已切换到 Free 模式，下次启动代理生效');
          }
          sidebar.refresh();
        } else if (choice === 'Pro（注入 swe-1-7）') {
          await context.globalState.update(KEY_ACCOUNT_MODE, 'pro');
          if (proxyManager.getStatus().running) {
            proxyManager.stop();
            const runtime = sidebar.getRuntimeConfigForCurrentMode();
            runtime.ACCOUNT_MODE = 'pro';
            runtime.PROXY_MODE = getProxyMode(context);
            const ok = await proxyManager.start('both', runtime);
            vscode.window.showInformationMessage(ok ? '已切换到 Pro 模式，代理已重启' : '已切换到 Pro 模式，但代理重启失败，请查看日志');
          } else {
            vscode.window.showInformationMessage('已切换到 Pro 模式，下次启动代理生效');
          }
          sidebar.refresh();
        }
      }),
      vscode.commands.registerCommand('devin-model-pro.switchProxyMode', async () => {
        const current = getProxyMode(context);
        const choice = await vscode.window.showInformationMessage(
          '切换代理模式（需重启代理生效）\n当前: ' + (current === 'devin' ? 'DevinLocal' : 'Cascade'),
          { modal: true },
          'DevinLocal（Devin Desktop）',
          'Cascade（Windsurf IDE）'
        );
        const newMode = choice === 'Cascade（Windsurf IDE）' ? 'cascade' : (choice === 'DevinLocal（Devin Desktop）' ? 'devin' : null);
        if (!newMode || newMode === current) return;
        await context.globalState.update(KEY_PROXY_MODE, newMode);
        if (proxyManager.getStatus().running) {
          proxyManager.stop();
          const runtime = sidebar.getRuntimeConfigForCurrentMode();
          runtime.PROXY_MODE = newMode;
          const ok = await proxyManager.start('both', runtime);
          vscode.window.showInformationMessage(ok ? '已切换到 ' + (newMode === 'devin' ? 'DevinLocal' : 'Cascade') + ' 模式，代理已重启' : '已切换到 ' + (newMode === 'devin' ? 'DevinLocal' : 'Cascade') + ' 模式，但代理重启失败，请查看日志');
        } else {
          vscode.window.showInformationMessage('已切换到 ' + (newMode === 'devin' ? 'DevinLocal' : 'Cascade') + ' 模式，下次启动代理生效');
        }
        sidebar.refresh();
      })
    );

    if (context.globalState.get(KEY_AUTO_START_PROXY) === true) {
      activateTimers.push(setTimeout(() => {
        ensureAccountModeSelected(context).then(mode => {
          if (!mode) {
            console.log('[Devin Model Pro] 未选择账号类型，跳过自动启动');
            return;
          }
          const runtime = sidebar.getRuntimeConfigForCurrentMode();
          runtime.ACCOUNT_MODE = mode;
          runtime.PROXY_MODE = getProxyMode(context);
          return proxyManager.start('both', runtime).then(async ok => {
            if (ok) {
              // 自动启动时静默打补丁，打成功则自动重载窗口让补丁生效
              const before = sidebar.getPatchStatus();
              if (before.backupStale) {
                vscode.window.showWarningMessage('Devin 客户端已更新，正在重新创建备份并安装补丁。');
              }
              const needPatch = before.backupStale || before.patches.some(p => p.status !== 'applied');
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
      }, 2000));
    }
    console.log('[Devin Model Pro] 扩展已就绪');

    // 启动后静默检查更新（60 秒后，避免阻塞启动且等网络稳定），有新版才通知 sidebar
    activateTimers.push(setTimeout(() => {
      checkForUpdate(context).then(result => {
        if (result && result.hasUpdate && sidebar && sidebar.notifyUpdateAvailable) {
          sidebar.notifyUpdateAvailable(result);
        }
      }).catch(e => {
        console.error('[Devin Model Pro] 静默更新检查失败:', e);
      });
    }, 60000));
  } catch (e) {
    console.error('[Devin Model Pro] activate 失败:', e);
    vscode.window.showErrorMessage('Devin Model Pro 启动失败: ' + (e instanceof Error ? e.message : String(e)));
  }
}

function deactivate() {
  try {
    for (const t of activateTimers) clearTimeout(t);
    activateTimers = [];
    proxyManager?.dispose();
  } catch {}
}

exports.activate = activate;
exports.deactivate = deactivate;
exports.getProxyMode = getProxyMode;
exports.KEY_PROXY_MODE = KEY_PROXY_MODE;
