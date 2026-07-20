(() => {
  const tmp0 = acquireVsCodeApi();
  let tmp1 = "";
  const tmp2 = new Map();
  let tmp3 = tmp0.getState() || {};
  const fn = () => ({
    1: {
      options: Array.isArray(tmp3.cachedModelOptions1) ? tmp3.cachedModelOptions1 : [],
      selected: typeof tmp3.lastSelectedModel1 === "string" ? tmp3.lastSelectedModel1 : "",
      apiKey: typeof tmp3.cachedModelApiKey1 === "string" ? tmp3.cachedModelApiKey1 : ""
    },
    2: {
      options: Array.isArray(tmp3.cachedModelOptions2) ? tmp3.cachedModelOptions2 : [],
      selected: typeof tmp3.lastSelectedModel2 === "string" ? tmp3.lastSelectedModel2 : "",
      apiKey: typeof tmp3.cachedModelApiKey2 === "string" ? tmp3.cachedModelApiKey2 : ""
    },
    3: {
      options: Array.isArray(tmp3.cachedModelOptions3) ? tmp3.cachedModelOptions3 : [],
      selected: typeof tmp3.lastSelectedModel3 === "string" ? tmp3.lastSelectedModel3 : "",
      apiKey: typeof tmp3.cachedModelApiKey3 === "string" ? tmp3.cachedModelApiKey3 : ""
    },
    4: {
      options: Array.isArray(tmp3.cachedModelOptions4) ? tmp3.cachedModelOptions4 : [],
      selected: typeof tmp3.lastSelectedModel4 === "string" ? tmp3.lastSelectedModel4 : "",
      apiKey: typeof tmp3.cachedModelApiKey4 === "string" ? tmp3.cachedModelApiKey4 : ""
    }
  });
  function fn2(arg0) {
    return arg0 === 2 ? 2 : arg0 === 3 ? 3 : arg0 === 4 ? 4 : 1;
  }
  function fn3(arg0) {
    const tmp12 = fn();
    if (arg0 === 1 || arg0 === 2 || arg0 === 3 || arg0 === 4) {
      tmp3 = {
        ...tmp3,
        ["cachedModelOptions" + arg0]: tmp12[arg0].options,
        ["lastSelectedModel" + arg0]: tmp12[arg0].selected,
        ["cachedModelApiKey" + arg0]: tmp12[arg0].apiKey
      };
    } else {
      tmp3 = {
        ...tmp3,
        cachedModelOptions1: tmp12[1].options,
        lastSelectedModel1: tmp12[1].selected,
        cachedModelApiKey1: tmp12[1].apiKey,
        cachedModelOptions2: tmp12[2].options,
        lastSelectedModel2: tmp12[2].selected,
        cachedModelApiKey2: tmp12[2].apiKey,
        cachedModelOptions3: tmp12[3].options,
        lastSelectedModel3: tmp12[3].selected,
        cachedModelApiKey3: tmp12[3].apiKey,
        cachedModelOptions4: tmp12[4].options,
        lastSelectedModel4: tmp12[4].selected,
        cachedModelApiKey4: tmp12[4].apiKey
      };
    }
    tmp0.setState(tmp3);
  }
  function fn4(arg0) {
    return document.getElementById(arg0);
  }
  function fn5(arg0, arg1) {
    try {
      tmp0.postMessage(arg1 ? {
        command: arg0,
        ...arg1
      } : {
        command: arg0
      });
    } catch (e) {
      console.error('[sidebar] postMessage failed:', e);
    }
  }
  function fn6(arg0) {
    return String(arg0 == null ? "" : arg0).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function fn7(arg0, arg1, arg2, arg3) {
    const tmp4 = fn4(arg0 + "ActionState");
    const tmp5 = fn4(arg0 + "ActionText");
    if (!tmp4 || !tmp5) {
      return;
    }
    if (tmp2.has(arg0)) {
      clearTimeout(tmp2.get(arg0));
      tmp2.delete(arg0);
    }
    tmp4.classList.remove("hidden", "success", "error");
    if (!arg1) {
      tmp4.classList.add("hidden");
      tmp5.textContent = "";
      return;
    }
    if (arg1 === "success" || arg1 === "error") {
      tmp4.classList.add(arg1);
      tmp2.set(arg0, setTimeout(() => fn7(arg0, null, ""), arg1 === "success" ? 1600 : 3500));
    } else if (arg1 === "busy") {
      tmp2.set(arg0, setTimeout(() => fn7(arg0, "error", "请求超时，请稍后重试或查看日志"), arg3 || 30000));
    }
    tmp5.textContent = arg2 || "";
  }
  function fn8(arg0, arg1, arg2) {
    if (!arg0) {
      return;
    }
    arg0.classList.remove("badge-error");
    arg0.classList.toggle("badge-ok", !!arg1);
    arg0.classList.toggle("badge-warn", !arg1);
    arg0.textContent = arg2 || "";
  }
  function fn9(arg0, arg1) {
    const tmp22 = fn2(arg1);
    const tmp32 = fn();
    tmp32[tmp22].options = [];
    tmp32[tmp22].selected = "";
    tmp32[tmp22].apiKey = "";
    tmp3["cachedModelOptions" + tmp22] = [];
    tmp3["lastSelectedModel" + tmp22] = "";
    tmp3["cachedModelApiKey" + tmp22] = "";
    const tmp4 = fn4("cfgByok" + tmp22 + "Model");
    if (tmp4) {
      fn25(tmp4, [], "");
    }
    const tmp5 = fn4("modelFetchStatus" + tmp22);
    if (tmp5) {
      tmp5.textContent = arg0 || "";
      tmp5.style.color = "#fbbf24";
    }
    fn3(tmp22);
    fn20();
  }
  function fn10(arg0) {
    const tmp12 = fn4("cfgByok" + fn2(arg0) + "Host");
    return tmp12 && tmp12.value || "";
  }
  function fn11(arg0) {
    const manual = fn4("cfgByok" + fn2(arg0) + "Key");
    return manual && manual.value || "";
  }
  function fn12(arg0) {
    if (!arg0) {
      return;
    }
    const tmp12 = Array.isArray(arg0.patches) ? arg0.patches : [];
    const tmp22 = tmp12.filter(arg02 => arg02 && arg02.status === "applied").length;
    const tmp32 = tmp12.length > 0 && tmp22 === tmp12.length;
    const stale = !!arg0.backupStale;
    const badgeText = stale ? "客户端已更新" : (tmp32 ? "已就绪" : "需安装");
    fn8(fn4("patchBadge"), tmp32, badgeText);
    fn8(fn4("patchModalBadge"), tmp32, badgeText);
    if (stale) {
      for (const id of ["patchBadge", "patchModalBadge"]) {
        const b = fn4(id);
        if (b) { b.classList.remove("badge-ok", "badge-warn"); b.classList.add("badge-error"); }
      }
    }
    const dot = fn4("patchEntryDot");
    if (dot) {
      dot.classList.toggle("running", !!tmp32 && !stale);
      dot.classList.toggle("stopped", !tmp32 || stale);
    }
    if (arg0.path) {
      tmp1 = arg0.path;
    } else {
      tmp1 = "";
    }
    const tmp4 = fn4("patchPathDisplay");
    if (tmp4) {
      tmp4.innerHTML = arg0.path ? "<b>补丁路径</b> " + fn6(arg0.path) : "<b>补丁路径</b> 自动检测失败；非默认安装请点\"选择路径\"";
    }
  }
  function fn13(arg0, arg1) {
    const tmp22 = fn4(arg0);
    if (!tmp22 || document.activeElement === tmp22) {
      return;
    }
    if (tmp22.type === "checkbox") {
      tmp22.checked = arg1 === true || arg1 === "true";
      return;
    }
    tmp22.value = arg1 == null ? "" : String(arg1);
  }
  function tmp17(arg0) {
    return String(arg0 || "").trim().toLowerCase().endsWith("-thinking");
  }
  function fn14(arg0) {
    return String(arg0 || "").trim().toLowerCase().replace(/-thinking$/, "");
  }
  function fn15(arg0) {
    const tmp12 = fn14(arg0);
    if (!tmp12) {
      return null;
    }
    if (/^gemini-|^model_google_gemini|^models\/gemini-/.test(tmp12)) {
      return "gemini";
    }
    if (/^gpt-|^o[0-9][a-z0-9.-]*|^chatgpt-|^model_gpt/.test(tmp12)) {
      return "gpt";
    }
    if (/^claude-|^model_claude/.test(tmp12)) {
      return "claude";
    }
    return null;
  }
  const tmp20 = {
    claude: [["", "关闭 · 不启用思考"], ["low", "低 · budget 5k / adaptive"], ["medium", "中 · 推荐平衡"], ["high", "高 · 复杂分析/代码"], ["xhigh", "极高 · Opus 4.7/4.8"], ["max", "Max · Claude 最深思考"]],
    gpt: [["", "关闭 · 不启用 reasoning"], ["low", "低 · reasoning.effort=low"], ["medium", "中 · reasoning.effort=medium"], ["high", "高 · reasoning.effort=high"], ["xhigh", "极高 · reasoning.effort=xhigh"]],
    gemini: [["", "默认 · medium（API 默认，不覆盖）"], ["minimal", "Minimal · 最低思考 / 最低延迟"], ["low", "Low · 速度优先"], ["medium", "Medium · 推荐平衡"], ["high", "High · 最深推理"]]
  };
  function fn16(arg0) {
    if (arg0 === "gpt") {
      return "GPT · reasoning.effort";
    }
    if (arg0 === "gemini") {
      return "Gemini 3.5 Flash · thinking_level";
    }
    if (arg0 === "claude") {
      return "Claude · adaptive / budget_tokens";
    }
    return "思考强度";
  }
  function fn17(arg0, arg1) {
    if (!arg0) {
      return false;
    }
    const tmp22 = fn14(arg1);
    if (arg0 === "claude" || arg0 === "gpt") {
      return !!tmp22;
    }
    if (arg0 === "gemini") {
      return /gemini-/.test(tmp22);
    }
    return false;
  }
  function fn18(arg0, arg1) {
    const tmp22 = String(arg1 ?? "").trim().toLowerCase();
    if (arg0 === "gemini") {
      const tmp02 = {
        xhigh: "high",
        max: "high"
      };
      const tmp12 = tmp02[tmp22] || tmp22;
      const tmp23 = tmp20.gemini;
      return tmp23.some(([tmp03]) => tmp03 === tmp12) ? tmp12 : "";
    }
    if (arg0 === "gpt") {
      const tmp02 = tmp22 === "max" ? "xhigh" : tmp22;
      const tmp12 = tmp20.gpt;
      return tmp12.some(([tmp03]) => tmp03 === tmp02) ? tmp02 : "";
    }
    const tmp32 = tmp20[arg0] || tmp20.claude;
    return tmp32.some(([tmp02]) => tmp02 === tmp22) ? tmp22 : "";
  }
  // 读取槽位手动协议下拉框的值：anthropic / openai / gemini / ""
  function fn19a(arg0) {
    const tmp32 = fn2(arg0);
    const el = fn4("cfgByok" + tmp32 + "Protocol");
    return el ? String(el.value || "").toLowerCase() : "";
  }
  // 协议 -> thinking provider 映射
  function fn19b(protocol) {
    if (protocol === "anthropic") return "claude";
    if (protocol === "openai") return "gpt";
    if (protocol === "gemini") return "gemini";
    return null;
  }
  function fn19(arg0, arg1, arg2) {
    const tmp32 = fn2(arg0);
    const tmp4 = fn4("cfgByok" + tmp32 + "ThinkingEffortRow");
    const tmp5 = fn4("cfgByok" + tmp32 + "ThinkingEffort");
    const tmp6 = fn4("cfgByok" + tmp32 + "ThinkingLabel");
    // 手动协议优先于自动检测
    const manual = fn19b(fn19a(arg0));
    const tmp7 = manual || fn15(arg1);
    // 手动协议下总是显示思考深度行；否则按模型能力判定
    const visible = manual ? !!tmp7 : fn17(tmp7, arg1);
    if (tmp4) {
      tmp4.classList.toggle("hidden", !visible);
    }
    if (tmp6) {
      tmp6.textContent = fn16(tmp7);
    }
    // GPT Fast Mode 行：只在 provider=gpt 时显示
    const tmpST = fn4("cfgByok" + tmp32 + "ServiceTierRow");
    if (tmpST) {
      tmpST.classList.toggle("hidden", tmp7 !== "gpt");
    }
    if (!tmp5 || !visible) {
      return;
    }
    const tmp8 = fn18(tmp7, arg2 !== undefined ? arg2 : tmp5.value);
    const tmp9 = tmp20[tmp7] || tmp20.claude;
    tmp5.innerHTML = tmp9.map(([tmp02, tmp12]) => "<option value=\"" + tmp02 + "\"" + (tmp8 === tmp02 ? " selected" : "") + ">" + tmp12 + "</option>").join("");
    tmp5.value = tmp8;
  }
  function fn20() {
    [1, 2, 3, 4].forEach(arg0 => {
      const tmp12 = fn2(arg0);
      const tmp22 = fn4("cfgByok" + tmp12 + "Model");
      const tmp32 = tmp22 && tmp22.value || "";
      fn19(arg0, tmp32);
    });
  }
  function fn21(arg0) {
    if (typeof arg0 === "string") {
      return arg0.trim();
    }
    return String(arg0 && (arg0.id || arg0.value || arg0.name) || "").trim();
  }
  function fn22(arg0) {
    if (typeof arg0 === "string") {
      return arg0.trim();
    }
    return String(arg0 && (arg0.id || arg0.name || arg0.value) || "").trim();
  }
  function tmp28() {
    const tmp02 = fn4("cfgDefaultModelCustom");
    const tmp12 = fn4("cfgByok1Model");
    const tmp22 = fn();
    return tmp02 && tmp02.value.trim() || tmp12 && tmp12.value || tmp22[1].selected || "";
  }
  function fn23(arg0, arg1) {
    const tmp22 = fn2(arg1);
    const tmp32 = "BYOK" + tmp22 + "_";
    const tmp4 = arg0[tmp32 + "ANTHROPIC_API_HOST"] || (tmp22 === 1 ? arg0.ANTHROPIC_API_HOST || "" : "");
    const tmp5 = arg0[tmp32 + "ANTHROPIC_API_KEY"] || (tmp22 === 1 ? arg0.ANTHROPIC_API_KEY || "" : "");
    const tmp6 = arg0[tmp32 + "MODEL"] || (tmp22 === 1 ? arg0.DEFAULT_MODEL || "" : "");
    fn13("cfgByok" + tmp22 + "Host", tmp4);
    fn13("cfgByok" + tmp22 + "Key", tmp5);
    fn13("cfgByok" + tmp22 + "Protocol", String(arg0[tmp32 + "PROTOCOL"] || "").toLowerCase());
    fn13("cfgByok" + tmp22 + "ThinkingEffort", arg0[tmp32 + "THINKING_EFFORT"] || (tmp22 === 1 ? arg0.OPENAI_REASONING_EFFORT || "" : ""));
    fn13("cfgByok" + tmp22 + "ServiceTier", arg0[tmp32 + "OPENAI_SERVICE_TIER"] || (tmp22 === 1 ? arg0.OPENAI_SERVICE_TIER || "" : ""));
    fn19(arg1, tmp6, arg0[tmp32 + "THINKING_EFFORT"] || (tmp22 === 1 ? arg0.OPENAI_REASONING_EFFORT || "" : ""));
    const tmp7 = fn11(tmp22);
    const tmp8 = fn();
    const tmp9 = !!tmp8[tmp22].apiKey && !!tmp7 && tmp8[tmp22].apiKey === tmp7;
    if (tmp8[tmp22].options.length && !tmp9) {
      tmp3["cachedModelOptions" + tmp22] = [];
      tmp3["lastSelectedModel" + tmp22] = "";
    }
    if (tmp6) {
      tmp3["lastSelectedModel" + tmp22] = tmp6;
    }
    const tmp10 = fn4("cfgByok" + tmp22 + "Model");
    const tmp11 = tmp6 || (tmp9 && document.activeElement === tmp10 ? tmp10.value : "");
    if (tmp10) {
      const tmp02 = fn()[tmp22].options;
      fn25(tmp10, tmp9 ? tmp02 : [], tmp11);
    }
    fn19(arg1, tmp11 || tmp6, arg0[tmp32 + "THINKING_EFFORT"] || (tmp22 === 1 ? arg0.OPENAI_REASONING_EFFORT || "" : ""));
  }
  function fn24(arg0, arg1) {
    if (arg0) {
      fn23(arg0, 1);
      fn23(arg0, 2);
      fn23(arg0, 3);
      fn23(arg0, 4);
      fn13("cfgAnthropicPath", arg0.BYOK1_ANTHROPIC_API_PATH || arg0.ANTHROPIC_API_PATH || "");
      fn13("cfgOpenaiPath", arg0.BYOK1_OPENAI_API_PATH || arg0.OPENAI_API_PATH || "");
      fn13("cfgMaxTokens", arg0.MAX_TOKENS || "64000");
      fn13("cfgSysPromptOverride", arg0.SYSTEM_PROMPT_OVERRIDE === "true" ? "true" : "");
      fn13("cfgSysPromptPath", arg0.SYSTEM_PROMPT_PATH || "");
      fn3();
    }
    if (arg1) {
      fn13("cfgHybridPort", arg1.hybridPort || "3006");
      fn13("cfgInferencePort", arg1.inferencePort || "3001");
      fn8(fn4("proxyRunBadge"), !!arg1.running, arg1.running ? "运行中" : "已停止");
    }
    fn20();
  }
  function fn24a() {
    const tmp12 = fn4("cfgAnthropicPath");
    const tmp22 = fn4("cfgOpenaiPath");
    if (!tmp12 || !tmp22 || fn4("advancedRouteBody")) {
      return;
    }
    const tmp32 = document.createElement("div");
    tmp32.className = "guide-block";
    tmp32.style.marginBottom = "10px";
    tmp32.innerHTML = "<div class=\"card-head collapsible-head collapsed\" style=\"margin-bottom:6px;padding:0\" data-ws-toggle=\"advancedRouteBody\"><span>高级路由</span><span class=\"badge badge-warn ml-auto mr-1\">可选</span></div><div id=\"advancedRouteBody\" class=\"hidden\"><div class=\"fg\"><label>Anthropic API Path</label></div><div class=\"fg\"><label>OpenAI API Path</label></div><div class=\"guide-note\">GPT 默认先走 <code>/v1/responses</code>；网关不支持时会回退 <code>/v1/chat/completions</code>。如网关明确只支持旧接口，可在这里直接填写。</div></div>";
    const tmp4 = fn4("cfgMaxTokens");
    const tmp5 = tmp4 && tmp4.parentElement && tmp4.parentElement.parentElement;
    const tmp6 = tmp5 && tmp5.parentElement || tmp22.parentElement;
    if (tmp6 && tmp5) {
      tmp6.insertBefore(tmp32, tmp5);
    } else {
      tmp22.insertAdjacentElement("afterend", tmp32);
    }
    const tmp7 = fn4("advancedRouteBody");
    const tmp8 = tmp7 && tmp7.querySelectorAll(".fg");
    tmp12.type = "text";
    tmp12.placeholder = "/v1/messages";
    tmp22.type = "text";
    tmp22.placeholder = "/v1/responses 或 /v1/chat/completions";
    if (tmp8 && tmp8[0]) {
      tmp8[0].appendChild(tmp12);
    }
    if (tmp8 && tmp8[1]) {
      tmp8[1].appendChild(tmp22);
    }
  }
  // ========== 配置方案列表 ==========
  let profilesState = { profiles: [], activeId: "", editingId: "" };

  // 协议 label：anthropic/openai/gemini → 简称
  function protocolShortLabel(p) {
    const v = String(p || "").toLowerCase();
    if (v === "anthropic") return "Anthropic";
    if (v === "openai") return "OpenAI";
    if (v === "gemini") return "Gemini";
    return "";
  }
  // 思考深度显示：空 → "-"
  function thinkingEffortShort(v) {
    const s = String(v || "").trim().toLowerCase();
    return s || "-";
  }
  // 构造某槽位摘要（弱化显示）；未配置返回空串
  function buildSlotSummary(p, slotIdx) {
    const configured = p["byok" + slotIdx + "Configured"];
    if (!configured) return "";
    const proto = protocolShortLabel(p["byok" + slotIdx + "Protocol"]) || "未识别";
    const manual = String(p["byok" + slotIdx + "ProtocolManual"] || "");
    const protoBadge = manual ? proto + " · 手动" : proto;
    const model = p["byok" + slotIdx + "Model"] || "-";
    const thinking = thinkingEffortShort(p["byok" + slotIdx + "ThinkingEffort"]);
    // hover 完整值：截断行仍能看到全模型名
    const titleText = "#" + slotIdx + " · " + protoBadge + " · " + model + " · 思考：" + thinking;
    return (
      '<div class="profile-slot-line" title="' + fn6(titleText) + '">' +
      '<span class="profile-slot-tag">#' + slotIdx + '</span>' +
      '<span class="profile-slot-proto">' + fn6(protoBadge) + '</span>' +
      '<span class="profile-slot-sep">·</span>' +
      '<span class="profile-slot-model">' + fn6(model) + '</span>' +
      '<span class="profile-slot-sep">·</span>' +
      '<span class="profile-slot-thinking">思考：' + fn6(thinking) + '</span>' +
      '</div>'
    );
  }

  function renderProfileList(state) {
    if (state) {
      profilesState = {
        profiles: Array.isArray(state.profiles) ? state.profiles : [],
        activeId: state.activeId || "",
        editingId: state.editingId || state.activeId || "",
      };
    }
    const container = fn4("profileList");
    if (!container) {
      return;
    }
    const items = profilesState.profiles.map((p) => {
      const isActive = p.id === profilesState.activeId;
      const isEditing = p.id === profilesState.editingId;
      const cls = ["profile-item"];
      if (isActive) cls.push("active");
      if (isEditing && !isActive) cls.push("editing");
      const model = p.byok1Model || "未选择模型";
      const host = p.byok1Display || "";
      const desc = fn6(host) + " · " + fn6(model);
      const configured = p.byok1Configured && p.byok2Configured;
      const statusBadge = isActive
        ? '<span class="badge badge-info">使用中</span>'
        : configured
          ? '<button type="button" class="btn btn-s sm" data-ws-action="activateProfile" data-profile-id="' + fn6(p.id) + '">启 用</button>'
          : '<span class="badge badge-warn">未配齐</span>';
      // 每槽位摘要（协议/模型/思考深度）—— 仅显示已配置槽位
      const summaryLines = [1, 2, 3, 4].map((n) => buildSlotSummary(p, n)).filter(Boolean).join("");
      const summaryBlock = summaryLines ? '<div class="profile-slots">' + summaryLines + '</div>' : "";
      return (
        '<div class="profile-item ' + cls.slice(1).join(" ") + '" data-profile-id="' + fn6(p.id) + '" data-ws-action="editProfile">' +
        '<span class="profile-radio"></span>' +
        '<div class="profile-meta">' +
        '<div class="profile-name">' + fn6(p.name) + '</div>' +
        '<div class="profile-desc">' + desc + '</div>' +
        summaryBlock +
        '</div>' +
        '<div class="profile-actions">' +
        '<button type="button" class="profile-action-btn" data-ws-action="renameProfile" data-profile-id="' + fn6(p.id) + '" title="重命名">✎</button>' +
        '<button type="button" class="profile-action-btn" data-ws-action="duplicateProfile" data-profile-id="' + fn6(p.id) + '" title="复制">⧉</button>' +
        '<button type="button" class="profile-action-btn" data-ws-action="deleteProfile" data-profile-id="' + fn6(p.id) + '" title="删除">🗑</button>' +
        '</div>' +
        '<div class="profile-status">' + statusBadge + '</div>' +
        '</div>'
      );
    });
    container.innerHTML = items.join("");
  }

  // 当前编辑中的 profile 状态
  let currentEditingProfile = null;

  function showProfileEditor(profileId, profileName, isActive, config) {
    currentEditingProfile = { profileId, profileName, isActive };
    const card = fn4("profileEditorCard");
    const nameInput = fn4("cfgProfileName");
    const badge = fn4("profileEditorBadge");
    if (card) card.classList.remove("hidden");
    if (nameInput) nameInput.value = profileName || "";
    if (badge) {
      badge.textContent = isActive ? "使用中" : "未启用";
      badge.className = isActive ? "badge badge-info" : "badge badge-warn";
    }
    // 水合配置到表单
    if (config) {
      fn23(config, 1);
      fn23(config, 2);
      fn23(config, 3);
      fn23(config, 4);
      fn13("cfgAnthropicPath", config.BYOK1_ANTHROPIC_API_PATH || config.ANTHROPIC_API_PATH || "");
      fn13("cfgOpenaiPath", config.BYOK1_OPENAI_API_PATH || config.OPENAI_API_PATH || "");
      fn13("cfgMaxTokens", config.MAX_TOKENS || "64000");
      fn13("cfgCompletionTimeoutMs", config.COMPLETION_TIMEOUT_MS || "12000");
      fn13("cfgHybridPort", config.HYBRID_PORT || "3006");
      fn13("cfgInferencePort", config.INFERENCE_PORT || "3001");
      fn20();
    }
  }

  function hideProfileEditor() {
    currentEditingProfile = null;
    const card = fn4("profileEditorCard");
    if (card) card.classList.add("hidden");
  }

  function fn25(arg0, arg1, arg2) {
    if (!arg0) {
      return;
    }
    const tmp32 = String(arg2 || "").trim();
    const tmp4 = [];
    const tmp5 = new Set();
    for (const tmp02 of arg1 || []) {
      const tmp03 = fn21(tmp02);
      if (!tmp03 || tmp5.has(tmp03)) {
        continue;
      }
      tmp5.add(tmp03);
      tmp4.push(tmp02);
    }
    const tmp6 = tmp32 && !tmp5.has(tmp32) ? [{
      id: tmp32,
      name: tmp32
    }].concat(tmp4) : tmp4;
    const tmp7 = Array.from(arg0.options).map(arg02 => arg02.value + "\0" + (arg02.textContent || "")).join("");
    const tmp8 = tmp6.length ? tmp6.map(arg02 => fn21(arg02) + "\0" + (fn22(arg02) || fn21(arg02))).join("") : (tmp32 || "") + "\0" + (tmp32 ? tmp32 : "请先加载模型列表");
    if (tmp7 === tmp8) {
      if (tmp32 && arg0.value !== tmp32) {
        arg0.value = tmp32;
      }
      return;
    }
    arg0.innerHTML = "";
    if (!tmp6.length) {
      const tmp02 = document.createElement("option");
      tmp02.value = tmp32 || "";
      tmp02.textContent = tmp32 ? tmp32 : "请先加载模型列表";
      tmp02.selected = true;
      arg0.appendChild(tmp02);
      return;
    }
    for (const tmp02 of tmp6) {
      const tmp03 = document.createElement("option");
      tmp03.value = fn21(tmp02);
      tmp03.textContent = fn22(tmp02) || tmp03.value;
      if (tmp03.value === tmp32) {
        tmp03.selected = true;
      }
      arg0.appendChild(tmp03);
    }
    if (tmp32) {
      arg0.value = tmp32;
    }
  }
  function fn26(arg0) {
    const tmp12 = fn2(arg0);
    const tmp22 = fn11(tmp12);
    const tmp32 = fn10(tmp12);
    const tmp4 = fn4("cfgByok" + tmp12 + "Model");
    const tmp5 = (tmp4 || {}).value || "";
    const tmp6 = "BYOK" + tmp12 + "_";
    return {
      [tmp6 + "ANTHROPIC_API_HOST"]: tmp32,
      [tmp6 + "ANTHROPIC_API_KEY"]: tmp22,
      [tmp6 + "ANTHROPIC_API_PATH"]: (fn4("cfgAnthropicPath") || {}).value || "",
      [tmp6 + "OPENAI_API_HOST"]: tmp32,
      [tmp6 + "OPENAI_API_KEY"]: tmp22,
      [tmp6 + "OPENAI_API_PATH"]: (fn4("cfgOpenaiPath") || {}).value || "",
      [tmp6 + "OPENAI_SERVICE_TIER"]: ((fn4("cfgByok" + tmp12 + "ServiceTier") || {}).value || "").trim(),
      [tmp6 + "MODEL"]: tmp5,
      [tmp6 + "THINKING_EFFORT"]: ((fn4("cfgByok" + tmp12 + "ThinkingEffort") || {}).value || "").trim(),
      [tmp6 + "PROTOCOL"]: fn19a(tmp12)
    };
  }
  function fn27() {
    const tmp02 = fn26(1);
    const tmp12 = fn26(2);
    const tmp22b = fn26(3);
    const tmp32b = fn26(4);
    return {
      ...tmp02,
      ...tmp12,
      ...tmp22b,
      ...tmp32b,
      ANTHROPIC_API_HOST: tmp02.BYOK1_ANTHROPIC_API_HOST,
      ANTHROPIC_API_KEY: tmp02.BYOK1_ANTHROPIC_API_KEY,
      ANTHROPIC_API_PATH: tmp02.BYOK1_ANTHROPIC_API_PATH,
      OPENAI_API_HOST: tmp02.BYOK1_OPENAI_API_HOST,
      OPENAI_API_KEY: tmp02.BYOK1_OPENAI_API_KEY,
      OPENAI_API_PATH: tmp02.BYOK1_OPENAI_API_PATH,
      OPENAI_SERVICE_TIER: tmp02.BYOK1_OPENAI_SERVICE_TIER || "",
      DEFAULT_MODEL: tmp02.BYOK1_MODEL,
      MAX_TOKENS: (fn4("cfgMaxTokens") || {}).value || "64000",
      COMPLETION_TIMEOUT_MS: (fn4("cfgCompletionTimeoutMs") || {}).value || "12000",
      HYBRID_PORT: (fn4("cfgHybridPort") || {}).value || "3006",
      INFERENCE_PORT: (fn4("cfgInferencePort") || {}).value || "3001",
      SYSTEM_PROMPT_OVERRIDE: (fn4("cfgSysPromptOverride") || {}).value || "",
      SYSTEM_PROMPT_PATH: (fn4("cfgSysPromptPath") || {}).value || "",
      OPENAI_REASONING_EFFORT: tmp02.BYOK1_THINKING_EFFORT || "",
      OPENAI_THINKING_ENABLED: tmp02.BYOK1_THINKING_EFFORT ? "true" : ""
    };
  }
  function fn28(arg0) {
    const tmp12 = Math.floor((arg0 || 0) / 1000);
    if (tmp12 < 60) {
      return tmp12 + "s";
    }
    const tmp22 = Math.floor(tmp12 / 60);
    if (tmp22 < 60) {
      return tmp22 + "m";
    }
    return Math.floor(tmp22 / 60) + "h" + tmp22 % 60 + "m";
  }
  function fn29(arg0) {
    const tmp12 = [];
    const tmp22 = new Set();
    for (const tmp02 of arg0 || []) {
      const tmp03 = fn21(tmp02);
      if (!tmp03 || tmp22.has(tmp03)) {
        continue;
      }
      tmp12.push(tmp02);
      tmp22.add(tmp03);
      const tmp13 = tmp03.toLowerCase();
      const tmp23 = (tmp13.startsWith("claude-") || tmp13.startsWith("gemini-")) && !tmp13.endsWith("-thinking");
      if (tmp23) {
        const tmp04 = tmp03 + "-thinking";
        if (!tmp22.has(tmp04)) {
          const tmp05 = {
            id: tmp04,
            name: tmp04
          };
          tmp12.push(tmp05);
          tmp22.add(tmp04);
        }
      }
    }
    return tmp12;
  }
  function fn30(arg0) {
    const tmp12 = arg0 && arg0.providers || {};
    const tmp22 = [];
    if (tmp12.anthropic && Array.isArray(tmp12.anthropic.models)) {
      tmp22.push(...tmp12.anthropic.models);
    }
    if (tmp12.openai && Array.isArray(tmp12.openai.models)) {
      tmp22.push(...tmp12.openai.models);
    }
    if (arg0 && Array.isArray(arg0.data)) {
      tmp22.push(...arg0.data);
    }
    if (arg0 && Array.isArray(arg0.models)) {
      tmp22.push(...arg0.models);
    }
    return fn29(tmp22);
  }
  function fn31(arg0) {
    const tmp12 = fn2(arg0);
    const tmp22 = fn4("cfgByok" + tmp12 + "Model");
    const tmp32 = fn4("modelFetchStatus" + tmp12);
    const tmp4 = fn11(tmp12);
    const tmp5 = fn();
    const tmp6 = !!tmp5[tmp12].apiKey && !!tmp4 && tmp5[tmp12].apiKey === tmp4;
    const tmp7 = tmp6 ? (tmp22 || {}).value || tmp5[tmp12].selected : "";
    if (tmp7) {
      tmp5[tmp12].selected = tmp7;
      tmp3["lastSelectedModel" + tmp12] = tmp7;
    }
    if (tmp22) {
      fn25(tmp22, tmp6 ? tmp5[tmp12].options : [], tmp7);
    }
    fn3(tmp12);
    if (tmp32) {
      tmp32.textContent = "正在加载模型...";
      tmp32.style.color = "#34d399";
    }
    fn20();
  }
  function fn32(arg0, arg1, arg2) {
    const tmp32 = fn2(arg2);
    const tmp4 = fn4("cfgByok" + tmp32 + "Model");
    const tmp5 = fn4("modelFetchStatus" + tmp32);
    if (!tmp4) {
      return;
    }
    const tmp6 = fn11(tmp32);
    const tmp7 = fn();
    const tmp8 = !!tmp7[tmp32].apiKey && !!tmp6 && tmp7[tmp32].apiKey === tmp6;
    const tmp9 = (tmp8 ? tmp7[tmp32].selected || (tmp4 || {}).value : "") || arg0 && arg0.defaultModel || "";
    if (tmp9) {
      tmp7[tmp32].selected = tmp9;
      tmp3["lastSelectedModel" + tmp32] = tmp9;
    }
    if (arg1) {
      fn25(tmp4, tmp8 ? tmp7[tmp32].options : [], tmp9);
      fn3(tmp32);
      if (tmp5) {
        tmp5.textContent = "加载失败：" + arg1;
        tmp5.style.color = "#f87171";
      }
      fn7("config", "error", "BYOK #" + tmp32 + " 加载模型失败：" + arg1);
      return;
    }
    tmp7[tmp32].options = fn30(arg0);
    tmp7[tmp32].apiKey = tmp6;
    tmp3["cachedModelOptions" + tmp32] = tmp7[tmp32].options;
    tmp3["cachedModelApiKey" + tmp32] = tmp6;
    fn25(tmp4, tmp7[tmp32].options, tmp9);
    fn3(tmp32);
    const tmp10 = tmp7[tmp32].options.length;
    if (tmp5) {
      tmp5.textContent = tmp10 ? "已加载 " + tmp10 + " 个模型" : "未获取到模型列表，请检查 API Key 或网关";
      tmp5.style.color = tmp10 ? "#34d399" : "#fbbf24";
    }
    fn7("config", tmp10 ? "success" : "error", tmp10 ? "BYOK #" + tmp32 + " 已加载 " + tmp10 + " 个模型" : "BYOK #" + tmp32 + " 未获取到模型列表");
    fn20();
  }
  function fn35(arg0) {
    if (!arg0) {
      return;
    }
    const tmp12 = fn4("statPort");
    const tmp22 = fn4("statUptime");
    const tmp32 = fn4("statRequests");
    const tmp4 = fn4("proxyControlButtons");

    // 更新控制状态页的统计信息
    if (tmp12) {
      tmp12.textContent = String(arg0.hybridPort || "--");
    }
    if (tmp22) {
      tmp22.textContent = arg0.running ? fn28(arg0.uptime) : "--";
    }
    if (tmp32) {
      tmp32.textContent = String(arg0.requestCount || 0);
    }
    if (tmp4) {
      const tmp02 = (arg0.running ? "<button type=\"button\" class=\"btn btn-d\" data-ws-action=\"stopProxy\">停止代理</button>" : "<button type=\"button\" class=\"btn btn-p\" data-ws-action=\"startProxy\" data-ws-mode=\"both\">一键启动</button>") + "<button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"saveNodeConfig\">仅保存配置</button>";
      if (tmp4.innerHTML !== tmp02) {
        tmp4.innerHTML = tmp02;
      }
    }

    // 更新全局状态栏
    const statusBar = fn4("globalStatusBar");
    if (statusBar) {
      const statusDot = statusBar.querySelector(".status-dot");
      const statusIndicator = statusBar.querySelector(".status-indicator");
      const statusInfoContainer = statusBar.querySelectorAll(".status-info");
      const actionButton = statusBar.querySelector("button");

      // 更新状态点
      if (statusDot) {
        statusDot.classList.toggle("running", arg0.running);
        statusDot.classList.toggle("stopped", !arg0.running);
      }

      // 更新状态文本
      if (statusIndicator) {
        const statusText = statusIndicator.querySelector(".font-bold");
        if (statusText) {
          statusText.textContent = arg0.running ? "运行中" : "已停止";
        }
      }

      // 重新渲染整个状态栏（简化版）
      const statusHtml = `
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center flex-wrap gap-x-3 gap-y-1 min-w-0">
            <div class="status-indicator">
              <span class="status-dot ${arg0.running ? 'running' : 'stopped'}"></span>
              <span class="font-bold">${arg0.running ? '运行中' : '已停止'}</span>
            </div>
            ${arg0.running ? `
              <span class="status-info">
                Hybrid: <span class="status-value">${arg0.hybridPort}</span>
              </span>
              <span class="status-info">
                Inference: <span class="status-value">${arg0.inferencePort}</span>
              </span>
              <span class="status-info">
                请求: <span class="status-value">${arg0.requestCount}</span>
              </span>
              <span class="status-info">
                运行: <span class="status-value">${fn28(arg0.uptime)}</span>
              </span>
            ` : ''}
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            ${arg0.running ? `
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
            `}
          </div>
        </div>
      `;
      if (statusBar.innerHTML !== statusHtml) {
        statusBar.innerHTML = statusHtml;
      }
    }
  }
  function fn36(arg0) {
    const tmp12 = arg0 && arg0.getAttribute("data-ws-toggle");
    const tmp22 = tmp12 ? fn4(tmp12) : null;
    if (!tmp22) {
      return;
    }
    const tmp32 = tmp22.classList.toggle("hidden");
    arg0.classList.toggle("collapsed", tmp32);
  }
  function tmp43() {}
  document.addEventListener("click", arg0 => {
    // 标签页切换
    const tabBtn = arg0.target && arg0.target.closest ? arg0.target.closest(".tab-btn") : null;
    if (tabBtn) {
      const tabId = tabBtn.getAttribute("data-tab");
      switchTab(tabId);
      arg0.preventDefault();
      return;
    }

    const tmp12 = arg0.target && arg0.target.closest ? arg0.target.closest("[data-ws-toggle]") : null;
    if (tmp12) {
      fn36(tmp12);
      arg0.preventDefault();
      return;
    }
    const tmp22 = arg0.target.closest("[data-ws-action]");
    if (!tmp22) {
      return;
    }
    const tmp32 = tmp22.getAttribute("data-ws-action");
    if (tmp32 === "startProxy") {
      fn7("proxy", "busy", "正在启动代理...");
      fn5("startProxy", {
        mode: tmp22.getAttribute("data-ws-mode") || "both",
        config: fn27()
      });
    } else if (tmp32 === "stopProxy") {
      fn7("proxy", "busy", "正在停止代理...");
      fn5("stopProxy");
    } else if (tmp32 === "saveConfig") {
      fn7("config", "busy", "正在保存配置...");
      fn5("saveConfig", {
        config: fn27()
      });
    } else if (tmp32 === "saveProfileEditor") {
      if (!currentEditingProfile) return;
      fn7("config", "busy", "正在应用到方案...");
      const nameInput = fn4("cfgProfileName");
      fn5("saveConfig", {
        config: fn27(),
        profileName: nameInput ? nameInput.value.trim() : "",
        silent: false
      });
    } else if (tmp32 === "closeProfileEditor") {
      hideProfileEditor();
      fn5("closeProfileEditor");
    } else if (tmp32 === "resetProfileEditor") {
      if (!currentEditingProfile) return;
      fn5("resetProfileEditor", { profileId: currentEditingProfile.profileId });
    } else if (tmp32 === "createProfile") {
      fn5("createProfile", { config: fn27() });
    } else if (tmp32 === "activateProfile") {
      const pid = tmp22.getAttribute("data-profile-id");
      if (pid) {
        fn7("config", "busy", "正在切换方案...");
        fn5("activateProfile", { profileId: pid });
      }
    } else if (tmp32 === "editProfile") {
      const pid = tmp22.getAttribute("data-profile-id");
      if (pid) {
        fn5("editProfile", { profileId: pid });
      }
    } else if (tmp32 === "renameProfile") {
      const pid = tmp22.getAttribute("data-profile-id");
      if (pid) {
        fn5("renameProfile", { profileId: pid });
      }
    } else if (tmp32 === "duplicateProfile") {
      const pid = tmp22.getAttribute("data-profile-id");
      if (pid) {
        fn5("duplicateProfile", { profileId: pid });
      }
    } else if (tmp32 === "deleteProfile") {
      const pid = tmp22.getAttribute("data-profile-id");
      if (pid) {
        fn5("deleteProfile", { profileId: pid });
      }
    } else if (tmp32 === "clearCache") {
      fn7("config", "busy", "准备清理缓存...");
      fn5("clearCache");
    } else if (tmp32 === "checkForUpdates") {
      fn7("config", "busy", "正在检查更新...");
      fn5("checkForUpdates");
    } else if (tmp32 === "switchAccountMode") {
      fn5("switchAccountMode");
    } else if (tmp32 === "switchProxyMode") {
      fn5("switchProxyMode");
    } else if (tmp32 === "reloadIdeWindow") {
      fn7("config", "busy", "正在重载窗口...");
      fn5("reloadIdeWindow");
    } else if (tmp32 === "importExternalConfig") {
      const tmp02 = fn2(Number(tmp22.getAttribute("data-ws-slot") || "1"));
      const tmp13 = (tmp22.getAttribute("data-ws-source") || "claude").toLowerCase();
      const tmp14 = tmp13 === "codex" ? "GPT/Codex" : "Claude";
      fn7("config", "busy", "正在读取 " + tmp14 + " 用户配置...");
      fn5("importExternalConfig", {
        slot: tmp02,
        source: tmp13
      });
    } else if (tmp32 === "fetchModels") {
      const tmp02 = fn2(Number(tmp22.getAttribute("data-ws-slot") || "1"));
      const tmp13 = fn11(tmp02).trim();
      const tmp23 = fn10(tmp02).trim();
      if (!tmp13) {
        fn7("config", "error", "请先填写 BYOK #" + tmp02 + " 的 API Key");
        return;
      }
      fn31(tmp02);
      fn7("config", "busy", "正在加载 BYOK #" + tmp02 + " 模型...", 45000);
      const tmp33 = {
        slot: tmp02,
        apiKey: tmp13,
        baseUrl: tmp23
      };
      fn5("fetchModels", tmp33);
    } else if (tmp32 === "openPromptTemplates") {
      fn7("config", "busy", "请选择提示词模板...");
      fn5("openPromptTemplates");
    } else if (tmp32 === "openSystemPrompt") {
      fn7("config", "busy", "正在启用并打开自定义提示词...");
      fn5("openSystemPrompt", {
        path: (fn4("cfgSysPromptPath") || {}).value || ""
      });
    } else if (tmp32 === "applyPatch") {
      fn7("patch", "busy", "正在应用补丁...");
      fn5("applyPatch", {
        apiUrl: (fn4("patchApiUrl") || {}).value || "",
        inferenceUrl: (fn4("patchInferenceUrl") || {}).value || "",
        extJsPath: tmp1 || undefined
      });
    } else if (tmp32 === "revertPatch") {
      fn7("patch", "busy", "正在还原补丁...");
      fn5("revertPatch");
    } else if (tmp32 === "refreshPatchStatus") {
      fn7("patch", "busy", "正在刷新补丁状态...");
      fn5("refreshPatchStatus");
    } else if (tmp32 === "locateExtJs") {
      fn7("patch", "busy", "请选择 Devin Desktop 的 extension.js...");
      fn5("locateExtJs");
    } else if (tmp32 === "clearExtJsPath") {
      tmp1 = "";
      fn7("patch", "busy", "正在切回自动检测...");
      fn5("clearExtJsPath");
    } else if (tmp32 === "reloadIdeWindow") {
      fn5("reloadIdeWindow");
    } else if (tmp32 === "copyLogs") {
      const tmp02 = fn4("logBox");
      if (!tmp02) {
        return;
      }
      const tmp13 = Array.from(tmp02.querySelectorAll(".log-line")).map(arg02 => arg02.textContent || "").join("\n");
      navigator.clipboard.writeText(tmp13).then(() => {
        const tmp03 = fn4("copyToast");
        if (tmp03) {
          tmp03.classList.remove("hidden");
          setTimeout(() => {
            tmp03.classList.add("hidden");
          }, 2000);
        }
      });
    } else if (tmp32 === "clearLogs") {
      const tmp02 = fn4("logBox");
      if (tmp02) {
        tmp02.innerHTML = "";
      }
    } else if (tmp32 === "toggleLogPause") {
      const tmp02 = fn4("logPauseBtn");
      const tmp13 = fn4("logBox");
      if (!tmp02 || !tmp13) {
        return;
      }
      const tmp03 = tmp13.dataset.paused === "true";
      if (tmp03) {
        tmp13.dataset.paused = "false";
        tmp02.textContent = "暂停";
      } else {
        tmp13.dataset.paused = "true";
        tmp02.textContent = "继续";
      }
    }
  });
  document.addEventListener("change", arg0 => {
    const tmp12 = arg0.target;
    if (!tmp12) {
      return;
    }
    if (tmp12.id === "cfgAutoStartProxy") {
      fn5("setAutoStartProxy", {
        value: tmp12.checked === true
      });
    } else if (tmp12.id === "cfgByok1Model" || tmp12.id === "cfgByok2Model" || tmp12.id === "cfgByok3Model" || tmp12.id === "cfgByok4Model" || tmp12.id === "cfgByok1ThinkingEffort" || tmp12.id === "cfgByok2ThinkingEffort" || tmp12.id === "cfgByok3ThinkingEffort" || tmp12.id === "cfgByok4ThinkingEffort" || tmp12.id === "cfgByok1Protocol" || tmp12.id === "cfgByok2Protocol" || tmp12.id === "cfgByok3Protocol" || tmp12.id === "cfgByok4Protocol" || tmp12.id === "cfgByok1ServiceTier" || tmp12.id === "cfgByok2ServiceTier" || tmp12.id === "cfgByok3ServiceTier" || tmp12.id === "cfgByok4ServiceTier") {
      const tmp02 = /cfgByok2/.test(tmp12.id) ? 2 : /cfgByok3/.test(tmp12.id) ? 3 : /cfgByok4/.test(tmp12.id) ? 4 : 1;
      if (tmp12.id.endsWith("Model")) {
        tmp3["lastSelectedModel" + tmp02] = tmp12.value || "";
        fn3(tmp02);
      }
      // 手动协议变更时，立即根据新协议重建思考深度下拉
      if (tmp12.id.endsWith("Protocol")) {
        const modelEl = fn4("cfgByok" + tmp02 + "Model");
        fn19(tmp02, (modelEl || {}).value || "");
      }
      fn20();
    } else if (tmp12.id === "cfgByok1Host" || tmp12.id === "cfgByok2Host" || tmp12.id === "cfgByok3Host" || tmp12.id === "cfgByok4Host") {
      fn9("Base URL 已修改，请重新加载模型", tmp12.id === "cfgByok2Host" ? 2 : tmp12.id === "cfgByok3Host" ? 3 : tmp12.id === "cfgByok4Host" ? 4 : 1);
    } else if (tmp12.id === "cfgByok1Key" || tmp12.id === "cfgByok2Key" || tmp12.id === "cfgByok3Key" || tmp12.id === "cfgByok4Key") {
      fn9("API Key 已修改，请重新加载模型", tmp12.id === "cfgByok2Key" ? 2 : tmp12.id === "cfgByok3Key" ? 3 : tmp12.id === "cfgByok4Key" ? 4 : 1);
    }
  });
  document.addEventListener("input", arg0 => {
    const tmp12 = arg0.target;
    if (tmp12 && (tmp12.id === "cfgDefaultModelCustom" || /cfgByok[1234]Model/.test(tmp12.id))) {
      fn20();
    }
  });
  window.addEventListener("message", arg0 => {
    const tmp12 = arg0.data || {};
    if (tmp12.type === "status") {
      fn35(tmp12.proxy);
      fn24(tmp12.config, tmp12.proxy);
      fn12(tmp12.patch);
      if (tmp12.nodeTree) {
        renderNodeTree(tmp12.nodeTree);
      }
      const badge = fn4('accountModeBadge');
      if (badge) {
        const mode = tmp12.accountMode || '';
        if (mode === 'free') {
          badge.textContent = 'Free';
          badge.className = 'badge badge-ok';
        } else if (mode === 'pro') {
          badge.textContent = 'Pro';
          badge.className = 'badge badge-info';
        } else {
          badge.textContent = '未选择';
          badge.className = 'badge badge-warn';
        }
      }
      const pmBadge = fn4('proxyModeBadge');
      if (pmBadge && tmp12.proxyMode) {
        const pm = tmp12.proxyMode;
        if (pm === 'cascade') {
          pmBadge.textContent = 'Cascade';
          pmBadge.className = 'badge badge-info';
        } else {
          pmBadge.textContent = 'DevinLocal';
          pmBadge.className = 'badge badge-ok';
        }
      }
    } else if (tmp12.type === "nodeTree") {
      renderNodeTree(tmp12);
    } else if (tmp12.type === "nodeModelsFetched") {
      if (tmp12.error) {
        setModelFetchStatus('拉取失败：' + tmp12.error, 'error');
      } else if (Array.isArray(tmp12.data)) {
        setModelFetchStatus('已加载 ' + tmp12.data.length + ' 个模型，点击模型即可切换', 'success');
      }
    } else if (tmp12.type === "profileList") {
      renderProfileList(tmp12);
    } else if (tmp12.type === "openProfileEditor") {
      showProfileEditor(tmp12.profileId, tmp12.profileName, tmp12.isActive, tmp12.config);
    } else if (tmp12.type === "actionState" && tmp12.section) {
      fn7(tmp12.section, tmp12.state === "error" ? "error" : "success", tmp12.message || "完成");
    } else if (tmp12.type === "toast") {
      showToast(tmp12.message || "完成", tmp12.state);
    } else if (tmp12.type === "modelList") {
      const tmp02 = fn2(tmp12.slot);
      if (tmp12.loading) {
        fn31(tmp02);
      } else {
        fn32(tmp12.data, tmp12.error, tmp02);
      }
    } else if (tmp12.type === "externalConfigImported") {
      const tmp02 = fn2(tmp12.slot);
      if (tmp12.host) {
        fn13("cfgByok" + tmp02 + "Host", tmp12.host);
      }
      if (tmp12.apiKey) {
        fn13("cfgByok" + tmp02 + "Key", tmp12.apiKey);
      }
      if (tmp12.thinkingEffort) {
        fn13("cfgByok" + tmp02 + "ThinkingEffort", tmp12.thinkingEffort);
      }
      if (typeof tmp12.protocol === "string") {
        fn13("cfgByok" + tmp02 + "Protocol", String(tmp12.protocol || "").toLowerCase());
      }
      const tmp13 = fn4("cfgByok" + tmp02 + "Model");
      if (tmp12.model && tmp13) {
        fn25(tmp13, [{
          id: tmp12.model,
          name: tmp12.model
        }], tmp12.model);
        tmp3["lastSelectedModel" + tmp02] = tmp12.model;
      }
      fn9("已导入并保存外部配置，正在同步模型列表", tmp02);
      fn20();
      if (tmp12.message) {
        fn7("config", "success", tmp12.message);
      }
    } else if (tmp12.type === "externalConfigRead") {
      if (tmp12.ok) {
        if (tmp12.host) fn13("modalNodeHost", tmp12.host);
        if (tmp12.apiKey) fn13("modalNodeKey", tmp12.apiKey);
        if (typeof tmp12.protocol === "string" && tmp12.protocol) fn13("modalNodeProtocol", String(tmp12.protocol).toLowerCase());
        fn7("config", "success", "已读取 " + (tmp12.label || "外部") + " 配置，请确认后点保存创建节点");
      } else {
        fn7("config", "error", tmp12.error || "读取失败");
      }
    } else if (tmp12.type === "extJsPath" && tmp12.path) {
      tmp1 = tmp12.path;
      const tmp02 = fn4("patchPathDisplay");
      if (tmp02) {
        tmp02.innerHTML = "<b>补丁路径</b> " + fn6(tmp12.path);
      }
      fn7("patch", "success", "已选择 extension.js");
      fn5("refreshPatchStatus");
    } else if (tmp12.type === "updateInfo") {
      handleUpdateInfo(tmp12);
    } else if (tmp12.type === "updateAvailable") {
      // 启动静默检查发现新版，给按钮加红点提示
      const btn = fn4('checkForUpdatesBtn');
      if (btn) {
        btn.classList.add('has-update');
        btn.title = '发现新版本 v' + tmp12.latestVersion + '，点击查看';
      }
    } else if (tmp12.type === "log") {
      const tmp02 = fn4("logBox");
      if (!tmp02) {
        return;
      }
      if (tmp02.dataset.paused === "true") {
        return;
      }
      if (tmp02.textContent && tmp02.textContent.trim() === "等待日志...") {
        tmp02.innerHTML = "";
      }
      const tmp13 = /GetChatMessage|GetStreamingCompletions|GetEmbeddings/.test(tmp12.line) ? " hi" : /err|stderr/i.test(tmp12.line) ? " err" : "";
      const tmp14 = document.createElement("div");
      tmp14.className = "log-line" + tmp13;
      tmp14.innerHTML = fn6(tmp12.line);
      tmp02.appendChild(tmp14);
      while (tmp02.childElementCount > 200) {
        tmp02.removeChild(tmp02.firstChild);
      }
      tmp02.scrollTop = tmp02.scrollHeight;
    }
  });
  // ========== 节点+模型 ==========
  let nodeState = { nodes: [], activeNodeId: '', activeModelId: '', selectedNodeId: '', modalMode: 'edit' };

  function renderNodeTree(data) {
    nodeState.nodes = Array.isArray(data.nodes) ? data.nodes : [];
    nodeState.activeNodeId = data.activeNodeId || '';
    nodeState.activeModelId = data.activeModelId || '';
    if (!nodeState.selectedNodeId || !nodeState.nodes.find(n => n.id === nodeState.selectedNodeId)) {
      nodeState.selectedNodeId = nodeState.activeNodeId || (nodeState.nodes[0] && nodeState.nodes[0].id) || '';
    }
    renderNodeList();
    renderModelList();
    updateTabBadges();
  }

  function setModelFetchStatus(message, state) {
    const el = fn4('modelFetchStatus');
    if (!el) return;
    el.textContent = message || '';
    if (state) el.dataset.state = state;
    else delete el.dataset.state;
  }

  // ========== 更新弹窗 ==========
  function handleUpdateInfo(info) {
    const modal = fn4('updateModal');
    const title = fn4('updateModalTitle');
    const body = fn4('updateModalBody');
    const btns = fn4('updateModalBtns');
    if (!modal || !body || !btns) return;

    if (info.visible === false) {
      modal.style.display = 'none';
      return;
    }
    modal.style.display = 'flex';

    const stage = info.stage || 'prompt';
    const ver = info.latestVersion || '';
    const cur = info.current || '';
    const releaseUrl = info.releaseUrl || '';
    const notes = info.notes || '';

    if (stage === 'prompt') {
      title.textContent = '发现新版本 v' + ver;
      body.innerHTML = '<p style="margin:0">当前 v' + cur + '，最新 v' + ver + '</p>';
      btns.innerHTML = '';
      const installBtn = document.createElement('button');
      installBtn.type = 'button';
      installBtn.className = 'btn btn-p sm';
      installBtn.textContent = '下载并安装';
      installBtn.onclick = () => fn5('updateAction', { action: 'install' });
      btns.appendChild(installBtn);
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-s sm';
      cancelBtn.textContent = '稍后';
      cancelBtn.onclick = () => fn5('updateAction', { action: 'dismiss' });
      btns.appendChild(cancelBtn);
    } else if (stage === 'downloading') {
      title.textContent = '下载中';
      const pct = info.percent || 0;
      body.innerHTML = '<div style="background:var(--vscode-editor-background);border-radius:4px;height:6px;overflow:hidden">' +
        '<div style="background:var(--vscode-button-background);height:100%;width:' + pct + '%"></div></div>';
      btns.innerHTML = '';
    } else if (stage === 'installing') {
      title.textContent = '安装中';
      body.innerHTML = '<p style="margin:0">正在安装 v' + ver + '...</p>';
      btns.innerHTML = '';
    } else if (stage === 'done') {
      title.textContent = '更新完成';
      body.innerHTML = '<p style="margin:0 0 8px">已安装 v' + ver + '，重载窗口生效</p>';
      btns.innerHTML = '';
      const reloadBtn = document.createElement('button');
      reloadBtn.type = 'button';
      reloadBtn.className = 'btn btn-p sm';
      reloadBtn.textContent = '重载窗口';
      reloadBtn.onclick = () => fn5('updateAction', { action: 'reload' });
      btns.appendChild(reloadBtn);
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'btn btn-s sm';
      closeBtn.textContent = '稍后';
      closeBtn.onclick = () => fn5('updateAction', { action: 'dismiss' });
      btns.appendChild(closeBtn);
      const checkBtn = fn4('checkForUpdatesBtn');
      if (checkBtn) checkBtn.classList.remove('has-update');
    } else if (stage === 'error') {
      title.textContent = '更新失败';
      body.innerHTML = '<p style="margin:0 0 8px">' + (info.error || '未知错误') + '</p>';
      btns.innerHTML = '';
      if (releaseUrl) {
        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'btn btn-p sm';
        openBtn.textContent = '去 GitHub';
        openBtn.onclick = () => fn5('updateAction', { action: 'openRelease' });
        btns.appendChild(openBtn);
      }
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'btn btn-s sm';
      closeBtn.textContent = '关闭';
      closeBtn.onclick = () => fn5('updateAction', { action: 'dismiss' });
      btns.appendChild(closeBtn);
    }
  }

  // 关闭按钮和遮罩点击
  (function bindUpdateModalClose() {
    const btn = fn4('btnCloseUpdateModal');
    if (btn) btn.addEventListener('click', () => fn5('updateAction', { action: 'dismiss' }));
    const modal = fn4('updateModal');
    if (modal) modal.addEventListener('click', (e) => {
      if (e.target === modal) fn5('updateAction', { action: 'dismiss' });
    });
  })();
  // ========== 更新弹窗结束 ==========

  function showToast(message, state) {
    let stack = fn4('sidebarToastStack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'sidebarToastStack';
      stack.className = 'sidebar-toast-stack';
      stack.setAttribute('aria-live', 'polite');
      stack.setAttribute('aria-atomic', 'true');
      document.body.appendChild(stack);
    }
    const toast = document.createElement('div');
    toast.className = 'sidebar-toast ' + (state === 'error' ? 'error' : 'success');
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    const dismiss = () => {
      if (!toast.isConnected || toast.classList.contains('closing')) return;
      toast.classList.add('closing');
      window.setTimeout(() => toast.remove(), 160);
    };
    toast.addEventListener('click', dismiss);
    stack.appendChild(toast);
    window.setTimeout(dismiss, 2800);
  }

  function renderNodeList() {
    const el = fn4('nodeList');
    if (!el) return;
    el.innerHTML = '';
    const count = fn4('nodeCount');
    if (count) count.textContent = nodeState.nodes.length ? String(nodeState.nodes.length) : '';
    for (const node of nodeState.nodes) {
      const item = document.createElement('div');
      item.className = 'node-list-item' + (node.id === nodeState.selectedNodeId ? ' active' : '') + (node.id === nodeState.activeNodeId ? ' is-active' : '');
      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.className = 'node-select-btn';
      selectBtn.title = [node.name || '未命名', node.host || '未配置'].join(' · ');
      const name = document.createElement('span');
      name.className = 'node-list-item-name';
      name.textContent = node.name || '未命名';
      const host = document.createElement('span');
      host.className = 'node-list-item-host';
      host.textContent = node.host || '未配置 API 地址';
      selectBtn.appendChild(name);
      selectBtn.appendChild(host);
      selectBtn.addEventListener('click', () => {
        if (nodeState.selectedNodeId === node.id) {
          // 已选中，再次点击打开编辑
          openNodeModal(node.id);
        } else {
          // 未选中，切换为当前节点（不打开编辑）
          nodeState.selectedNodeId = node.id;
          nodeState.activeNodeId = node.id;
          renderNodeList();
          renderModelList();
          fn5('switchActive', { nodeId: node.id, modelId: '' });
        }
      });
      item.appendChild(selectBtn);
      el.appendChild(item);
    }
    if (nodeState.nodes.length === 0) {
      el.innerHTML = '<div style="font-size:10px;color:var(--vscode-descriptionForeground);padding:8px">暂无节点，点上方+添加</div>';
    }
  }

  function renderModelList() {
    const el = fn4('modelList');
    if (!el) return;
    el.innerHTML = '';
    const node = nodeState.nodes.find(n => n.id === nodeState.selectedNodeId);
    const models = (node && node.models) || [];
    const count = fn4('modelCount');
    if (count) count.textContent = models.length ? String(models.length) : '';
    if (!node) {
      setModelFetchStatus('先添加并选择一个节点');
      el.innerHTML = '<div class="empty-text">还没有节点</div>';
      return;
    }
    if (models.length === 0) {
      setModelFetchStatus('拉取模型，或手动添加一个模型');
      el.innerHTML = '<div class="empty-text">当前节点还没有模型</div>';
      return;
    }
    const selected = models.find(m => m.id === nodeState.activeModelId && node.id === nodeState.activeNodeId) || models[0];
    const picker = document.createElement('div');
    picker.className = 'model-choice-grid';
    for (const m of models) {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'model-choice' + (m.id === selected.id ? ' active' : '');
      choice.textContent = m.name || '未命名';
      choice.title = m.name || '';
      choice.setAttribute('aria-pressed', String(m.id === selected.id));
      choice.addEventListener('click', () => {
        nodeState.activeNodeId = node.id;
        nodeState.activeModelId = m.id;
        renderNodeList();
        renderModelList();
        fn5('switchActive', { nodeId: nodeState.selectedNodeId, modelId: m.id });
      });
      picker.appendChild(choice);
    }
    el.appendChild(picker);
    el.appendChild(renderModelSettings(node, selected));
  }

  function renderModelSettings(node, model) {
    const panel = document.createElement('div');
    panel.className = 'model-settings';
    const isGemini = /^gemini-|^model_google_gemini|^models\/gemini-/i.test(String(model.name || ''));
    const isGpt = node.protocol === 'openai' || /^gpt-|^o[0-9]|^chatgpt-|^model_gpt/i.test(String(model.name || ''));
    const options = isGemini
      ? [['', 'Default'], ['minimal', 'Minimal'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]
      : isGpt
        ? [['', 'None'], ['minimal', 'Minimal'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['xhigh', 'xHigh']]
        : [['', 'None'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['xhigh', 'xHigh'], ['max', 'Max']];
    panel.appendChild(createSegmentedSetting('思考', options, model.thinkingEffort || '', value => {
      model.thinkingEffort = value;
      fn5('updateModel', { nodeId: node.id, modelId: model.id, patch: { thinkingEffort: value } });
      renderModelList();
    }));
    if (isGpt) {
      panel.appendChild(createSegmentedSetting('Speed', [['', 'Standard'], ['fast', 'Fast']], model.serviceTier || '', value => {
        model.serviceTier = value;
        fn5('updateModel', { nodeId: node.id, modelId: model.id, patch: { serviceTier: value } });
        renderModelList();
      }));
    }
    return panel;
  }

  function createSegmentedSetting(label, options, selected, onChange) {
    const row = document.createElement('div');
    row.className = 'model-setting';
    const title = document.createElement('span');
    title.className = 'model-setting-label';
    title.textContent = label;
    row.appendChild(title);
    const control = document.createElement('div');
    control.className = 'segmented-control';
    for (const [value, text] of options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'segmented-option' + (value === selected ? ' active' : '');
      button.textContent = text;
      button.setAttribute('aria-pressed', String(value === selected));
      button.addEventListener('click', () => onChange(value));
      control.appendChild(button);
    }
    row.appendChild(control);
    return row;
  }

  function openNodeModal(nodeId) {
    const modal = fn4('nodeModal');
    if (!modal) return;
    if (nodeId) {
      nodeState.modalMode = 'edit';
      const node = nodeState.nodes.find(n => n.id === nodeId);
      fn13('modalNodeName', node ? node.name : '');
      fn13('modalNodeHost', node ? node.host : '');
      fn13('modalNodeKey', node ? node.apiKey : '');
      fn13('modalNodeProtocol', node ? (node.protocol || 'anthropic') : 'anthropic');
      fn4('nodeModalTitle').textContent = '编辑节点';
      fn4('btnDeleteNodeModal').style.display = '';
      modal.dataset.nodeId = nodeId;
    } else {
      nodeState.modalMode = 'add';
      fn13('modalNodeName', '');
      fn13('modalNodeHost', '');
      fn13('modalNodeKey', '');
      fn13('modalNodeProtocol', 'anthropic');
      fn4('nodeModalTitle').textContent = '添加节点';
      fn4('btnDeleteNodeModal').style.display = 'none';
      modal.dataset.nodeId = '';
    }
    modal.style.display = 'flex';
  }

  function closeNodeModal() {
    const modal = fn4('nodeModal');
    if (modal) modal.style.display = 'none';
  }

  function genId(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function initNodeTreeEvents() {
    const btnAddNode = fn4('btnAddNode');
    if (btnAddNode) btnAddNode.addEventListener('click', () => openNodeModal(null));
    const btnCloseNodeModal = fn4('btnCloseNodeModal');
    if (btnCloseNodeModal) btnCloseNodeModal.addEventListener('click', closeNodeModal);
    const patchEntryBtn = fn4('patchEntryBtn');
    if (patchEntryBtn) patchEntryBtn.addEventListener('click', () => {
      switchTab('tab-control');
      const card = fn4('patchPathDisplay');
      if (card && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const btnSaveNodeModal = fn4('btnSaveNodeModal');
    if (btnSaveNodeModal) btnSaveNodeModal.addEventListener('click', () => {
      const modal = fn4('nodeModal');
      const nodeId = modal && modal.dataset.nodeId;
      const patch = {
        name: fn4('modalNodeName').value.trim() || '未命名',
        host: fn4('modalNodeHost').value.trim(),
        apiKey: fn4('modalNodeKey').value.trim(),
        protocol: fn4('modalNodeProtocol').value,
      };
      if (nodeId) {
        fn5('updateNode', { nodeId, patch });
        const node = nodeState.nodes.find(n => n.id === nodeId);
        if (node) Object.assign(node, patch);
      } else {
        const newNode = { id: genId('node'), ...patch, models: [] };
        nodeState.nodes.push(newNode);
        nodeState.selectedNodeId = newNode.id;
        fn5('addNode', { node: newNode });
      }
      renderNodeList();
      renderModelList();
      closeNodeModal();
    });
    const btnDeleteNodeModal = fn4('btnDeleteNodeModal');
    if (btnDeleteNodeModal) btnDeleteNodeModal.addEventListener('click', () => {
      const modal = fn4('nodeModal');
      const nodeId = modal && modal.dataset.nodeId;
      if (!nodeId) return;
      fn5('removeNode', { nodeId });
      nodeState.nodes = nodeState.nodes.filter(n => n.id !== nodeId);
      nodeState.selectedNodeId = nodeState.nodes[0] ? nodeState.nodes[0].id : '';
      renderNodeList();
      renderModelList();
      closeNodeModal();
    });
    const btnImportClaudeModal = fn4('btnImportClaudeModal');
    if (btnImportClaudeModal) btnImportClaudeModal.addEventListener('click', () => {
      const modal = fn4('nodeModal');
      const nodeId = modal && modal.dataset.nodeId;
      if (nodeId) {
        fn7('config', 'busy', '正在导入 Claude...');
        fn5('importNodeConfig', { nodeId, source: 'claude' });
      } else {
        fn7('config', 'busy', '正在读取 Claude 配置...');
        fn5('readExternalConfig', { source: 'claude' });
      }
    });
    const btnImportCodexModal = fn4('btnImportCodexModal');
    if (btnImportCodexModal) btnImportCodexModal.addEventListener('click', () => {
      const modal = fn4('nodeModal');
      const nodeId = modal && modal.dataset.nodeId;
      if (nodeId) {
        fn7('config', 'busy', '正在导入 GPT...');
        fn5('importNodeConfig', { nodeId, source: 'codex' });
      } else {
        fn7('config', 'busy', '正在读取 GPT 配置...');
        fn5('readExternalConfig', { source: 'codex' });
      }
    });
    const btnFetchModels = fn4('btnFetchModels');
    if (btnFetchModels) btnFetchModels.addEventListener('click', () => {
      if (!nodeState.selectedNodeId) return;
      setModelFetchStatus('正在拉取模型...');
      fn5('fetchNodeModels', { nodeId: nodeState.selectedNodeId });
    });
    const btnAddModel = fn4('btnAddModel');
    if (btnAddModel) btnAddModel.addEventListener('click', () => {
      if (!nodeState.selectedNodeId) return;
      const modal = fn4('modelModal');
      if (modal) {
        fn13('modalModelName', '');
        modal.style.display = 'flex';
        const inp = fn4('modalModelName');
        if (inp) inp.focus();
      }
    });
    const btnCloseModelModal = fn4('btnCloseModelModal');
    if (btnCloseModelModal) btnCloseModelModal.addEventListener('click', () => {
      const modal = fn4('modelModal');
      if (modal) modal.style.display = 'none';
    });
    const btnSaveModelModal = fn4('btnSaveModelModal');
    if (btnSaveModelModal) btnSaveModelModal.addEventListener('click', () => {
      const name = (fn4('modalModelName').value || '').trim();
      if (!name) return;
      const newModel = { id: genId('model'), name, thinkingEffort: '', serviceTier: '' };
      const node = nodeState.nodes.find(n => n.id === nodeState.selectedNodeId);
      if (node) {
        node.models = node.models || [];
        node.models.push(newModel);
        fn5('addModel', { nodeId: nodeState.selectedNodeId, model: newModel });
        renderModelList();
      }
      const modal = fn4('modelModal');
      if (modal) modal.style.display = 'none';
    });
    const modalModelNameInput = fn4('modalModelName');
    if (modalModelNameInput) modalModelNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const btn = fn4('btnSaveModelModal');
        if (btn) btn.click();
      }
    });
  }

  /**
   * 收集当前配置（复用 fn27 确保键名一致）
   */
  function collectCurrentConfig() {
    return fn27();
  }

  // 注册自动保存事件监听器
  document.addEventListener('DOMContentLoaded', () => {
    initNodeTreeEvents();
    tmp0.postMessage({ type: 'getNodeTree' });
    // 监听所有输入字段
    const inputs = document.querySelectorAll('input, select, textarea');

    inputs.forEach(input => {
      // input 事件：输入时防抖保存
      input.addEventListener('input', (e) => {
        if (isAutoSaveField(e.target)) {
          scheduleAutoSave(false);
        }
      });

      // change 事件：变更完成后立即保存
      input.addEventListener('change', (e) => {
        if (isAutoSaveField(e.target)) {
          scheduleAutoSave(true);
        }
      });
    });

    console.log('✅ 自动保存已启用');
  });
  // ========== 自动保存功能结束 ==========

  // ========== 标签页功能 ==========
  function switchTab(tabId) {
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
    });
    document.querySelectorAll(".tab-content").forEach(content => {
      content.classList.toggle("active", content.id === tabId);
    });
    tmp3.activeTab = tabId;
    tmp0.setState(tmp3);
  }

  // 更新标签页徽章
  function updateTabBadges() {
    const configBadge = fn4("configBadge");
    if (!configBadge) return;
    // 节点系统校验：无节点、未选 active 节点、或 active 节点无模型/未选 active 模型时显示警告
    const hasNodes = nodeState.nodes.length > 0;
    const activeNode = hasNodes ? nodeState.nodes.find(n => n.id === nodeState.activeNodeId) : null;
    const hasActiveModel = !!(activeNode && Array.isArray(activeNode.models) && activeNode.models.length > 0 && activeNode.models.find(m => m.id === nodeState.activeModelId));
    if (!hasNodes || !activeNode || !hasActiveModel) {
      configBadge.classList.remove("hidden", "badge-success");
      configBadge.classList.add("badge-warning");
      configBadge.textContent = "!";
    } else {
      configBadge.classList.add("hidden");
    }
  }

  // 快捷键支持：Cmd/Ctrl + 1/2 切换标签页
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "1") {
        e.preventDefault();
        switchTab("tab-config");
      } else if (e.key === "2") {
        e.preventDefault();
        switchTab("tab-control");
      } else if (e.key === "3") {
        e.preventDefault();
        switchTab("tab-tutorial");
      }
    }
  });

  // 恢复上次选择的标签页
  const initialTab = tmp3.activeTab || "tab-config";
  switchTab(initialTab);
  // ========== 标签页功能结束 ==========

  // ========== 子 Agent 监控面板（HTTP 轮询 /api/subagents，无 WebSocket）==========
  const subagentState = {
    agents: new Map(), // agentId -> { profile, task, status, ... }
    order: [],
    pollTimer: null
  };

  function subagentGetPort() {
    const el = fn4("cfgHybridPort");
    return (el && el.value) || "3006";
  }

  function subagentPoll() {
    const port = subagentGetPort();
    fetch("http://127.0.0.1:" + port + "/api/subagents", { cache: "no-store" })
      .then(r => r.json())
      .then(data => {
        if (!data || !Array.isArray(data.agents)) return;
        subagentState.agents = new Map();
        subagentState.order = [];
        for (const a of data.agents) {
          if (!a || !a.agentId) continue;
          subagentState.agents.set(a.agentId, a);
          subagentState.order.push(a.agentId);
        }
        renderSubagentPanel();
      })
      .catch(() => { /* 代理未启动或端口不对，静默 */ });
  }

  function renderSubagentPanel() {
    const panel = fn4("subagentPanel");
    if (!panel) return;
    if (subagentState.agents.size === 0) {
      panel.innerHTML = '<div class="log-line dim">无 Agent 活动</div>';
      return;
    }
    const html = subagentState.order.map(aid => {
      const a = subagentState.agents.get(aid);
      if (!a) return "";
      return renderSubagentCard(a);
    }).join("");
    panel.innerHTML = html;
  }

  function renderSubagentCard(a) {
    const iconHtml = a.status === "running"
      ? '<span class="sub-spinner"></span>'
      : a.status === "completed"
      ? '<span class="sub-icon-ok">✓</span>'
      : '<span class="sub-icon-err">✗</span>';
    const taskPreview = fn6((a.task || "").slice(0, 80)) + (a.task && a.task.length > 80 ? "…" : "");
    const turnInfo = a.turns ? ' <span class="dim">(' + a.turns + ' turns)</span>' : '';
    return '<div class="sub-row">' + iconHtml +
      '<span class="sub-label">' + taskPreview + turnInfo + '</span>' +
      '</div>';
  }

  // 初次拉取 + 每 2 秒轮询
  setTimeout(subagentPoll, 500);
  subagentState.pollTimer = setInterval(subagentPoll, 2000);
  // 清理按钮：调后端 /api/subagents/clear 清空所有 Agent
  const clearBtn = fn4("clearSubagentsBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const port = subagentGetPort();
      fetch("http://127.0.0.1:" + port + "/api/subagents/clear", { method: "POST" })
        .then(() => {
          subagentState.agents = new Map();
          subagentState.order = [];
          renderSubagentPanel();
        })
        .catch(() => {});
    });
  }
  // 页面卸载时清理轮询定时器
  window.addEventListener("beforeunload", () => {
    if (subagentState.pollTimer) {
      clearInterval(subagentState.pollTimer);
      subagentState.pollTimer = null;
    }
  });
  // ========== 子 Agent 监控面板结束 ==========


})();
