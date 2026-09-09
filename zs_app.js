// zs_app.js - 知识清单听写与浏览控制逻辑
(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const dictationCard = window.createFlashcard($("#dictationFlashcard"), {
    frontLabel: "中文题目，点击卡片查看英文",
    backLabel: "英文答案，点击卡片返回中文"
  });

  // 状态变量
  let currentUnit = "u1"; // 默认 Unit 1
  let currentType = "all"; // 'all' | 'phrase' | 'sentence'
  let currentMode = "dictation"; // 纸上听写或清单一览

  let filteredItems = [];
  let dictationGroups = [];
  let currentGroup = 0;
  let currentIndex = 0;

  let dictationRunning = false;
  let dictationRunToken = 0;

  // 发音设置
  const settingsKey = "zs_voice_settings_v1";
  let voiceSettings = {
    accent: "en-US",
    rate: 0.70
  };

  try {
    const saved = localStorage.getItem(settingsKey);
    if (saved) voiceSettings = { ...voiceSettings, ...JSON.parse(saved) };
  } catch (e) {
    console.error(e);
  }

  // 获取可用语音
  function findVoice(lang) {
    if (!("speechSynthesis" in window)) return null;
    const voices = speechSynthesis.getVoices();
    if (lang.startsWith("zh")) {
      return voices.find(v => v.lang.replace("_", "-").toLowerCase().startsWith("zh")) || null;
    }
    return voices.find(v => v.lang.replace("_", "-").toLowerCase() === lang.toLowerCase()) ||
           voices.find(v => v.lang.replace("_", "-").toLowerCase().startsWith(lang.split("-")[0])) || null;
  }

  if ("speechSynthesis" in window) {
    speechSynthesis.onvoiceschanged = () => {};
  }

  function speakEnglish(text, slow = false) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voiceSettings.accent;
    utterance.rate = slow ? Math.max(0.4, voiceSettings.rate - 0.2) : voiceSettings.rate;
    const voice = findVoice(voiceSettings.accent);
    if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
  }

  function speakChinese(text) {
    return new Promise(resolve => {
      if (!("speechSynthesis" in window)) return resolve(false);
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = 0.8;
      const voice = findVoice("zh-CN");
      if (voice) utterance.voice = voice;
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      speechSynthesis.speak(utterance);
    });
  }

  // 提示信息 Toast
  let toastTimer;
  function toast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  // 数据过滤与分组
  function refreshFilteredItems() {
    let list = window.ZS_DATA || [];
    if (currentUnit !== "all") {
      list = list.filter(item => item.unitId === currentUnit);
    }
    if (currentType !== "all") {
      list = list.filter(item => item.type === currentType);
    }
    filteredItems = list;

    // 分组逻辑：默认 5 个一组
    const groupSize = 5;
    dictationGroups = [];
    for (let i = 0; i < filteredItems.length; i += groupSize) {
      dictationGroups.push(filteredItems.slice(i, i + groupSize));
    }
    if (dictationGroups.length === 0) {
      dictationGroups = [[]];
    }

    // 边界保证
    if (currentGroup >= dictationGroups.length) currentGroup = 0;
    if (currentIndex >= (dictationGroups[currentGroup] || []).length) currentIndex = 0;

    updateScopeStats();
    updateGroupSelect();
  }

  function currentItem() {
    const group = dictationGroups[currentGroup] || [];
    return group[currentIndex] || null;
  }

  function updateScopeStats() {
    const phrasesCount = filteredItems.filter(i => i.type === "phrase").length;
    const sentencesCount = filteredItems.filter(i => i.type === "sentence").length;
    const statsEl = $("#scopeStats");
    if (statsEl) {
      statsEl.innerHTML = `共 <strong>${filteredItems.length}</strong> 条（短语 <strong>${phrasesCount}</strong> · 句型 <strong>${sentencesCount}</strong>）`;
    }
  }

  function updateGroupSelect() {
    const select = $("#dictationGroupSelect");
    if (!select) return;
    select.innerHTML = dictationGroups.map((group, idx) => {
      const start = idx * 5 + 1;
      const end = start + group.length - 1;
      return `<option value="${idx}">第 ${idx + 1} 组 (${start}-${end})</option>`;
    }).join("");
    select.value = String(currentGroup);
  }

  // 渲染听写卡片
  function renderDictation() {
    const item = currentItem();
    const group = dictationGroups[currentGroup] || [];
    dictationCard.reset();

    // 组标题与位置
    const labelEl = $("#dictationGroupLabel");
    if (labelEl) labelEl.textContent = `第 ${currentGroup + 1} 组 / 共 ${dictationGroups.length} 组`;

    const posEl = $("#dictationPosition");
    if (posEl) posEl.textContent = group.length ? `${currentIndex + 1} / ${group.length}` : "0 / 0";

    // 进度圆点
    const progEl = $("#dictationProgress");
    if (progEl) {
      progEl.innerHTML = group.map((_, idx) => {
        let cls = "";
        if (idx < currentIndex) cls = "done";
        else if (idx === currentIndex) cls = "current";
        return `<span class="${cls}"></span>`;
      }).join("");
    }

    if (!item) {
      $("#dictationMeaning").textContent = "暂无匹配内容";
      $("#dictationTypeBadge").textContent = "";
      $("#dictationWord").textContent = "";
      return;
    }

    // 渲染类型标签
    const badgeEl = $("#dictationTypeBadge");
    if (badgeEl) {
      badgeEl.textContent = item.typeName;
      badgeEl.className = `dictation-badge ${item.type === "phrase" ? "badge-phrase" : "badge-sentence"}`;
    }

    // 中文提示
    $("#dictationMeaning").textContent = item.zh;

    // 答案区
    const ansEl = $("#dictationWord");
    if (ansEl) ansEl.textContent = item.en;

    updateDictationStatus();
  }

  function speakDictationEnglish() {
    const item = currentItem();
    if (!item) return;
    stopDictation();
    speakEnglish(item.en);
  }

  function updateDictationStatus(text = "") {
    const statusEl = $("#dictationStatus");
    const autoBtn = $("#dictationAutoBtn");
    if (statusEl) {
      statusEl.textContent = text ? `[${text}]` : "";
      statusEl.classList.toggle("running", Boolean(text && dictationRunning));
    }
    if (autoBtn) {
      autoBtn.textContent = dictationRunning ? "暂停自动听写" : "开始自动听写";
    }
  }

  // 异步等待与令牌机制（符合 AGENTS.md 规范）
  function dictationWait(ms, token) {
    return new Promise(resolve => {
      setTimeout(() => resolve(dictationRunning && token === dictationRunToken), ms);
    });
  }

  function speakChineseWithToken(text, token) {
    return new Promise(resolve => {
      if (!("speechSynthesis" in window) || token !== dictationRunToken) return resolve(false);
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = 0.8;
      const voice = findVoice("zh-CN");
      if (voice) utterance.voice = voice;
      utterance.onend = () => resolve(token === dictationRunToken);
      utterance.onerror = () => resolve(false);
      speechSynthesis.speak(utterance);
    });
  }

  async function speakDictationPair(token) {
    const item = currentItem();
    if (!item) return false;
    updateDictationStatus("第 1 遍");
    if (!await speakChineseWithToken(item.zh, token)) return false;

    updateDictationStatus("等待第 2 遍");
    const repeatDelay = Number($("#dictationRepeatDelay").value) || 1200;
    if (!await dictationWait(repeatDelay, token)) return false;

    updateDictationStatus("第 2 遍");
    return speakChineseWithToken(item.zh, token);
  }

  async function startAutoDictation() {
    if (dictationRunning) {
      stopDictation("已暂停");
      return;
    }
    const group = dictationGroups[currentGroup] || [];
    if (currentIndex >= group.length - 1) {
      currentIndex = 0;
      renderDictation();
    }
    dictationRunning = true;
    const token = ++dictationRunToken;
    updateDictationStatus();

    while (dictationRunning && token === dictationRunToken) {
      if (!await speakDictationPair(token)) return;

      const group = dictationGroups[currentGroup] || [];
      if (currentIndex === group.length - 1) {
        stopDictation("本组完成");
        toast("本组题目已全部听写完毕！");
        return;
      }

      const nextDelayVal = $("#dictationNextDelay").value;
      if (nextDelayVal === "manual") {
        stopDictation("请书写完成后点击下一题");
        return;
      }

      const nextDelay = Number(nextDelayVal) || 5000;
      updateDictationStatus("留出书写时间");
      if (!await dictationWait(nextDelay, token)) return;

      currentIndex += 1;
      renderDictation();
    }
  }

  async function repeatCurrentDictation() {
    stopDictation();
    dictationRunning = true;
    const token = ++dictationRunToken;
    updateDictationStatus("重听本题");
    await speakDictationPair(token);
    if (token === dictationRunToken) {
      stopDictation("已重听");
    }
  }

  function stopDictation(statusText = "") {
    dictationRunning = false;
    dictationRunToken += 1;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    updateDictationStatus(statusText);
  }

  function moveDictation(step) {
    stopDictation();
    const group = dictationGroups[currentGroup] || [];
    if (step > 0 && currentIndex === group.length - 1) {
      if (currentGroup === dictationGroups.length - 1) {
        return toast("已经是最后一组最后一题了");
      }
      currentGroup += 1;
      currentIndex = 0;
      $("#dictationGroupSelect").value = String(currentGroup);
    } else if (step < 0 && currentIndex === 0) {
      if (currentGroup === 0) {
        return toast("已经是第一题了");
      }
      currentGroup -= 1;
      currentIndex = (dictationGroups[currentGroup] || []).length - 1;
      $("#dictationGroupSelect").value = String(currentGroup);
    } else {
      currentIndex += step;
    }
    renderDictation();
  }

  // 渲染清单一览
  function renderListView() {
    const container = $("#zsListContainer");
    if (!container) return;

    const query = ($("#zsSearchInput") ? $("#zsSearchInput").value.trim().toLowerCase() : "");

    // 按单元分组展示
    const unitsToRender = (currentUnit === "all")
      ? (window.ZS_UNITS || [])
      : (window.ZS_UNITS || []).filter(u => u.id === currentUnit);

    let html = "";
    let totalMatches = 0;

    unitsToRender.forEach(unit => {
      let phrases = unit.phrases || [];
      let sentences = unit.sentences || [];

      if (currentType === "phrase") sentences = [];
      if (currentType === "sentence") phrases = [];

      if (query) {
        phrases = phrases.filter(p => p.en.toLowerCase().includes(query) || p.zh.includes(query));
        sentences = sentences.filter(s => s.en.toLowerCase().includes(query) || s.zh.includes(query));
      }

      const count = phrases.length + sentences.length;
      if (count === 0) return;
      totalMatches += count;

      html += `
        <div class="zs-table-card">
          <div class="zs-unit-header">
            <h3><span>${unit.label}</span> · ${unit.theme} <small style="font-size:14px;color:var(--muted);font-weight:normal;">(${unit.title})</small></h3>
            <span>${count} 条</span>
          </div>
          <div class="zs-items-grid">
      `;

      phrases.forEach(p => {
        html += `
          <div class="zs-item-row" data-en="${escapeAttr(p.en)}" data-zh="${escapeAttr(p.zh)}">
            <div class="zs-item-content">
              <span class="dictation-badge badge-phrase" style="margin-bottom:4px;font-size:11px;">常考短语</span>
              <div class="zs-item-en">${escapeHtml(p.en)}</div>
              <div class="zs-item-zh">${escapeHtml(p.zh)}</div>
            </div>
            <div class="zs-item-actions">
              <button class="zs-btn-mini btn-speak-en" title="听英文发音" type="button">🔊 英文</button>
              <button class="zs-btn-mini btn-speak-zh" title="听中文" type="button">🇨🇳 中文</button>
            </div>
          </div>
        `;
      });

      sentences.forEach(s => {
        html += `
          <div class="zs-item-row" data-en="${escapeAttr(s.en)}" data-zh="${escapeAttr(s.zh)}">
            <div class="zs-item-content">
              <span class="dictation-badge badge-sentence" style="margin-bottom:4px;font-size:11px;">经典句型</span>
              <div class="zs-item-en">${escapeHtml(s.en)}</div>
              <div class="zs-item-zh">${escapeHtml(s.zh)}</div>
            </div>
            <div class="zs-item-actions">
              <button class="zs-btn-mini btn-speak-en" title="听英文发音" type="button">🔊 英文</button>
              <button class="zs-btn-mini btn-speak-zh" title="听中文" type="button">🇨🇳 中文</button>
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    if (totalMatches === 0) {
      html = `<div style="text-align:center;padding:48px;color:var(--muted);font-weight:700;">没有找到匹配的短语或句型</div>`;
    }

    container.innerHTML = html;
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, "&quot;");
  }

  // 模式切换
  function setMode(mode) {
    stopDictation();
    currentMode = mode;
    $$(".mode-button").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
    $("#dictationView").classList.toggle("active", mode === "dictation");
    $("#listView").classList.toggle("active", mode === "list");

    if (mode === "dictation") renderDictation();
    else if (mode === "list") renderListView();
  }

  // 单元 Tab 切换
  function setUnit(unitId) {
    stopDictation();
    currentUnit = unitId;
    currentGroup = 0;
    currentIndex = 0;
    $$("#unitTabs button").forEach(b => b.classList.toggle("active", b.dataset.unit === unitId));
    refreshFilteredItems();
    if (currentMode === "dictation") renderDictation();
    else if (currentMode === "list") renderListView();
  }

  // 类型过滤切换
  function setType(type) {
    stopDictation();
    currentType = type;
    currentGroup = 0;
    currentIndex = 0;
    $$(".type-filter-btn").forEach(b => b.classList.toggle("active", b.dataset.type === type));
    refreshFilteredItems();
    if (currentMode === "dictation") renderDictation();
    else if (currentMode === "list") renderListView();
  }

  // 初始化单元 Tabs
  function initUnitTabs() {
    const tabsContainer = $("#unitTabs");
    if (!tabsContainer) return;

    let tabsHtml = `<button class="unit-tab ${currentUnit === "all" ? "active" : ""}" data-unit="all" type="button">全部单元</button>`;
    (window.ZS_UNITS || []).forEach(unit => {
      tabsHtml += `<button class="unit-tab ${currentUnit === unit.id ? "active" : ""}" data-unit="${unit.id}" type="button">${unit.label}</button>`;
    });
    tabsContainer.innerHTML = tabsHtml;

    tabsContainer.addEventListener("click", e => {
      const btn = e.target.closest("[data-unit]");
      if (btn) setUnit(btn.dataset.unit);
    });
  }

  // 初始化事件监听
  function initEventListeners() {
    // 模式切换
    $$(".mode-button").forEach(btn => {
      btn.addEventListener("click", () => setMode(btn.dataset.mode));
    });

    // 类型过滤按钮
    $$(".type-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => setType(btn.dataset.type));
    });

    // 分组下拉改变
    $("#dictationGroupSelect").addEventListener("change", e => {
      stopDictation();
      currentGroup = Number(e.target.value);
      currentIndex = 0;
      renderDictation();
    });

    // 听写发音与播放控制
    $("#dictationSpeakBtn").addEventListener("click", repeatCurrentDictation);
    $("#dictationAutoBtn").addEventListener("click", startAutoDictation);
    $("#dictationPrevBtn").addEventListener("click", () => moveDictation(-1));
    $("#dictationNextBtn").addEventListener("click", () => moveDictation(1));

    // 发音与翻面相互独立
    $("#dictationEnglishSpeakBtn").addEventListener("click", speakDictationEnglish);

    // 重来本组
    $("#dictationRestartBtn").addEventListener("click", () => {
      stopDictation();
      currentIndex = 0;
      renderDictation();
      toast("已重置到本组第一题");
    });

    // 列表模式搜索与朗读
    const searchInput = $("#zsSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", renderListView);
    }

    const listContainer = $("#zsListContainer");
    if (listContainer) {
      listContainer.addEventListener("click", e => {
        const row = e.target.closest(".zs-item-row");
        if (!row) return;
        const en = row.dataset.en;
        const zh = row.dataset.zh;

        if (e.target.closest(".btn-speak-en")) {
          speakEnglish(en);
        } else if (e.target.closest(".btn-speak-zh")) {
          speakChinese(zh);
        }
      });
    }

    // 发音设置弹窗
    const dialog = $("#voiceDialog");
    const voiceBtn = $("#voiceSettingsBtn");
    if (voiceBtn && dialog) {
      voiceBtn.addEventListener("click", () => {
        $("#accentSelect").value = voiceSettings.accent;
        $("#rateRange").value = String(voiceSettings.rate);
        $("#rateOutput").value = `${Number(voiceSettings.rate).toFixed(2)}×`;
        dialog.showModal();
      });

      $("#rateRange").addEventListener("input", e => {
        $("#rateOutput").value = `${Number(e.target.value).toFixed(2)}×`;
      });

      dialog.addEventListener("close", () => {
        if (dialog.returnValue === "confirm") {
          voiceSettings.accent = $("#accentSelect").value;
          voiceSettings.rate = Number($("#rateRange").value);
          try {
            localStorage.setItem(settingsKey, JSON.stringify(voiceSettings));
          } catch (err) {
            console.error(err);
          }
          toast("发音设置已保存");
        }
      });
    }

    // 键盘快捷键
    window.addEventListener("keydown", e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("input, select, textarea, [contenteditable]") || $("#voiceDialog").open) return;
      if (currentMode === "dictation") {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          moveDictation(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          moveDictation(1);
        } else if (e.key === " " || e.key === "Enter") {
          if (target?.closest("button, a")) return;
          e.preventDefault();
          if (!e.repeat) dictationCard.toggle();
        } else if (e.key.toLowerCase() === "r") {
          e.preventDefault();
          repeatCurrentDictation();
        } else if (e.key.toLowerCase() === "p") {
          e.preventDefault();
          speakDictationEnglish();
        }
      }
    });
  }

  // 页面启动
  document.addEventListener("DOMContentLoaded", () => {
    initUnitTabs();
    refreshFilteredItems();
    initEventListeners();
    renderDictation();
  });
})();
