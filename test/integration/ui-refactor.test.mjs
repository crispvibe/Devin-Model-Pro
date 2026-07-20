/**
 * UI 重构功能集成测试
 * 测试新增的 UI 功能是否正常工作
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
const require = createRequire(import.meta.url);

// 渲染侧栏 HTML（模块化后 HTML 在 templates/partials，需渲染后校验）
function renderHtml() {
  const { renderSidebarHtml } = require(join(projectRoot, 'src/views/sidebarTemplate.js'));
  return renderSidebarHtml({
    nonce: 'n', cspSource: 'c', scriptUri: 's.js', cssUri: 'c.css',
    tmp02: { hybridPort: 3006, inferencePort: 3001, running: false, uptime: 0, requestCount: 0 },
    tmp2: {}, tmp8: '', tmp9: false, tmp10: 'n', tmp11: 'c', tmp12: 's.js', tmp12a: 't.css',
    tmp16: '#888', tmp17: '#888', tmp21: '#444',
    tmp25: '', tmp26: '', tmp27: '', tmp28: '', tmp29: '', tmp30: '', tmp31: '', tmp32: '',
    tmp3: '', tmp4: '', tmp5: false, tmp6: '', tmp34: 'badge-warning', tmp35: '未安装', tmp36: '等待日志...'
  });
}

test('CSS 文件完整性', async (t) => {
  await t.test('sidebar.css 应该存在', () => {
    const cssPath = join(projectRoot, 'src/views/styles/sidebar.css');
    const css = readFileSync(cssPath, 'utf-8');
    assert.ok(css.length > 0, 'CSS 文件应该有内容');
  });

  await t.test('应该包含关键 CSS 类', () => {
    const cssPath = join(projectRoot, 'src/views/styles/sidebar.css');
    const css = readFileSync(cssPath, 'utf-8');

    const criticalClasses = [
      '.card', '.card-head',
      '.btn', '.btn-p', '.btn-d', '.btn-s',
      '.tabs', '.tab-btn', '.tab-content',
      '.log-box', '.log-line',
      '.fg', '.btns'
    ];

    criticalClasses.forEach(className => {
      assert.ok(css.includes(className), `CSS 应该包含 ${className}`);
    });
  });

  await t.test('应该包含 Tailwind 指令', () => {
    const cssPath = join(projectRoot, 'src/views/styles/sidebar.css');
    const css = readFileSync(cssPath, 'utf-8');

    assert.ok(css.includes('@tailwind base'), '应该包含 @tailwind base');
    assert.ok(css.includes('@tailwind components'), '应该包含 @tailwind components');
    assert.ok(css.includes('@tailwind utilities'), '应该包含 @tailwind utilities');
  });
});

test('Tailwind 配置', async (t) => {
  await t.test('tailwind.config.js 应该存在', () => {
    const configPath = join(projectRoot, 'tailwind.config.js');
    const config = readFileSync(configPath, 'utf-8');
    assert.ok(config.length > 0, 'Tailwind 配置应该有内容');
  });

  await t.test('应该配置正确的内容路径', () => {
    const configPath = join(projectRoot, 'tailwind.config.js');
    const config = readFileSync(configPath, 'utf-8');
    // 模块化后模板含 .html，content 应覆盖 views 下 js 与 html
    assert.ok(config.includes('src/views/**/*.{js,html}'), '应该扫描 views 下 js 与 html');
    assert.ok(config.includes('resources/webviews/**/*.js'), '应该包含 webviews 目录');
  });
});

test('sidebarTemplate.js 模块导出', async (t) => {
  await t.test('应该导出 renderSidebarHtml 函数', async () => {
    const templatePath = join(projectRoot, 'src/views/sidebarTemplate.js');
    const templateCode = readFileSync(templatePath, 'utf-8');

    assert.ok(templateCode.includes('renderSidebarHtml'), '应该定义 renderSidebarHtml 函数');
    assert.ok(templateCode.includes('module.exports'), '应该导出函数');
    assert.ok(templateCode.includes('renderSidebarHtml'), '应该导出 renderSidebarHtml');
  });

  await t.test('应该引入必要的依赖', async () => {
    const templatePath = join(projectRoot, 'src/views/sidebarTemplate.js');
    const templateCode = readFileSync(templatePath, 'utf-8');

    assert.ok(templateCode.includes('sidebarHtml'), '应该引入 sidebarHtml 模块');
    assert.ok(templateCode.includes('thinkingEffort'), '应该引入 thinkingEffort 模块');
  });
});

