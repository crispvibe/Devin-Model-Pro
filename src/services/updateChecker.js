'use strict';

const vscode = require('vscode');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_OWNER = 'crispvibe';
const REPO_NAME = 'Devin-Model-Pro';
const RELEASES_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

function getCurrentVersion(context) {
  try {
    const pkg = require(path.join(context.extensionPath, 'package.json'));
    return String(pkg.version || '').trim();
  } catch (e) {
    return '';
  }
}

function compareVersions(a, b) {
  const pa = String(a || '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '').split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return da - db;
  }
  return 0;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'devin-model-pro-updater',
        'Accept': 'application/vnd.github+json',
      },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        fetchJson(res.headers.location).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`GitHub API 返回 ${res.statusCode}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('解析 GitHub 响应失败: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('请求超时')));
  });
}

function downloadFile(url, destPath, progressCb) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const req = https.get(url, {
      headers: { 'User-Agent': 'devin-model-pro-updater' },
      timeout: 60000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        file.close();
        fs.unlink(destPath, () => {});
        downloadFile(res.headers.location, destPath, progressCb).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        file.close();
        fs.unlink(destPath, () => {});
        reject(new Error(`下载失败 ${res.statusCode}`));
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      res.on('data', chunk => {
        received += chunk.length;
        if (progressCb && total) progressCb(received, total);
      });
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(destPath)));
    });
    req.on('error', (e) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(e);
    });
    req.on('timeout', () => req.destroy(new Error('下载超时')));
  });
}

// 纯检查，返回结构化结果，不弹任何 UI
async function checkForUpdate(context) {
  const current = getCurrentVersion(context);
  if (!current) return { error: '无法读取当前版本' };

  let release;
  try {
    release = await fetchJson(RELEASES_API);
  } catch (e) {
    return { error: e.message };
  }

  const tag = String(release.tag_name || '').replace(/^v/i, '').trim();
  if (!tag) return { error: 'GitHub 未返回有效版本号' };

  const hasUpdate = compareVersions(tag, current) > 0;
  const asset = (release.assets || []).find(a => /\.vsix$/i.test(a.name || ''));
  const releaseUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
  const notes = String(release.body || '').trim();

  return {
    current,
    latestVersion: tag,
    hasUpdate,
    downloadUrl: asset ? asset.browser_download_url : '',
    assetName: asset ? asset.name : '',
    releaseUrl,
    notes,
  };
}

// 下载并安装，通过 onProgress 推送进度
async function downloadAndInstall(latestVersion, downloadUrl, onProgress) {
  const tmpPath = path.join(os.tmpdir(), `devin-model-pro-${latestVersion}.vsix`);
  onProgress({ stage: 'downloading', percent: 0 });
  await downloadFile(downloadUrl, tmpPath, (received, total) => {
    const pct = Math.floor(received / total * 100);
    onProgress({ stage: 'downloading', percent: pct });
  });
  onProgress({ stage: 'installing' });
  try {
    await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(tmpPath));
  } catch (e) {
    throw new Error('安装失败: ' + e.message);
  }
  try { fs.unlink(tmpPath, () => {}); } catch (e) {}
  onProgress({ stage: 'done' });
  return true;
}

module.exports = {
  checkForUpdate,
  downloadAndInstall,
  compareVersions,
  getCurrentVersion,
};
