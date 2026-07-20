'use strict';

const vscode = require('vscode');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { URL } = require('node:url');

const REPO_OWNER = 'crispvibe';
const REPO_NAME = 'Devin-Model-Pro';
const RELEASES_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
// GitHub 镜像前缀（主 URL 失败后依次尝试），空字符串表示原始 URL
const MIRRORS = ['', 'https://ghproxy.com/', 'https://mirror.ghproxy.com/'];
const MAX_RETRIES = 3;
const RETRYABLE_CODES = new Set(['ECONNRESET', 'EPROTO', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE']);

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 把错误码翻译成给用户的提示
function describeError(e) {
  const code = e && e.code;
  const msg = e && e.message ? e.message : String(e);
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'DNS 解析失败，无法连接 GitHub（可能被墙或网络断开），建议用代理或手动下载';
  if (code === 'ECONNRESET' || code === 'EPROTO') return 'TLS 连接被重置（' + msg + '），GitHub 可能被墙，建议用代理或手动下载';
  if (code === 'ETIMEDOUT') return '连接超时，网络不稳定或 GitHub 被墙';
  if (code === 'ECONNREFUSED') return '连接被拒绝，检查代理设置';
  return msg;
}

// 单次请求（不重试），支持重定向相对路径
function fetchOnce(url, { headers = {}, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, timeout }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        // 重定向 location 可能是相对路径，转成绝对路径
        const nextUrl = new URL(res.headers.location, url).href;
        fetchOnce(nextUrl, { headers, timeout }).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('请求超时')));
  });
}

// 带重试的请求（指数退避 1s/2s/4s）
async function fetchWithRetry(url, options) {
  let lastErr;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await fetchOnce(url, options);
    } catch (e) {
      lastErr = e;
      const code = e.code || '';
      // 4xx 不重试
      if (/^HTTP 4\d\d$/.test(e.message)) throw e;
      // 不可重试的错误直接抛
      if (code && !RETRYABLE_CODES.has(code) && code !== 'ERR_HTTP_REQUEST_TIMEOUT') throw e;
      if (i < MAX_RETRIES - 1) await sleep(1000 * Math.pow(2, i));
    }
  }
  throw lastErr;
}

// 带镜像 fallback 的 JSON 请求
async function fetchJsonWithMirror(url, options) {
  let lastErr;
  for (const mirror of MIRRORS) {
    const fullUrl = mirror ? mirror + url : url;
    try {
      const body = await fetchWithRetry(fullUrl, options);
      return JSON.parse(body);
    } catch (e) {
      lastErr = e;
      // 4xx 不试其他镜像（如 404 在所有镜像都一样）
      if (/^HTTP 4\d\d$/.test(e.message)) throw e;
    }
  }
  throw lastErr;
}

// 带镜像 fallback 的文件下载
function downloadOnce(url, destPath, progressCb, headers = {}) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const req = https.get(url, { headers, timeout: 60000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        file.close();
        fs.unlink(destPath, () => {});
        const nextUrl = new URL(res.headers.location, url).href;
        downloadOnce(nextUrl, destPath, progressCb, headers).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        file.close();
        fs.unlink(destPath, () => {});
        reject(new Error(`HTTP ${res.statusCode}`));
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

async function downloadWithMirror(url, destPath, progressCb, headers) {
  let lastErr;
  for (const mirror of MIRRORS) {
    const fullUrl = mirror ? mirror + url : url;
    try {
      return await downloadOnce(fullUrl, destPath, progressCb, headers);
    } catch (e) {
      lastErr = e;
      // 4xx 不试其他镜像
      if (/^HTTP 4\d\d$/.test(e.message)) throw e;
    }
  }
  throw lastErr;
}

// 纯检查，返回结构化结果，不弹任何 UI
async function checkForUpdate(context) {
  const current = getCurrentVersion(context);
  if (!current) return { error: '无法读取当前版本' };

  let release;
  try {
    release = await fetchJsonWithMirror(RELEASES_API, {
      headers: {
        'User-Agent': 'devin-model-pro-updater',
        'Accept': 'application/vnd.github+json',
      },
      timeout: 15000,
    });
  } catch (e) {
    return { error: describeError(e) };
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
  try {
    await downloadWithMirror(downloadUrl, tmpPath, (received, total) => {
      const pct = Math.floor(received / total * 100);
      onProgress({ stage: 'downloading', percent: pct });
    }, { 'User-Agent': 'devin-model-pro-updater' });
    onProgress({ stage: 'installing' });
    try {
      await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(tmpPath));
    } catch (e) {
      throw new Error('安装失败: ' + (e && e.message ? e.message : String(e)));
    }
    onProgress({ stage: 'done' });
    return true;
  } finally {
    try { fs.unlink(tmpPath, () => {}); } catch (e) {}
  }
}

module.exports = {
  checkForUpdate,
  downloadAndInstall,
  compareVersions,
  getCurrentVersion,
};
