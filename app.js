(() => {
  const units = window.WORD_UNITS;
  const allWords = units.flatMap(unit => unit.words.map(word => ({...word, unitId: unit.id, unitLabel: unit.label})));
  const validIds = new Set(allWords.map(word => word.id));
  // 旧版进度用"单元-序号"作 ID，按位置映射到新的"单元-英文"ID，无法识别的脏数据直接丢弃
  const legacyIdMap = new Map();
  units.forEach(unit => unit.words.forEach((word, wordIndex) => legacyIdMap.set(`${unit.id}-${wordIndex}`, word.id)));
  const loadIds = key => JSON.parse(localStorage.getItem(key) || "[]").map(id => legacyIdMap.get(id) || id).filter(id => validIds.has(id));
  const saved = new Set(loadIds("word-island-saved"));
  const mastered = new Set(loadIds("word-island-mastered"));
  const settings = JSON.parse(localStorage.getItem("word-island-settings") || "{}");
  const totalDictationGroups = Math.ceil(allWords.length / 5);
  const savedGroup = Number(settings.dictationGroup);
  let unitId = "u1", mode = "learn", index = 0, order = [], quizWord = null, quizScore = 0, answered = false;
  let dictationGroup = Number.isInteger(savedGroup) && savedGroup >= 0 && savedGroup < totalDictationGroups ? savedGroup : 0;
  let dictationIndex = 0, dictationRunning = false, dictationRunToken = 0;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const learningCard = window.createFlashcard($("#flashcard"), {
    frontLabel: "英文单词，点击卡片查看中文",
    backLabel: "中文释义，点击卡片返回英文"
  });
  const dictationCard = window.createFlashcard($("#dictationFlashcard"), {
    frontLabel: "中文题目，点击卡片查看英文",
    backLabel: "英文答案，点击卡片返回中文"
  });

  const unit = () => units.find(item => item.id === unitId);
  const words = () => order.length ? order : unit().words;
  const current = () => words()[index] || words()[0];
  const persist = () => { localStorage.setItem("word-island-saved", JSON.stringify([...saved])); localStorage.setItem("word-island-mastered", JSON.stringify([...mastered])); };
  const saveSettings = () => localStorage.setItem("word-island-settings", JSON.stringify({ accent: $("#accentSelect").value, rate: $("#rateRange").value, autoSpeak: $("#autoSpeak").checked, repeatDelay: $("#dictationRepeatDelay").value, nextDelay: $("#dictationNextDelay").value, dictationGroup }));

  // Chrome 的语音列表异步加载，首次 getVoices() 常为空，需监听 voiceschanged
  let voices = [];
  const refreshVoices = () => { voices = speechSynthesis.getVoices(); };
  if ("speechSynthesis" in window) { refreshVoices(); speechSynthesis.onvoiceschanged = refreshVoices; }
  const findVoice = language => {
    if (!voices.length) refreshVoices();
    const lang = language.toLowerCase();
    return voices.find(v => v.lang.toLowerCase() === lang) || voices.find(v => v.lang.toLowerCase().startsWith(lang.slice(0, 2)));
  };

  function speak(text, slow = false, language = null) {
    if (!("speechSynthesis" in window)) return toast("当前浏览器暂不支持语音朗读");
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language || $("#accentSelect").value;
    utterance.rate = language === "zh-CN" ? .78 : slow ? Math.max(.45, Number($("#rateRange").value) - .15) : Number($("#rateRange").value);
    const voice = findVoice(utterance.lang);
    if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
  }

  function renderTabs() {
    $("#unitTabs").innerHTML = units.map(u => `<button class="unit-tab ${u.id === unitId ? "active" : ""}" data-unit="${u.id}" role="tab" aria-selected="${u.id === unitId}">${u.label}</button>`).join("");
  }

  function renderCard(announce = false) {
    const w = current(); if (!w) return;
    learningCard.reset();
    $("#wordText").textContent = w.en; $("#backWord").textContent = w.en; $("#meaningText").textContent = w.zh;
    $("#wordType").textContent = w.star ? "CORE WORD · 重点词" : unit().theme.toUpperCase();
    $("#phoneticText").textContent = "点击播放标准发音";
    $("#cardPosition").textContent = `${index + 1} / ${words().length}`;
    $("#saveBtn").textContent = saved.has(w.id) ? "★" : "☆"; $("#saveBtn").classList.toggle("saved", saved.has(w.id));
    $("#masterBtn").textContent = mastered.has(w.id) ? "已记住 ✓" : "我记住了"; $("#masterBtn").classList.toggle("mastered", mastered.has(w.id));
    renderStats(); if (announce || $("#autoSpeak").checked) speak(w.en);
  }

  function renderStats() {
    const currentIds = unit().words.map(w => w.id);
    $("#unitHeading").textContent = unit().label; $("#unitCount").textContent = `${unit().theme} · 共 ${unit().words.length} 个词`;
    $("#knownCount").textContent = currentIds.filter(id => mastered.has(id)).length;
    $("#savedCount").textContent = currentIds.filter(id => saved.has(id)).length;
  }

  function changeUnit(nextId) { unitId = nextId; index = 0; order = []; renderTabs(); renderCard(); renderList(); newQuiz(); }
  function move(step) { index = (index + step + words().length) % words().length; renderCard(); }
  function setMode(nextMode) {
    if (mode === "dictation" && nextMode !== "dictation") stopDictation();
    mode = nextMode;
    $$(".mode-button").forEach(button => button.classList.toggle("active", button.dataset.mode === mode));
    $$(".view").forEach(view => view.classList.remove("active"));
    $(`#${mode}View`).classList.add("active");
    $(".control-deck").classList.toggle("dictation-mode", mode === "dictation");
    if (mode === "learn") learningCard.reset();
    if (mode === "quiz") newQuiz();
    if (mode === "dictation") renderDictation();
    if (mode === "list") renderList();
  }

  function shuffle(list) {
    const items = [...list];
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
    return items;
  }

  function newQuiz() {
    answered = false; const pool = unit().words; quizWord = pool[Math.floor(Math.random() * pool.length)];
    // 按中文释义去重，避免出现两个选项释义相同（如 by themselves / by itself）
    const usedMeanings = new Set([quizWord.zh]); const distractors = [];
    for (const w of shuffle(allWords)) {
      if (usedMeanings.has(w.zh)) continue;
      usedMeanings.add(w.zh); distractors.push(w);
      if (distractors.length === 2) break;
    }
    const answers = shuffle([quizWord, ...distractors]);
    $("#quizWord").textContent = quizWord.en; $("#quizFeedback").textContent = ""; $("#quizNextBtn").classList.remove("show");
    $("#answerGrid").innerHTML = answers.map(w => `<button class="answer-button" data-id="${w.id}">${w.zh}</button>`).join("");
  }

  function answerQuiz(button) {
    if (answered) return; answered = true; const correct = button.dataset.id === quizWord.id;
    $$(".answer-button").forEach(b => { if (b.dataset.id === quizWord.id) b.classList.add("correct"); });
    if (!correct) button.classList.add("wrong");
    quizScore = correct ? quizScore + 1 : 0; $("#quizScore").textContent = quizScore;
    if (correct) mastered.add(quizWord.id); else saved.add(quizWord.id);
    persist(); renderStats();
    $("#quizFeedback").textContent = correct ? `答对了！${quizWord.en} 就是“${quizWord.zh}”。` : `再记一次：${quizWord.en} — ${quizWord.zh}，已帮你加入收藏词。`;
    $("#quizNextBtn").classList.add("show");
    speak(quizWord.en, false);
  }

  function renderList() {
    const query = ($("#searchInput")?.value || "").trim().toLowerCase();
    const filtered = unit().words.filter(w => !query || w.en.toLowerCase().includes(query) || w.zh.includes(query));
    $("#listTitle").textContent = `${unit().label} 全部单词`;
    $("#wordGrid").innerHTML = filtered.map(w => `<article class="word-row"><div><strong lang="en">${w.star ? "★ " : ""}${w.en}</strong><span>${w.zh}</span></div><button type="button" data-speak="${encodeURIComponent(w.en)}" aria-label="朗读 ${w.en}">▶</button></article>`).join("") || "<p>没有找到匹配的单词。</p>";
  }

  function dictationSets() {
    const groups = [];
    for (let start = 0; start < allWords.length; start += 5) groups.push(allWords.slice(start, start + 5));
    return groups;
  }

  function currentDictationWord() {
    const groups = dictationSets();
    if (dictationGroup >= groups.length) dictationGroup = Math.max(0, groups.length - 1);
    const group = groups[dictationGroup] || [];
    if (dictationIndex >= group.length) dictationIndex = Math.max(0, group.length - 1);
    return group[dictationIndex];
  }

  function updateDictationRunState(statusText = "") {
    $("#dictationAutoBtn").textContent = dictationRunning ? "暂停听写" : "开始自动听写";
    $("#dictationStatus").textContent = statusText || (dictationRunning ? "播放中" : "已就绪");
    $("#dictationStatus").classList.toggle("running", dictationRunning);
  }

  function renderDictation() {
    const groups = dictationSets();
    const group = groups[dictationGroup] || [];
    const word = currentDictationWord();
    if (!word) return;
    dictationCard.reset();
    const start = dictationGroup * 5 + 1;
    const end = start + group.length - 1;
    $("#dictationGroupLabel").textContent = `第 ${dictationGroup + 1} 组 · ${start}–${end}`;
    $("#dictationPosition").textContent = `${start + dictationIndex} / ${end}`;
    $("#dictationMeaning").textContent = word.zh;
    $("#dictationWord").textContent = word.en;
    $("#dictationGroupSelect").innerHTML = groups.map((items, groupIndex) => `<option value="${groupIndex}" ${groupIndex === dictationGroup ? "selected" : ""}>第 ${groupIndex + 1} 组（${groupIndex * 5 + 1}–${groupIndex * 5 + items.length}）</option>`).join("");
    $("#dictationProgress").innerHTML = group.map((item, itemIndex) => `<span class="${itemIndex < dictationIndex ? "done" : itemIndex === dictationIndex ? "current" : ""}"></span>`).join("");
    updateDictationRunState();
  }

  function speakDictationEnglish() {
    const word = currentDictationWord();
    if (!word) return;
    stopDictation();
    speak(word.en);
  }

  function dictationWait(milliseconds, token) {
    return new Promise(resolve => setTimeout(() => resolve(dictationRunning && token === dictationRunToken), milliseconds));
  }

  function speakChineseOnce(text, token) {
    return new Promise(resolve => {
      if (!("speechSynthesis" in window) || token !== dictationRunToken) return resolve(false);
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN"; utterance.rate = .78;
      const voice = findVoice("zh-CN");
      if (voice) utterance.voice = voice;
      utterance.onend = () => resolve(token === dictationRunToken);
      utterance.onerror = () => resolve(false);
      speechSynthesis.speak(utterance);
    });
  }

  async function speakDictationPair(token) {
    const word = currentDictationWord();
    updateDictationRunState("第 1 遍");
    if (!await speakChineseOnce(word.zh, token)) return false;
    updateDictationRunState("等待第 2 遍");
    if (!await dictationWait(Number($("#dictationRepeatDelay").value), token)) return false;
    updateDictationRunState("第 2 遍");
    return speakChineseOnce(word.zh, token);
  }

  async function startAutoDictation() {
    if (dictationRunning) return stopDictation("已暂停");
    const group = dictationSets()[dictationGroup] || [];
    if (dictationIndex >= group.length - 1) {
      dictationIndex = 0;
      renderDictation();
    }
    dictationRunning = true;
    const token = ++dictationRunToken;
    updateDictationRunState();
    while (dictationRunning && token === dictationRunToken) {
      if (!await speakDictationPair(token)) return;
      const group = dictationSets()[dictationGroup];
      if (dictationIndex === group.length - 1) {
        stopDictation("本组完成");
        toast("本组 5 个单词已听写完成！");
        return;
      }
      updateDictationRunState("留出书写时间");
      if (!await dictationWait(Number($("#dictationNextDelay").value), token)) return;
      dictationIndex += 1;
      renderDictation();
    }
  }

  async function repeatCurrentDictation() {
    stopDictation();
    dictationRunning = true;
    const token = ++dictationRunToken;
    updateDictationRunState("重听本词");
    await speakDictationPair(token);
    if (token === dictationRunToken) stopDictation("已重听");
  }

  function stopDictation(statusText = "") {
    dictationRunning = false;
    dictationRunToken += 1;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    updateDictationRunState(statusText);
  }

  function moveDictation(step) {
    stopDictation();
    const groups = dictationSets();
    const group = groups[dictationGroup] || [];
    if (step > 0 && dictationIndex === group.length - 1) {
      if (dictationGroup === groups.length - 1) return toast("已经是最后一题了");
      dictationGroup += 1; dictationIndex = 0; saveSettings();
    } else if (step < 0 && dictationIndex === 0) {
      if (dictationGroup === 0) return toast("已经是第一题了");
      dictationGroup -= 1; dictationIndex = groups[dictationGroup].length - 1; saveSettings();
    } else dictationIndex += step;
    renderDictation();
  }

  let toastTimer; function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 1800); }

  $("#unitTabs").addEventListener("click", e => { const b = e.target.closest("[data-unit]"); if (b) changeUnit(b.dataset.unit); });
  $$(".mode-button").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  $("#prevBtn").addEventListener("click", () => move(-1)); $("#nextBtn").addEventListener("click", () => move(1));
  $("#speakBtn").addEventListener("click", () => speak(current().en)); $("#slowSpeakBtn").addEventListener("click", () => speak(current().en, true));
  $("#cardSpeakBtn").addEventListener("click", e => { e.stopPropagation(); speak(current().en); }); $("#exampleSpeakBtn").addEventListener("click", e => { e.stopPropagation(); speak(current().en); });
  $("#saveBtn").addEventListener("click", e => { e.stopPropagation(); const id = current().id; saved.has(id) ? saved.delete(id) : saved.add(id); persist(); renderCard(); toast(saved.has(id) ? "已加入收藏词" : "已取消收藏"); });
  $("#masterBtn").addEventListener("click", () => { const id = current().id; mastered.has(id) ? mastered.delete(id) : mastered.add(id); persist(); renderCard(); if (mastered.has(id)) { toast("记住啦，探险船前进了一步！"); setTimeout(() => move(1), 500); } });
  $("#shuffleBtn").addEventListener("click", () => { order = shuffle(unit().words); index = 0; renderCard(); toast("单词顺序已打乱"); });
  $("#answerGrid").addEventListener("click", e => { const b = e.target.closest(".answer-button"); if (b) answerQuiz(b); });
  $("#quizNextBtn").addEventListener("click", newQuiz); $("#quizSpeakBtn").addEventListener("click", () => speak(quizWord.en));
  $("#dictationGroupSelect").addEventListener("change", e => { stopDictation(); dictationGroup = Number(e.target.value); dictationIndex = 0; saveSettings(); renderDictation(); });
  $("#dictationSpeakBtn").addEventListener("click", repeatCurrentDictation);
  $("#dictationAutoBtn").addEventListener("click", startAutoDictation);
  $("#dictationEnglishSpeakBtn").addEventListener("click", speakDictationEnglish);
  $("#dictationRestartBtn").addEventListener("click", () => { stopDictation(); dictationIndex = 0; renderDictation(); toast("已回到本组第一题"); });
  $("#dictationPrevBtn").addEventListener("click", () => moveDictation(-1)); $("#dictationNextBtn").addEventListener("click", () => moveDictation(1));
  $("#searchInput").addEventListener("input", renderList); $("#wordGrid").addEventListener("click", e => { const b = e.target.closest("[data-speak]"); if (b) speak(decodeURIComponent(b.dataset.speak)); });
  $("#voiceSettingsBtn").addEventListener("click", () => $("#voiceDialog").showModal()); $("#rateRange").addEventListener("input", e => { $("#rateOutput").textContent = `${Number(e.target.value).toFixed(2)}×`; saveSettings(); });
  $("#accentSelect").addEventListener("change", saveSettings); $("#autoSpeak").addEventListener("change", saveSettings);
  $("#dictationRepeatDelay").addEventListener("change", saveSettings); $("#dictationNextDelay").addEventListener("change", saveSettings);
  $("#reviewBtn").addEventListener("click", () => { const collection = allWords.filter(w => saved.has(w.id)); if (!collection.length) return toast("先在单词卡右上角收藏几个难词吧"); const first = collection[0]; unitId = first.unitId; order = collection.filter(w => w.unitId === unitId); index = 0; renderTabs(); setMode("learn"); renderCard(); $("#learnView").scrollIntoView({behavior:"smooth"}); });
  document.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("input, select, textarea, [contenteditable]") || $("#voiceDialog").open) return;
    if (mode !== "learn" && mode !== "dictation") return;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const step = event.key === "ArrowLeft" ? -1 : 1;
      if (mode === "learn") move(step);
      else moveDictation(step);
    } else if (event.key === " " || event.key === "Enter") {
      if (target?.closest("button, a")) return;
      event.preventDefault();
      if (!event.repeat) (mode === "learn" ? learningCard : dictationCard).toggle();
    } else if (event.key.toLowerCase() === "p") {
      event.preventDefault();
      if (mode === "learn") speak(current().en);
      else speakDictationEnglish();
    } else if (event.key.toLowerCase() === "r" && mode === "dictation") {
      event.preventDefault();
      repeatCurrentDictation();
    }
  });

  if (settings.accent) $("#accentSelect").value = settings.accent;
  if (settings.rate) $("#rateRange").value = settings.rate;
  $("#rateOutput").textContent = `${Number($("#rateRange").value).toFixed(2)}×`;
  if (settings.repeatDelay) $("#dictationRepeatDelay").value = settings.repeatDelay;
  if (settings.nextDelay) $("#dictationNextDelay").value = settings.nextDelay;
  persist(); renderTabs(); renderCard(); renderList(); newQuiz(); renderDictation();
  // 自动朗读开关要在首次 renderCard 之后恢复，避免页面一加载就发声
  if (settings.autoSpeak) $("#autoSpeak").checked = true;
})();
