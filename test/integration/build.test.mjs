/**
 * 构建流程测试
 * 验证 CSS、HTML、JS 构建产物的完整性
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
const require = createRequire(import.meta.url);

test('构建产物完整性', async (t) => {
  await t.test('dist/extension.js 应该存在', () => {
    const distPath = join(projectRoot, 'dist/extension.js');
    assert.ok(existsSync(distPath), 'dist/extension.js 应该存在');
  });

  await t.test('构建的 CSS 应该包含 Tailwind', () => {
    const distCssPath = join(projectRoot, 'resources/webviews/sidebar.css');
    if (existsSync(distCssPath)) {
      const css = readFileSync(distCssPath, 'utf-8');
      // Tailwind 构建后会生成很多 utility classes
      assert.ok(css.length > 10000, 'Tailwind 构建后的 CSS 应该很大（> 10KB）');
    }
  });
});

test('源文件结构', async (t) => {
  await t.test('关键源文件应该存在', () => {
    const files = [
      'src/views/sidebarTemplate.js',
      'src/views/styles/sidebar.css',
      'resources/webviews/sidebar.js',
      'tailwind.config.js'
    ];

    files.forEach(file => {
      const filePath = join(projectRoot, file);
      assert.ok(existsSync(filePath), `${file} 应该存在`);
    });
  });

  await t.test('备份文件应该不存在', () => {
    const backupFiles = [
      'src/providers/sidebarProvider.js.bak',
      'src/providers/sidebarProvider.js.bak2',
      'src/views/sidebarTemplate.js.bak',
      'src/views/sidebarTemplate.js.bak3'
    ];

    backupFiles.forEach(file => {
      const filePath = join(projectRoot, file);
      assert.ok(!existsSync(filePath), `备份文件 ${file} 不应该存在`);
    });
  });
});

test('代码质量', async (t) => {
  await t.test('sidebarTemplate.js 不应该有语法错误', () => {
    try {
      const templatePath = join(projectRoot, 'src/views/sidebarTemplate.js');
      require(templatePath);
      assert.ok(true, 'sidebarTemplate.js 可以正常加载');
    } catch (error) {
      assert.fail(`sidebarTemplate.js 有语法错误: ${error.message}`);
    }
  });

  await t.test('sidebar.css 不应该有明显的语法错误', () => {
    const cssPath = join(projectRoot, 'src/views/styles/sidebar.css');
    const css = readFileSync(cssPath, 'utf-8');

    // 检查是否有未闭合的括号
    const openBraces = (css.match(/{/g) || []).length;
    const closeBraces = (css.match(/}/g) || []).length;
    assert.strictEqual(openBraces, closeBraces, 'CSS 括号应该匹配');
  });
});

test('向后兼容性', async (t) => {
  await t.test('sidebarProvider.js 应该能正常 require sidebarTemplate', () => {
    const providerPath = join(projectRoot, 'src/providers/sidebarProvider.js');
    const providerCode = readFileSync(providerPath, 'utf-8');

    assert.ok(
      providerCode.includes('sidebarTemplate') || providerCode.includes('./views/sidebarTemplate'),
      'sidebarProvider 应该引入 sidebarTemplate'
    );
  });

  await t.test('节点模型界面的关键 DOM id 应该存在', () => {
    // 模块化后 HTML 分散在 templates/partials，需渲染后再校验
    const { renderSidebarHtml } = require(join(projectRoot, 'src/views/sidebarTemplate.js'));
    const html = renderSidebarHtml({
      nonce: 'n', cspSource: 'c', scriptUri: 's.js', cssUri: 'c.css',
      tmp02: { hybridPort: 3006, inferencePort: 3001, running: false, uptime: 0, requestCount: 0 },
      tmp2: {}, tmp8: '', tmp9: false, tmp10: 'n', tmp11: 'c', tmp12: 's.js', tmp12a: 't.css',
      tmp16: '#888', tmp17: '#888', tmp21: '#444',
      tmp25: '', tmp26: '', tmp27: '', tmp28: '', tmp29: '', tmp30: '', tmp31: '', tmp32: '',
      tmp3: '', tmp4: '', tmp5: false, tmp6: '', tmp34: 'badge-warning', tmp35: '未安装', tmp36: '等待日志...'
    });

    const baselineIds = [
      'mainPanel',
      'proxyActionState', 'configActionState', 'patchActionState',
      'cfgApiMode', 'cfgHybridPort',
      'cfgInferencePort', 'cfgAutoStartProxy', 'proxyControlButtons',
      'proxyStatusTitle', 'statPort', 'statUptime', 'statRequests',
      'patchBadge', 'patchPathDisplay', 'patchApiUrl', 'patchInferenceUrl',
      'patchActionButtons', 'logBox', 'copyToast',
      'nodeList', 'nodeCount', 'btnAddNode', 'nodeModal', 'modalNodeHost',
      'modelList', 'modelCount', 'modelFetchStatus', 'btnFetchModels',
      'btnAddModel', 'modelModal', 'modalModelName'
    ];

    baselineIds.forEach(id => {
      assert.ok(
        html.includes(`id="${id}"`),
        `应该包含基线 id: ${id}`
      );
    });
  });
});

test('功能完整性验证', async (t) => {
  await t.test('节点模型功能的 action 应该定义', () => {
    const sidebarPath = join(projectRoot, 'resources/webviews/sidebar.js');
    const sidebarCode = readFileSync(sidebarPath, 'utf-8');

    const newActions = [
      'saveNodeConfig',
      'fetchNodeModels',
      'switchActive',
      'updateModel',
      'clearLogs',
      'toggleLogPause'
    ];

    newActions.forEach(action => {
      assert.ok(
        sidebarCode.includes(action),
        `sidebar.js 应该处理 ${action} action`
      );
    });
  });

  await t.test('日志暂停功能应该正确实现', () => {
    const sidebarPath = join(projectRoot, 'resources/webviews/sidebar.js');
    const sidebarCode = readFileSync(sidebarPath, 'utf-8');

    // 检查是否在日志追加时检查暂停状态
    assert.ok(
      sidebarCode.includes('paused'),
      '应该检查日志暂停状态'
    );
  });
});

test('模块化模板结构', async (t) => {
  await t.test('templates 主文件与加载器应该存在', () => {
    assert.ok(existsSync(join(projectRoot, 'src/views/templates/sidebar.html')), 'sidebar.html 应该存在');
    assert.ok(existsSync(join(projectRoot, 'src/views/templates/index.js')), '模板加载器 index.js 应该存在');
  });

  await t.test('所有 partials 片段应该存在', () => {
    const partials = ['tutorial.html', 'config-tab.html', 'system-tab.html', 'control-tab.html'];
    partials.forEach(p => {
      assert.ok(
        existsSync(join(projectRoot, 'src/views/templates/partials', p)),
        `partial ${p} 应该存在`
      );
    });
  });
});