test('sidebar.js 事件处理', async (t) => {
  await t.test('应该包含 saveConfig 处理', () => {
    const sidebarPath = join(projectRoot, 'resources/webviews/sidebar.js');
    const sidebarCode = readFileSync(sidebarPath, 'utf-8');
    assert.ok(sidebarCode.includes('saveConfig'), '应该有 saveConfig 处理');
  });

  await t.test('应该包含 clearLogs 处理', () => {
    const sidebarPath = join(projectRoot, 'resources/webviews/sidebar.js');
    const sidebarCode = readFileSync(sidebarPath, 'utf-8');
    assert.ok(sidebarCode.includes('clearLogs'), '应该有 clearLogs 处理');
  });

  await t.test('应该包含 toggleLogPause 处理', () => {
    const sidebarPath = join(projectRoot, 'resources/webviews/sidebar.js');
    const sidebarCode = readFileSync(sidebarPath, 'utf-8');
    assert.ok(sidebarCode.includes('toggleLogPause'), '应该有 toggleLogPause 处理');
  });

  await t.test('应该检查日志暂停状态', () => {
    const sidebarPath = join(projectRoot, 'resources/webviews/sidebar.js');
    const sidebarCode = readFileSync(sidebarPath, 'utf-8');
    assert.ok(sidebarCode.includes('paused'), '应该检查暂停状态');
  });

  await t.test('节点模型页应支持直接选择与强度配置', () => {
    const sidebarPath = join(projectRoot, 'resources/webviews/sidebar.js');
    const sidebarCode = readFileSync(sidebarPath, 'utf-8');
    assert.ok(sidebarCode.includes('model-choice-grid'), '应该渲染可直接点击的模型列表');
    assert.ok(sidebarCode.includes('createSegmentedSetting'), '应该渲染思考和速度选项');
    assert.ok(sidebarCode.includes("fn5('switchActive'"), '点击模型应该切换运行配置');
    assert.ok(sidebarCode.includes("fn5('updateModel'"), '修改强度应该持久化到模型配置');
    assert.ok(sidebarCode.includes('function showToast'), '切换结果应该使用自动关闭的提示弹窗');
  });
});

test('节点模型紧凑布局', () => {
  const cssPath = join(projectRoot, 'src/views/styles/sidebar.css');
  const css = readFileSync(cssPath, 'utf-8');
  const sidebarCode = readFileSync(join(projectRoot, 'resources/webviews/sidebar.js'), 'utf-8');
  const html = renderHtml();

  assert.ok(css.includes('flex: 0 0 140px'), '节点应以固定窄宽展示，避免少量节点撑满整行');
  assert.ok(sidebarCode.includes("node-list-item-host"), '节点卡片应显示 API 地址');
  assert.ok(css.includes('.model-choice.active'), '模型选中态应使用独立描边');
  assert.ok(css.includes('.sidebar-toast'), '切换结果应有独立的提示弹窗样式');
  assert.ok(html.includes('id="nodeCount"'), '节点区应显示数量');
  assert.ok(html.includes('id="modelCount"'), '模型区应显示数量');
});

