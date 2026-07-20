'use strict';

const https = require('https');

const GITHUB_API_URL = 'https://api.github.com/repos/jornlin/devin-byok-plus/releases/latest';
const CHECK_INTERVAL_MS = 3600000;
const LAST_CHECK_KEY = 'devin-model-pro.lastVersionCheck';
const DISMISSED_VERSION_KEY = 'devin-model-pro.dismissedVersion';
const CACHED_LATEST_VERSION_KEY = 'devin-model-pro.cachedLatestVersion';
const CACHED_LATEST_URL_KEY = 'devin-model-pro.cachedLatestReleaseUrl';

class VersionChecker {
  constructor(context, currentVersion) {
    this.context = context;
    this.currentVersion = currentVersion;
    // 从 globalState 恢复上次检查到的最新版本信息，避免 IDE 重启后一小时内无法显示更新提示
    this.latestVersion = context.globalState.get(CACHED_LATEST_VERSION_KEY) || null;
    this.latestReleaseUrl = context.globalState.get(CACHED_LATEST_URL_KEY) || null;
    this.checkTimer = null;
  }

  start() {
    this.checkForUpdates();
    this.checkTimer = setInterval(() => {
      this.checkForUpdates();
    }, CHECK_INTERVAL_MS);
  }

  stop() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  async checkForUpdates() {
    const lastCheck = this.context.globalState.get(LAST_CHECK_KEY);
    const now = Date.now();
    
    if (lastCheck && now - lastCheck < CHECK_INTERVAL_MS) {
      return this.getUpdateInfo();
    }

    try {
      const releaseData = await this.fetchLatestRelease();
      
      if (releaseData && releaseData.tag_name) {
        this.latestVersion = releaseData.tag_name.replace(/^v/, '');
        this.latestReleaseUrl = releaseData.html_url;
        
        // 持久化最新版本信息到 globalState，重启后仍能在一小时内显示更新提示
        await this.context.globalState.update(CACHED_LATEST_VERSION_KEY, this.latestVersion);
        await this.context.globalState.update(CACHED_LATEST_URL_KEY, this.latestReleaseUrl);
        await this.context.globalState.update(LAST_CHECK_KEY, now);
      }
    } catch (error) {
      console.error('[Version Checker] Failed to check for updates:', error.message);
    }

    return this.getUpdateInfo();
  }

  fetchLatestRelease() {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'devin-model-pro-vscode-extension',
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 10000
      };

      const req = https.get(GITHUB_API_URL, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(data);
              resolve(json);
            } catch (err) {
              reject(new Error('Failed to parse release data'));
            }
          } else {
            reject(new Error(`GitHub API returned status ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(n => parseInt(n) || 0);
    const parts2 = v2.split('.').map(n => parseInt(n) || 0);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    
    return 0;
  }

  hasUpdate() {
    if (!this.latestVersion) {
      return false;
    }
    
    const dismissedVersion = this.context.globalState.get(DISMISSED_VERSION_KEY);
    if (dismissedVersion === this.latestVersion) {
      return false;
    }
    
    return this.compareVersions(this.latestVersion, this.currentVersion) > 0;
  }

  getUpdateInfo() {
    return {
      hasUpdate: this.hasUpdate(),
      currentVersion: this.currentVersion,
      latestVersion: this.latestVersion,
      releaseUrl: this.latestReleaseUrl
    };
  }

  async dismissUpdate() {
    if (this.latestVersion) {
      await this.context.globalState.update(DISMISSED_VERSION_KEY, this.latestVersion);
    }
  }

  async clearDismissed() {
    await this.context.globalState.update(DISMISSED_VERSION_KEY, undefined);
  }
}

exports.VersionChecker = VersionChecker;
