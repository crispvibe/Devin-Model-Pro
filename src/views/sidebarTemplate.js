/**
 * 侧栏 WebView HTML 模板渲染（模块化版本）
 * 使用独立的 HTML 模板文件，提升可维护性
 */

const { esc, formatUptime } = require('./sidebarHtml');
const thinkingEffort = require('../services/thinkingEffort');
const { renderSidebar } = require('./templates');

/**
 * 渲染侧栏 HTML
 * @param {Object} ctx - 渲染上下文（包含所有 tmp 变量）
 * @returns {string} 完整的 HTML 字符串
 */
function renderSidebarHtml(ctx) {
  // 解构常用变量
  const {
    nonce, cspSource, scriptUri, cssUri,
    tmp02, tmp1, tmp2, tmp3, tmp4, tmp5, tmp6, tmp7, tmp8, tmp9, tmp10, tmp11, tmp12, tmp12a,
    tmp13, tmp14, tmp15, tmp16, tmp17, tmp18, tmp19, tmp20, tmp21, tmp22, tmp23, tmp24,
    tmp25, tmp26, tmp27, tmp28, tmp29, tmp30, tmp31, tmp32, tmp33, tmp34, tmp35, tmp36,
    tmp33a, tmp33b, tmp33c, tmp33d, tmp33e, tmp33f, tmp33g, tmp33h,
    proxyMode,
    accountMode,
  } = ctx;

  // BYOK 卡片折叠/状态：4 张卡片全部默认折叠（不区分是否已配置）
  const byok1Configured = !!(tmp25 || tmp26);
  const byok2Configured = !!(tmp28 || tmp29);
  const byok3Configured = !!(tmp33a || tmp33b);
  const byok4Configured = !!(tmp33e || tmp33f);

  // 协议 select 选项渲染（回填手动选择的值）
  const buildProtocolOptions = (selected) => {
    const opts = [
      ['', '自动 · 按模型名识别'],
      ['anthropic', 'Anthropic Messages'],
      ['openai', 'OpenAI Compatible'],
      ['gemini', 'Gemini'],
    ];
    return opts.map(([v, label]) => {
      const sel = String(selected || '').toLowerCase() === v ? ' selected' : '';
      return `<option value="${v}"${sel}>${label}</option>`;
    }).join('');
  };

  // GPT Fast Mode (service_tier) 下拉选项：只接受 fast 或空
  const buildOpenAIServiceTierOptions = (selected) => {
    const cur = String(selected || '').trim().toLowerCase() === 'fast' ? 'fast' : '';
    const opts = [
      ['', '默认 · 不覆盖 service_tier'],
      ['fast', 'Fast · service_tier=fast'],
    ];
    return opts.map(([v, label]) => {
      const sel = cur === v ? ' selected' : '';
      return `<option value="${esc(v)}"${sel}>${esc(label)}</option>`;
    }).join('');
  };

  const byok1Protocol = String(ctx.tmp2?.BYOK1_PROTOCOL || '').toLowerCase();
  const byok2Protocol = String(ctx.tmp2?.BYOK2_PROTOCOL || '').toLowerCase();
  const byok3Protocol = String(ctx.tmp2?.BYOK3_PROTOCOL || '').toLowerCase();
  const byok4Protocol = String(ctx.tmp2?.BYOK4_PROTOCOL || '').toLowerCase();

  // Slot 级 service_tier 取值：slot#1 回退顶层 OPENAI_SERVICE_TIER
  const byok1ServiceTier = String(ctx.tmp2?.BYOK1_OPENAI_SERVICE_TIER || ctx.tmp2?.OPENAI_SERVICE_TIER || '').trim();
  const byok2ServiceTier = String(ctx.tmp2?.BYOK2_OPENAI_SERVICE_TIER || '').trim();
  const byok3ServiceTier = String(ctx.tmp2?.BYOK3_OPENAI_SERVICE_TIER || '').trim();
  const byok4ServiceTier = String(ctx.tmp2?.BYOK4_OPENAI_SERVICE_TIER || '').trim();

  // 准备模板数据
  const templateData = {
    // CSP 和资源
    nonce: tmp10,
    cspSource: tmp11,
    cssUri: cssUri,
    tailwindCssUri: tmp12a,
    scriptUri: tmp12,

    // 全局状态栏数据
    statusDotClass: tmp02.running ? 'running' : 'stopped',
    statusText: tmp02.running ? '运行中' : '已停止',
    statusInfo: tmp02.running ? `
      <span class="status-info">
        Hybrid: <span class="status-value">${tmp02.hybridPort}</span>
      </span>
      <span class="status-info">
        Inference: <span class="status-value">${tmp02.inferencePort}</span>
      </span>
      <span class="status-info">
        请求: <span class="status-value">${tmp02.requestCount}</span>
      </span>
      <span class="status-info">
        运行: <span class="status-value">${formatUptime(tmp02.uptime)}</span>
      </span>
    ` : '',
    statusBarButton: tmp02.running ? `
      <button type="button" class="btn btn-d"
              data-ws-action="stopProxy"
              style="min-height: 24px; padding: 4px 12px; font-size: 10px;">
        停止
      </button>
    ` : `
      <button type="button" class="btn btn-p"
              data-ws-action="startProxy" data-ws-mode="both"
              style="min-height: 24px; padding: 4px 12px; font-size: 10px;">
        启动
      </button>
    `,

    // 隐藏配置字段
    sysPromptOverride: tmp9 ? 'true' : '',
    sysPromptPath: esc(tmp8),

    // 有效 provider：手动协议优先，否则按模型名自动识别
    // 值：'claude' / 'gpt' / 'gemini' / null
    // BYOK #1 配置数据
    byok1Host: esc(tmp25),
    byok1Key: esc(tmp26),
    byok1ModelOption: tmp27 ? `<option value="${esc(tmp27)}" selected>${esc(tmp27)}</option>` : '<option value="" disabled selected>请先加载模型</option>',
    byok1ThinkingLabel: esc(thinkingEffort.getThinkingIntensityHint(
      thinkingEffort.protocolToThinkingProvider(byok1Protocol) || thinkingEffort.detectModelProvider(tmp27)
    )),
    byok1ThinkingOptions: byok1Protocol
      ? thinkingEffort.buildThinkingEffortOptionsHtmlForProvider(thinkingEffort.protocolToThinkingProvider(byok1Protocol), tmp31)
      : thinkingEffort.buildThinkingEffortOptionsHtml(tmp27, tmp31),
    byok1ProtocolOptions: buildProtocolOptions(byok1Protocol),
    byok1ServiceTierOptions: buildOpenAIServiceTierOptions(byok1ServiceTier),
    // BYOK #1 卡片状态（默认折叠）
    byok1HeadCollapsed: 'collapsed',
    byok1BodyHidden: 'hidden',
    byok1BadgeClass: byok1Configured ? 'badge-ok' : 'badge-warn',
    byok1BadgeText: byok1Configured ? '已配置' : '未配置',

    // BYOK #2 配置数据
    byok2Host: esc(tmp28),
    byok2Key: esc(tmp29),
    byok2ModelOption: tmp30 ? `<option value="${esc(tmp30)}" selected>${esc(tmp30)}</option>` : '<option value="" disabled selected>请先加载模型</option>',
    byok2ThinkingLabel: esc(thinkingEffort.getThinkingIntensityHint(
      thinkingEffort.protocolToThinkingProvider(byok2Protocol) || thinkingEffort.detectModelProvider(tmp30)
    )),
    byok2ThinkingOptions: byok2Protocol
      ? thinkingEffort.buildThinkingEffortOptionsHtmlForProvider(thinkingEffort.protocolToThinkingProvider(byok2Protocol), tmp32)
      : thinkingEffort.buildThinkingEffortOptionsHtml(tmp30, tmp32),
    byok2ProtocolOptions: buildProtocolOptions(byok2Protocol),
    byok2ServiceTierOptions: buildOpenAIServiceTierOptions(byok2ServiceTier),
    // BYOK #2 卡片状态（默认折叠）
    byok2HeadCollapsed: 'collapsed',
    byok2BodyHidden: 'hidden',
    byok2BadgeClass: byok2Configured ? 'badge-ok' : 'badge-warn',
    byok2BadgeText: byok2Configured ? '已配置' : '未配置',

    // BYOK #3 配置数据
    byok3Host: esc(tmp33a),
    byok3Key: esc(tmp33b),
    byok3ModelOption: tmp33c ? `<option value="${esc(tmp33c)}" selected>${esc(tmp33c)}</option>` : '<option value="" disabled selected>请先加载模型</option>',
    byok3ThinkingLabel: esc(thinkingEffort.getThinkingIntensityHint(
      thinkingEffort.protocolToThinkingProvider(byok3Protocol) || thinkingEffort.detectModelProvider(tmp33c)
    )),
    byok3ThinkingOptions: byok3Protocol
      ? thinkingEffort.buildThinkingEffortOptionsHtmlForProvider(thinkingEffort.protocolToThinkingProvider(byok3Protocol), tmp33d)
      : thinkingEffort.buildThinkingEffortOptionsHtml(tmp33c, tmp33d),
    byok3ProtocolOptions: buildProtocolOptions(byok3Protocol),
    byok3ServiceTierOptions: buildOpenAIServiceTierOptions(byok3ServiceTier),
    // BYOK #3 卡片状态（默认折叠）
    byok3HeadCollapsed: 'collapsed',
    byok3BodyHidden: 'hidden',
    byok3BadgeClass: byok3Configured ? 'badge-ok' : 'badge-warn',
    byok3BadgeText: byok3Configured ? '已配置' : '未配置',

    // BYOK #4 配置数据
    byok4Host: esc(tmp33e),
    byok4Key: esc(tmp33f),
    byok4ModelOption: tmp33g ? `<option value="${esc(tmp33g)}" selected>${esc(tmp33g)}</option>` : '<option value="" disabled selected>请先加载模型</option>',
    byok4ThinkingLabel: esc(thinkingEffort.getThinkingIntensityHint(
      thinkingEffort.protocolToThinkingProvider(byok4Protocol) || thinkingEffort.detectModelProvider(tmp33g)
    )),
    byok4ThinkingOptions: byok4Protocol
      ? thinkingEffort.buildThinkingEffortOptionsHtmlForProvider(thinkingEffort.protocolToThinkingProvider(byok4Protocol), tmp33h)
      : thinkingEffort.buildThinkingEffortOptionsHtml(tmp33g, tmp33h),
    byok4ProtocolOptions: buildProtocolOptions(byok4Protocol),
    byok4ServiceTierOptions: buildOpenAIServiceTierOptions(byok4ServiceTier),
    // BYOK #4 卡片状态（默认折叠）
    byok4HeadCollapsed: 'collapsed',
    byok4BodyHidden: 'hidden',
    byok4BadgeClass: byok4Configured ? 'badge-ok' : 'badge-warn',
    byok4BadgeText: byok4Configured ? '已配置' : '未配置',

    // 提示词状态
    promptStatus: tmp9 ? '已启用自定义 ' + esc(tmp8) : '默认 · 读取 Devin 全局规则',
    promptBadgeClass: 'badge-ok',
    promptBadgeText: '已启用',

    // 高级路由配置
    anthropicPath: esc(tmp2.ANTHROPIC_API_PATH || '/v1/messages'),
    openaiPath: esc(tmp2.OPENAI_API_PATH || '/v1/responses'),
    maxTokens: esc(tmp2.MAX_TOKENS || '64000'),
    completionTimeout: esc(tmp2.COMPLETION_TIMEOUT_MS || '12000'),

    // 颜色变量
    textColor: tmp17,
    borderColor: tmp21,
    inputFgColor: tmp16,

    // 补丁管理数据
    patchBadgeClass: tmp34,
    patchBadgeText: tmp35,
    patchApiUrl: esc(tmp3),
    patchInferenceUrl: esc(tmp4),
    patchPathDisplay: tmp6 ? '<b>补丁路径</b> ' + esc(tmp6) : '<b>补丁路径</b> 自动检测；非默认安装请点"选择路径"',

    // 控制状态数据
    hybridPort: esc(String(tmp02.hybridPort)),
    inferencePort: esc(String(tmp02.inferencePort)),
    proxyControlButtons: tmp02.running ? '<button type="button" class="btn btn-d" data-ws-action="stopProxy">停止代理</button>' : '<button type="button" class="btn btn-p" data-ws-action="startProxy" data-ws-mode="both">一键启动</button>',
    autoStartChecked: tmp5 ? 'checked' : '',
    proxyModeBadge: proxyMode === 'cascade' ? 'Cascade' : 'DevinLocal',
    accountModeBadge: accountMode === 'free' ? 'Free' : (accountMode === 'pro' ? 'Pro' : '未选择'),

    // 统计数据
    statPort: tmp02.hybridPort,
    statUptime: tmp02.running ? formatUptime(tmp02.uptime) : '--',
    statRequests: tmp02.requestCount,

    // 日志内容
    logContent: tmp36,
  };

  // 使用模板加载器渲染
  return renderSidebar(templateData);
}

module.exports = { renderSidebarHtml };
