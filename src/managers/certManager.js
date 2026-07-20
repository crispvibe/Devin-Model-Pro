/**
 * 证书管理：生成根 CA + 签发域名证书 + 安装到系统信任库
 * 证书目录: ~/.devin-model-pro/certs/
 * 文件命名: rootCA.pem / rootCA-key.pem / {host}.pem / {host}-key.pem
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const forge = require('../vendor/node-forge');

const CERTS_DIR = path.join(os.homedir(), '.devin-model-pro', 'certs');
const DEFAULT_DOMAIN = 'server.codeium.com';

function ensureCertsDir() {
  if (!fs.existsSync(CERTS_DIR)) {
    fs.mkdirSync(CERTS_DIR, { recursive: true });
  }
  return CERTS_DIR;
}

function getCertsDir() {
  return CERTS_DIR;
}

function certPaths(domain) {
  const host = domain || DEFAULT_DOMAIN;
  return {
    caCert: path.join(CERTS_DIR, 'rootCA.pem'),
    caKey: path.join(CERTS_DIR, 'rootCA-key.pem'),
    serverCert: path.join(CERTS_DIR, host + '.pem'),
    serverKey: path.join(CERTS_DIR, host + '-key.pem'),
  };
}

function createRootCA() {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
  const attrs = [
    { name: 'countryName', value: 'CN' },
    { name: 'organizationName', value: 'Devin Model Pro' },
    { name: 'commonName', value: 'Devin Model Pro Root CA' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return {
    cert: forge.pki.certificateToPem(cert),
    key: forge.pki.privateKeyToPem(keys.privateKey),
  };
}

function createServerCert(domain, caCertPem, caKeyPem) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = forge.util.bytesToHex(forge.random.getBytesSync(9));
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [
    { name: 'countryName', value: 'CN' },
    { name: 'organizationName', value: 'Devin Model Pro' },
    { name: 'commonName', value: domain },
  ];
  cert.setSubject(attrs);
  const caCert = forge.pki.certificateFromPem(caCertPem);
  cert.setIssuer(caCert.subject.attributes);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames: [{ type: 2, value: domain }] },
  ]);
  const caPrivateKey = forge.pki.privateKeyFromPem(caKeyPem);
  cert.sign(caPrivateKey, forge.md.sha256.create());
  return {
    cert: forge.pki.certificateToPem(cert),
    key: forge.pki.privateKeyToPem(keys.privateKey),
  };
}

function isCertExpired(certPath) {
  if (!fs.existsSync(certPath)) return true;
  try {
    const pem = fs.readFileSync(certPath, 'utf-8');
    const cert = forge.pki.certificateFromPem(pem);
    return cert.validity.notAfter < new Date();
  } catch {
    return true;
  }
}

function certsExist(domain) {
  const p = certPaths(domain);
  return fs.existsSync(p.caCert) && fs.existsSync(p.caKey) &&
    fs.existsSync(p.serverCert) && fs.existsSync(p.serverKey);
}

function certsValid(domain) {
  const p = certPaths(domain);
  return certsExist(domain) && !isCertExpired(p.caCert) && !isCertExpired(p.serverCert);
}

function generateCerts(domain) {
  const host = domain || DEFAULT_DOMAIN;
  ensureCertsDir();
  const p = certPaths(host);
  let ca;
  if (fs.existsSync(p.caCert) && fs.existsSync(p.caKey)) {
    ca = { cert: fs.readFileSync(p.caCert, 'utf-8'), key: fs.readFileSync(p.caKey, 'utf-8') };
  } else {
    ca = createRootCA();
    fs.writeFileSync(p.caCert, ca.cert, 'utf-8');
    fs.writeFileSync(p.caKey, ca.key, 'utf-8');
  }
  const server = createServerCert(host, ca.cert, ca.key);
  fs.writeFileSync(p.serverCert, server.cert, 'utf-8');
  fs.writeFileSync(p.serverKey, server.key, 'utf-8');
  return { dir: CERTS_DIR, domain: host, paths: p };
}

function isRootCATrusted() {
  return new Promise((resolve) => {
    if (process.platform === 'darwin') {
      // 同时检查系统钥匙串和用户login钥匙串
      const userKc = process.env.HOME + '/Library/Keychains/login.keychain-db';
      exec('security find-certificate -c "Devin Model Pro Root CA" /Library/Keychains/System.keychain', (err1) => {
        if (!err1) { resolve(true); return; }
        exec(`security find-certificate -c "Devin Model Pro Root CA" "${userKc}"`, (err2) => {
          resolve(!err2);
        });
      });
    } else if (process.platform === 'win32') {
      exec('certutil -store Root "Devin Model Pro Root CA"', (err) => {
        resolve(!err);
      });
    } else {
      const isDebian = fs.existsSync('/etc/debian_version');
      const target = isDebian
        ? '/usr/local/share/ca-certificates/devin-model-pro.crt'
        : '/etc/pki/ca-trust/source/anchors/devin-model-pro.crt';
      resolve(fs.existsSync(target));
    }
  });
}

function installRootCA() {
  return new Promise((resolve, reject) => {
    const p = certPaths();
    const certPath = p.caCert;
    if (!fs.existsSync(certPath)) {
      reject(new Error('根 CA 证书不存在，请先生成'));
      return;
    }
    if (process.platform === 'darwin') {
      // 方案1：装到用户 login keychain（无需管理员权限）
      const userKc = process.env.HOME + '/Library/Keychains/login.keychain-db';
      const tryUserKeychain = (cb) => {
        const cmd = `security add-trusted-cert -r trustRoot -p ssl -k "${userKc}" "${certPath}"`;
        exec(cmd, (err, stdout, stderr) => {
          cb(err, stdout, stderr);
        });
      };
      // 方案2：add-ca-cert 后用 SecTrustSettingsSetTrustSettings（仍可能要授权，作fallback）
      const tryAdminKeychain = (cb) => {
        const script = `do shell script "security add-trusted-cert -d -r trustRoot -p ssl -k /Library/Keychains/System.keychain '${certPath}'" with administrator privileges`;
        exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err, stdout, stderr) => {
          cb(err, stdout, stderr);
        });
      };
      // 方案3：open 证书文件，让用户在钥匙串访问里手动信任
      const tryOpenFile = (cb) => {
        exec(`open "${certPath}"`, (err) => {
          cb(err, '', err ? err.message : '已打开证书文件，请在钥匙串访问中双击证书设为始终信任');
        });
      };

      tryUserKeychain((err1, out1, err1msg) => {
        if (!err1) {
          resolve('已安装到用户钥匙串：' + out1);
          return;
        }
        // 用户keychain失败，尝试管理员keychain
        tryAdminKeychain((err2, out2, err2msg) => {
          if (!err2) {
            resolve('已安装到系统钥匙串：' + out2);
            return;
          }
          // 都失败，打开证书文件让用户手动
          tryOpenFile((err3, out3, err3msg) => {
            reject(new Error('自动安装失败（用户钥匙串：' + (err1msg || '').trim() + '；系统钥匙串：' + (err2msg || '').trim() + '）。已打开证书文件，请在钥匙串访问中双击该证书 → 信任 → 设为"始终信任"。'));
          });
        });
      });
    } else if (process.platform === 'win32') {
      exec(`certutil -addstore -f Root "${certPath}"`, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout);
      });
    } else {
      const isDebian = fs.existsSync('/etc/debian_version');
      const dest = isDebian
        ? '/usr/local/share/ca-certificates/devin-model-pro.crt'
        : '/etc/pki/ca-trust/source/anchors/devin-model-pro.crt';
      const updateCmd = isDebian ? 'update-ca-certificates' : 'update-ca-trust';
      const cmd = isDebian
        ? `pkexec sh -c "cp '${certPath}' '${dest}' && update-ca-certificates"`
        : `pkexec sh -c "cp '${certPath}' '${dest}' && update-ca-trust"`;
      exec(cmd, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout);
      });
    }
  });
}

async function ensureCerts(domain) {
  const host = domain || DEFAULT_DOMAIN;
  if (!certsValid(host)) {
    generateCerts(host);
  }
  const trusted = await isRootCATrusted();
  return { generated: !certsValid(host), trusted, dir: CERTS_DIR };
}

module.exports = {
  getCertsDir,
  certPaths,
  certsExist,
  certsValid,
  isCertExpired,
  generateCerts,
  isRootCATrusted,
  installRootCA,
  ensureCerts,
  DEFAULT_DOMAIN,
};
