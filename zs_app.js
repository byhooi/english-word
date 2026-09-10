// zs_app.js - 知识清单听写与浏览控制逻辑
(function () {
  "use strict";

  const Speech = window.Speech;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const UNITS = window.ZS_UNITS || [];
  const DATA = window.ZS_DATA || [];

  // 短语与句型各存一套分组大小和书写等待："全部内容"时分组按句型，等待时间按每题类型取值。
  const TYPE_DEFAULTS = {
    phrase: { groupSize: 10, nextDelay: "5000" },
    sentence: { groupSize: 5, nextDelay: "12000" }
  };

  let settings = Speech.loadSettings();
  const typeSettings = {
    phrase: {
      groupSize: Number(settings.zsPhraseGroupSize) || TYPE_DEFAULTS.phrase.groupSize,
      nextDelay: settings.zsPhraseNextDelay || TYPE_DEFAULTS.phrase.nextDelay
    },
    sentence: {
      groupSize: Number(settings.zsSentenceGroupSize) || TYPE_DEFAULTS.sentence.groupSize,
      nextDelay: settings.zsSentenceNextDelay || TYPE_DEFAULTS.sentence.nextDelay
    }
  };
  const voice = { accent: settings.accent || "en-US", rate: Number(settings.rate) || 0.7 };

  const isUnit = id => id === "all" || UNITS.some(u => u.id === id);
  let currentUnit = isUnit(settings.zsUnit) ? settings.zsUnit : "u1";
  let currentType = ["all", "phrase", "sentence"].includes(settings.zsType) ? settings.zsType : "phrase";
  let currentMode = "dictation";
  let filteredItems = [];

  const settingType = () => (currentType === "phrase" ? "phrase" : "sentence");
  const settingTypeName = () => (settingType() === "phrase" ? "短语" : "句型");

  function persist(patch) {
    settings = Speech.saveSettings(patch);
  }

  function persistTypeSettings() {
    persist({
      zsPhraseGroupSize: typeSettings.phrase.groupSize,
      zsPhraseNextDelay: typeSettings.phrase.nextDelay,
      zsSentenceGroupSize: typeSettings.sentence.groupSize,
      zsSentenceNextDelay: typeSettings.sentence.nextDelay
    });
  }

  function speakEnglish(text) {
    if (!Speech.supported) return toast("当前浏览器暂不支持语音朗读");
    Speech.speakEnglish(text, voice);
  }

  let toastTimer;
  function toast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // 下拉框没有对应选项时回退到默认值，避免显示空白
  function setSelect(select, value, fallback) {
    select.value = String(value);
    if (select.value !== String(value)) select.value = String(fallback);
    return select.value;
  }

  const dictationCard = window.createFlashcard($("#dictationFlashcard"), {
    frontLabel: "中文题目，点击卡片查看英文",
    backLabel: "英文答案，点击卡片返回中文"
  });

  const dictation = window.createDictation({
    card: dictationCard,
    getItems: () => filteredItems,
    getGroupSize: () => typeSettings[settingType()].groupSize,
    getRepeatDelay: () => $("#dictationRepeatDelay").value,
    getNextDelay: item => typeSettings[item && item.type === "phrase" ? "phrase" : "sentence"].nextDelay,
    speakChinese: Speech.speakChinese,
    speakEnglish,
    toast,
    onRender: item => {
      const badge = $("#dictationTypeBadge");
      badge.textContent = item ? item.typeName : "";
      badge.className = `dictation-badge ${item && item.type === "sentence" ? "badge-sentence" : "badge-phrase"}`;
    },
    onPositionChange: ({ group, index }) => {
      if (settings.zsGroup !== group || settings.zsIndex !== index) persist({ zsGroup: group, zsIndex: index });
    }
  });

  // 数据过滤
  function refreshFilteredItems(position) {
    filteredItems = DATA.filter(item =>
      (currentUnit === "all" || item.unitId === currentUnit) &&
      (currentType === "all" || item.type === currentType)
    );
    updateScopeStats();
    dictation.refresh(position);
  }

  function updateScopeStats() {
    const phrases = filteredItems.filter(i => i.type === "phrase").length;
    const sentences = filteredItems.filter(i => i.type === "sentence").length;
    $("#scopeStats").innerHTML = `共 <strong>${filteredItems.length}</strong> 条（短语 <strong>${phrases}</strong> · 句型 <strong>${sentences}</strong>）`;
  }

  // 把当前类型的分组大小与书写等待同步到下拉框
  function syncSettingControls() {
    const current = typeSettings[settingType()];
    const defaults = TYPE_DEFAULTS[settingType()];
    current.groupSize = Number(setSelect($("#dictationGroupSize"), current.groupSize, defaults.groupSize));
    current.nextDelay = setSelect($("#dictationNextDelay"), current.nextDelay, defaults.nextDelay);
    setSelect($("#dictationRepeatDelay"), settings.zsRepeatDelay || 1200, 1200);
    $("#groupSizeLabel").textContent = `分组大小（${settingTypeName()}）`;
    $("#nextDelayLabel").textContent = `书写等待（${settingTypeName()}）`;
  }

  // 渲染清单一览
  function renderListView() {
    const container = $("#zsListContainer");
    const query = $("#zsSearchInput").value.trim().toLowerCase();
    const unitsToRender = currentUnit === "all" ? UNITS : UNITS.filter(u => u.id === currentUnit);
    const matches = list => list.filter(item => !query || item.en.toLowerCase().includes(query) || item.zh.includes(query));
    const row = (item, type, typeName) => `
      <div class="zs-item-row" data-en="${escapeHtml(item.en)}">
        <div class="zs-item-content">
          <span class="dictation-badge badge-${type}" style="margin-bottom:4px;font-size:11px;">${typeName}</span>
          <div class="zs-item-en">${escapeHtml(item.en)}</div>
          <div class="zs-item-zh">${escapeHtml(item.zh)}</div>
        </div>
        <div class="zs-item-actions">
          <button class="zs-btn-mini btn-speak-en" title="听英文发音" type="button">🔊 英文</button>
        </div>
      </div>`;

    let html = "";
    let totalMatches = 0;
    unitsToRender.forEach(unit => {
      const phrases = currentType === "sentence" ? [] : matches(unit.phrases || []);
      const sentences = currentType === "phrase" ? [] : matches(unit.sentences || []);
      const count = phrases.length + sentences.length;
      if (!count) return;
      totalMatches += count;
      html += `
        <div class="zs-table-card">
          <div class="zs-unit-header">
            <h3><span>${unit.label}</span> · ${unit.theme} <small style="font-size:14px;color:var(--muted);font-weight:normal;">(${escapeHtml(unit.title)})</small></h3>
            <span>${count} 条</span>
          </div>
          <div class="zs-items-grid">
            ${phrases.map(p => row(p, "phrase", "常考短语")).join("")}
            ${sentences.map(s => row(s, "sentence", "经典句型")).join("")}
          </div>
        </div>`;
    });

    container.innerHTML = totalMatches
      ? html
      : `<div style="text-align:center;padding:48px;color:var(--muted);font-weight:700;">没有找到匹配的短语或句型</div>`;
  }

  // 打印答题纸：按单元输出中文提示与书写线，不含答案
  function buildPrintPage(unit) {
    const phrases = unit.phrases || [];
    const sentences = unit.sentences || [];
    const sections = [];
    const numbers = ["一", "二"];
    const item = (entry, i) => `<li class="print-item"><b>${i + 1}.</b><span class="print-zh">${escapeHtml(entry.zh)}</span><span class="print-line"></span></li>`;
    if (phrases.length) sections.push(`<h2 class="print-section">${numbers[sections.length]}、常考短语（${phrases.length} 题）</h2><ol class="print-list print-phrases">${phrases.map(item).join("")}</ol>`);
    if (sentences.length) sections.push(`<h2 class="print-section">${numbers[sections.length]}、经典句型（${sentences.length} 题）</h2><ol class="print-list print-sentences">${sentences.map(item).join("")}</ol>`);
    return `
      <article class="print-page">
        <header class="print-head">
          <div>
            <h1>知识清单听写 · ${unit.label} ${unit.theme}</h1>
            <p lang="en">${escapeHtml(unit.title)}</p>
          </div>
          <p class="print-info">姓名：__________　日期：__________　得分：______</p>
        </header>
        ${sections.join("")}
      </article>`;
  }

  function printSheet() {
    dictation.stop();
    const units = currentUnit === "all" ? UNITS : UNITS.filter(u => u.id === currentUnit);
    if (!units.length) return toast("当前没有可打印的单元");
    $("#printSheet").innerHTML = units.map(buildPrintPage).join("");
    window.print();
  }

  // 模式、单元、类型切换
  function setMode(mode) {
    dictation.stop();
    currentMode = mode;
    $$(".mode-button").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
    $("#dictationView").classList.toggle("active", mode === "dictation");
    $("#listView").classList.toggle("active", mode === "list");
    if (mode === "dictation") dictation.render();
    else renderListView();
  }

  function setUnit(unitId) {
    currentUnit = unitId;
    persist({ zsUnit: unitId });
    $$("#unitTabs button").forEach(b => b.classList.toggle("active", b.dataset.unit === unitId));
    refreshFilteredItems({ group: 0, index: 0 });
    if (currentMode === "list") renderListView();
  }

  function setType(type) {
    currentType = type;
    persist({ zsType: type });
    $$(".type-filter-btn").forEach(b => b.classList.toggle("active", b.dataset.type === type));
    syncSettingControls();
    refreshFilteredItems({ group: 0, index: 0 });
    if (currentMode === "list") renderListView();
  }

  function initUnitTabs() {
    const tabs = $("#unitTabs");
    const tab = (id, label) => `<button class="unit-tab ${currentUnit === id ? "active" : ""}" data-unit="${id}" type="button">${label}</button>`;
    tabs.innerHTML = tab("all", "全部单元") + UNITS.map(u => tab(u.id, u.label)).join("");
    tabs.addEventListener("click", e => {
      const btn = e.target.closest("[data-unit]");
      if (btn) setUnit(btn.dataset.unit);
    });
  }

  function initEventListeners() {
    $$(".mode-button").forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
    $$(".type-filter-btn").forEach(btn => btn.addEventListener("click", () => setType(btn.dataset.type)));

    $("#dictationGroupSize").addEventListener("change", e => {
      typeSettings[settingType()].groupSize = Number(e.target.value) || TYPE_DEFAULTS[settingType()].groupSize;
      persistTypeSettings();
      dictation.refresh();
      toast(`${settingTypeName()}改为每 ${typeSettings[settingType()].groupSize} 题一组`);
    });
    $("#dictationNextDelay").addEventListener("change", e => {
      typeSettings[settingType()].nextDelay = e.target.value;
      persistTypeSettings();
    });
    $("#dictationRepeatDelay").addEventListener("change", e => persist({ zsRepeatDelay: e.target.value }));

    $("#printSheetBtn").addEventListener("click", printSheet);
    $("#zsSearchInput").addEventListener("input", renderListView);
    $("#zsListContainer").addEventListener("click", e => {
      const row = e.target.closest(".zs-item-row");
      if (row && e.target.closest(".btn-speak-en")) speakEnglish(row.dataset.en);
    });

    // 发音设置弹窗：口音和语速与单词页共用
    const dialog = $("#voiceDialog");
    $("#voiceSettingsBtn").addEventListener("click", () => {
      $("#accentSelect").value = voice.accent;
      $("#rateRange").value = String(voice.rate);
      $("#rateOutput").value = `${voice.rate.toFixed(2)}×`;
      dialog.showModal();
    });
    $("#rateRange").addEventListener("input", e => {
      $("#rateOutput").value = `${Number(e.target.value).toFixed(2)}×`;
    });
    dialog.addEventListener("close", () => {
      if (dialog.returnValue !== "confirm") return;
      voice.accent = $("#accentSelect").value;
      voice.rate = Number($("#rateRange").value);
      persist({ accent: voice.accent, rate: voice.rate });
      toast("发音设置已保存");
    });

    window.addEventListener("keydown", e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("input, select, textarea, [contenteditable]") || dialog.open) return;
      if (currentMode === "dictation") dictation.handleKeydown(e);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initUnitTabs();
    $$(".type-filter-btn").forEach(b => b.classList.toggle("active", b.dataset.type === currentType));
    syncSettingControls();
    initEventListeners();
    // 恢复上次的单元、类型与组内位置
    refreshFilteredItems({ group: Number(settings.zsGroup) || 0, index: Number(settings.zsIndex) || 0 });
  });
})();