test('Tab 顺序配置', async (t) => {
  await t.test('默认 tab 应该是 tab-config', () => {
    const sidebarPath = join(projectRoot, 'resources/webviews/sidebar.js');
    const sidebarCode = readFileSync(sidebarPath, 'utf-8');
    // 需求：配置优先，默认进入配置连接页
    assert.ok(sidebarCode.includes('"tab-config"'), '默认 tab 应该是 tab-config');
  });

  await t.test('快捷键应该映射到正确的 tab', () => {
    const sidebarPath = join(projectRoot, 'resources/webviews/sidebar.js');
    const sidebarCode = readFileSync(sidebarPath, 'utf-8');
    // Cmd+1 → tab-config, Cmd+2 → tab-control（系统补丁已改为弹窗）
    assert.ok(sidebarCode.includes('tab-config') && sidebarCode.includes('tab-control'), '快捷键应该映射到剩余两个 tab');
    assert.ok(!sidebarCode.includes('switchTab("tab-system")'), '不应再有切换到 tab-system 的快捷键');
  });
});

test('HTML 模板标签顺序', async (t) => {
  const html = renderHtml();

  await t.test('配置连接应该是第一个 tab', () => {
    const configTabIndex = html.indexOf('data-tab="tab-config"');
    const controlTabIndex = html.indexOf('data-tab="tab-control"');

    assert.ok(configTabIndex > 0, '应该有配置连接 tab');
    assert.ok(controlTabIndex > 0, '应该有控制状态 tab');
    assert.ok(configTabIndex < controlTabIndex, '配置连接应该在控制状态之前');
    assert.ok(!html.includes('data-tab="tab-system"'), '不应再有系统补丁 tab');
  });

  await t.test('配置连接 tab 应该有 active 类', () => {
    const configTabMatch = html.match(/data-tab="tab-config"[^>]*>/);
    assert.ok(configTabMatch, '应该找到配置连接 tab');
    const buttonTag = html.substring(
      html.lastIndexOf('<button', configTabMatch.index),
      configTabMatch.index + configTabMatch[0].length
    );
    assert.ok(buttonTag.includes('active'), '配置连接 tab 应该有 active 类');
  });
});

test('节点连接与模型选择', async (t) => {
  const html = renderHtml();

  await t.test('节点列表和编辑弹窗应该存在', () => {
    assert.ok(html.includes('id="nodeList"'), '应该有节点列表');
    assert.ok(html.includes('id="nodeModal"'), '应该有节点编辑弹窗');
    assert.ok(html.includes('id="modalNodeHost"'), '应该有节点 Base URL 输入框');
  });

  await t.test('模型拉取、选择和新增入口应该存在', () => {
    assert.ok(html.includes('id="btnFetchModels"'), '应该有拉取模型按钮');
    assert.ok(html.includes('id="modelList"'), '应该有模型选择区域');
    assert.ok(html.includes('id="modelModal"'), '应该有添加模型弹窗');
  });
});

test('模型选择提示', async (t) => {
  const html = renderHtml();

  await t.test('应明确提示模型会在当前节点显示', () => {
    assert.ok(html.includes('选择节点后拉取模型'), '应显示拉取前提示');
    assert.ok(html.includes('aria-live="polite"'), '模型状态应可被辅助技术读取');
  });
});

test('日志功能完整性', async (t) => {
  const html = renderHtml();

  await t.test('日志应该在控制状态 tab', () => {
    const controlTabStart = html.indexOf('id="tab-control"');
    const logBoxIndex = html.indexOf('id="logBox"');
    assert.ok(controlTabStart > 0, '应该有控制状态 tab');
    assert.ok(logBoxIndex > controlTabStart, '日志应该在控制状态 tab 内');
  });

  await t.test('日志高度应该是 300px', () => {
    const logBoxMatch = html.match(/id="logBox"[^>]*>/);
    assert.ok(logBoxMatch, '应该找到 logBox');
    const logDiv = html.substring(
      html.lastIndexOf('<div', logBoxMatch.index),
      logBoxMatch.index + logBoxMatch[0].length
    );
    assert.ok(logDiv.includes('300px'), '日志高度应该是 300px');
  });

  await t.test('应该有日志控制按钮', () => {
    assert.ok(html.includes('data-ws-action="clearLogs"'), '应该有清空按钮');
    assert.ok(html.includes('data-ws-action="toggleLogPause"'), '应该有暂停按钮');
    assert.ok(html.includes('data-ws-action="copyLogs"'), '应该有复制按钮');
  });
});
