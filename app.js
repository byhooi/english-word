(() => {
  const Speech = window.Speech;
  const units = window.WORD_UNITS;
  const allWords = units.flatMap(unit => unit.words.map(word => ({...word, unitId: unit.id, unitLabel: unit.label})));
  const validIds = new Set(allWords.map(word => word.id));
  // 旧版进度用"单元-序号"作 ID，按位置映射到新的"单元-英文"ID，无法识别的脏数据直接丢弃
  const legacyIdMap = new Map();
  units.forEach(unit => unit.words.forEach((word, wordIndex) => legacyIdMap.set(`${unit.id}-${wordIndex}`, word.id)));
  const loadIds = key => {
    const value = Speech.readData(key, []);
    return (Array.isArray(value) ? value : []).map(id => legacyIdMap.get(id) || id).filter(id => validIds.has(id));
  };
  const saved = new Set(loadIds("word-island-saved"));
  const mastered = new Set(loadIds("word-island-mastered"));
  const mistakes = new Set(loadIds("word-island-mistakes"));
  const settings = Speech.loadSettings();
  let unitId = units.some(u => u.id === settings.dictationUnit) ? settings.dictationUnit : "u1";
  let mode = "learn", index = 0, order = [], quizWord = null, quizScore = 0, answered = false;
  // 旧版只记录全册组号，不能直接用作单元内组号。
  let dictationGroup = settings.dictationUnit === unitId && Number.isInteger(Number(settings.dictationGroup)) ? Number(settings.dictationGroup) : 0;
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

  let advanceTimer;
  let reviewLabel = "";
  let quizQueue = [], quizTotal = 0, quizCorrect = 0;
  const cancelAdvance = () => { clearTimeout(advanceTimer); };
  const unit = () => units.find(item => item.id === unitId);
  const words = () => order.length ? order : unit().words;
  const current = () => words()[index] || words()[0];
  const persist = () => {
    Speech.writeData("word-island-saved", [...saved]);
    Speech.writeData("word-island-mastered", [...mastered]);
    Speech.writeData("word-island-mistakes", [...mistakes]);
  };
  // 口音与语速和知识清单页共用；其余字段只属于本页
  const saveSettings = () => Speech.saveSettings({ accent: $("#accentSelect").value, rate: $("#rateRange").value, autoSpeak: $("#autoSpeak").checked, repeatDelay: $("#dictationRepeatDelay").value, nextDelay: $("#dictationNextDelay").value, dictationUnit: unitId, dictationGroup });

  function speak(text, slow = false) {
    if (!Speech.supported) return toast("当前浏览器暂不支持语音朗读");
    const rate = Number($("#rateRange").value);
    Speech.speakEnglish(text, { accent: $("#accentSelect").value, rate: slow ? Math.max(.45, rate - .15) : rate });
  }

  function renderTabs() {
    $("#unitTabs").innerHTML = units.map(u => `<button class="unit-tab ${u.id === unitId ? "active" : ""}" data-unit="${u.id}" role="tab" aria-selected="${u.id === unitId}">${u.label}</button>`).join("");
  }

  function renderCard(announce = false) {
    const w = current(); if (!w) return;
    learningCard.reset();
    const wordEl = $("#wordText");
    const meaningEl = $("#meaningText");
    wordEl.textContent = w.en;
    $("#backWord").textContent = w.en;
    meaningEl.textContent = w.zh;
    const len = w.en.length;
    wordEl.classList.toggle("long-word", len > 12 && len <= 20);
    wordEl.classList.toggle("xlong-word", len > 20);
    meaningEl.classList.toggle("long-meaning", w.zh.length > 8);
    $("#wordType").textContent = w.star ? "CORE WORD · 重点词" : (units.find(u => u.words.some(word => word.id === w.id)) || unit()).theme.toUpperCase();
    $("#phoneticText").textContent = "点击播放标准发音";
    $("#cardPosition").textContent = `${index + 1} / ${words().length}`;
    $("#saveBtn").textContent = saved.has(w.id) ? "★" : "☆"; $("#saveBtn").classList.toggle("saved", saved.has(w.id));
    $("#masterBtn").textContent = mastered.has(w.id) ? "已记住 ✓" : "我记住了"; $("#masterBtn").classList.toggle("mastered", mastered.has(w.id));
    $("#saveBtn").setAttribute("aria-pressed", String(saved.has(w.id)));
    $("#masterBtn").setAttribute("aria-pressed", String(mastered.has(w.id)));
    renderStats(); if (mode === "learn" && (announce || $("#autoSpeak").checked)) speak(w.en);
  }

  function renderStats() {
    const currentIds = (reviewLabel ? words() : unit().words).map(w => w.id);
    $("#unitHeading").textContent = reviewLabel || unit().label;
    $("#unitCount").textContent = reviewLabel ? `共 ${words().length} 个词 · 当前词属于 ${allWords.find(w => w.id === current()?.id)?.unitLabel || unit().label}` : `${unit().theme} · 共 ${unit().words.length} 个词`;
    $("#exitReviewBtn").hidden = !reviewLabel;
    $("#knownCount").textContent = currentIds.filter(id => mastered.has(id)).length;
    $("#savedCount").textContent = currentIds.filter(id => saved.has(id)).length;
  }

  function changeUnit(nextId, nextOrder = []) {
    cancelAdvance(); reviewLabel = "";
    unitId = nextId; index = 0; order = nextOrder;
    dictation.refresh({ group: 0, index: 0 });
    saveSettings();
    renderTabs(); renderCard(); renderList(); startQuiz();
  }
  function move(step) { cancelAdvance(); index = (index + step + words().length) % words().length; renderCard(); }
  function setMode(nextMode) {
    cancelAdvance();
    if (mode === "dictation" && nextMode !== "dictation") dictation.stop();
    mode = nextMode;
    $$(".mode-button").forEach(button => button.classList.toggle("active", button.dataset.mode === mode));
    $$(".view").forEach(view => view.classList.remove("active"));
    $(`#${mode}View`).classList.add("active");
    if (mode === "learn") renderCard();
    if (mode === "quiz") startQuiz();
    if (mode === "dictation") dictation.render();
    if (mode === "list") renderList();
  }

  function shuffle(list) {
    const items = [...list];
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
    return items;
  }

  function startQuiz() {
    quizQueue = shuffle(unit().words).slice(0, 10);
    quizTotal = quizQueue.length; quizCorrect = 0; quizScore = 0;
    $("#quizScore").textContent = "0";
    newQuiz();
  }

  function newQuiz() {
    if (!quizQueue.length) return startQuiz();
    answered = false; quizWord = quizQueue.shift();
    $("#quizPromptLabel").textContent = `第 ${quizTotal - quizQueue.length} / ${quizTotal} 题：请选择正确的中文意思`;
    $("#quizNextBtn").textContent = "下一题";
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
    if (correct) quizCorrect += 1; else { mistakes.add(quizWord.id); mastered.delete(quizWord.id); }
    persist(); renderStats();
    $("#quizFeedback").textContent = correct ? `答对了！${quizWord.en} 就是“${quizWord.zh}”。` : `再记一次：${quizWord.en} — ${quizWord.zh}，已加入错词复习。`;
    if (!quizQueue.length) {
      $("#quizFeedback").textContent += ` 本轮完成：${quizCorrect} / ${quizTotal} 题正确。`;
      $("#quizNextBtn").textContent = "再练一轮";
    }
    $("#quizNextBtn").classList.add("show");
    speak(quizWord.en, false);
  }

  function renderList() {
    const query = ($("#searchInput")?.value || "").trim().toLowerCase();
    const filtered = unit().words.filter(w => !query || w.en.toLowerCase().includes(query) || w.zh.includes(query));
    $("#listTitle").textContent = `${unit().label} 全部单词`;
    $("#wordGrid").innerHTML = filtered.map(w => `<article class="word-row"><div><strong lang="en">${w.star ? "★ " : ""}${w.en}</strong><span>${w.zh}</span></div><button type="button" data-speak="${encodeURIComponent(w.en)}" aria-label="朗读 ${w.en}">▶</button></article>`).join("") || "<p>没有找到匹配的单词。</p>";
  }

  // 单元听写：当前单元的完整词表按原顺序固定每 5 个一组，不受翻卡顺序影响。
  const dictation = window.createDictation({
    card: dictationCard,
    getItems: () => unit().words,
    getGroupSize: () => 5,
    getRepeatDelay: () => $("#dictationRepeatDelay").value,
    getNextDelay: () => $("#dictationNextDelay").value,
    speakChinese: Speech.speakChinese,
    speakEnglish: text => speak(text),
    toast,
    completeMessage: "本组单词已全部听写完成！",
    onRender: () => { $("#dictationTitle").textContent = `${unit().label} 顺序听写`; },
    onPositionChange: ({ group }) => { if (group !== dictationGroup) { dictationGroup = group; saveSettings(); } }
  });

  let toastTimer; function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 1800); }

  $("#unitTabs").addEventListener("click", e => { const b = e.target.closest("[data-unit]"); if (b) changeUnit(b.dataset.unit); });
  $$(".mode-button").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  $("#prevBtn").addEventListener("click", () => move(-1)); $("#nextBtn").addEventListener("click", () => move(1));
  $("#speakBtn").addEventListener("click", () => speak(current().en)); $("#slowSpeakBtn").addEventListener("click", () => speak(current().en, true));
  $("#cardSpeakBtn").addEventListener("click", e => { e.stopPropagation(); speak(current().en); }); $("#exampleSpeakBtn").addEventListener("click", e => { e.stopPropagation(); speak(current().en); });
  $("#saveBtn").addEventListener("click", e => { e.stopPropagation(); const id = current().id; saved.has(id) ? saved.delete(id) : saved.add(id); persist(); renderCard(); toast(saved.has(id) ? "已加入收藏词" : "已取消收藏"); });
  $("#masterBtn").addEventListener("click", () => { const id = current().id; mastered.has(id) ? mastered.delete(id) : mastered.add(id); if (mastered.has(id)) mistakes.delete(id); cancelAdvance(); persist(); renderCard(); if (mastered.has(id)) { toast("记住啦，探险船前进了一步！"); cancelAdvance();
      const expectedId = id, expectedUnit = unitId;
      advanceTimer = setTimeout(() => {
        if (mode === "learn" && unitId === expectedUnit && current()?.id === expectedId && mastered.has(id)) move(1);
      }, 500); } });
  $("#shuffleBtn").addEventListener("click", () => { cancelAdvance(); order = shuffle(reviewLabel ? words() : unit().words); index = 0; renderCard(); toast("单词顺序已打乱"); });
  $("#answerGrid").addEventListener("click", e => { const b = e.target.closest(".answer-button"); if (b) answerQuiz(b); });
  $("#quizNextBtn").addEventListener("click", newQuiz); $("#quizSpeakBtn").addEventListener("click", () => speak(quizWord.en));
  $("#searchInput").addEventListener("input", renderList); $("#wordGrid").addEventListener("click", e => { const b = e.target.closest("[data-speak]"); if (b) speak(decodeURIComponent(b.dataset.speak)); });
  $("#voiceSettingsBtn").addEventListener("click", () => $("#voiceDialog").showModal()); $("#rateRange").addEventListener("input", e => { $("#rateOutput").textContent = `${Number(e.target.value).toFixed(2)}×`; saveSettings(); });
  $("#accentSelect").addEventListener("change", saveSettings); $("#autoSpeak").addEventListener("change", saveSettings);
  $("#dictationRepeatDelay").addEventListener("change", saveSettings); $("#dictationNextDelay").addEventListener("change", saveSettings);
  function review(ids, label, currentUnitOnly = false) {
    const collection = allWords.filter(w => ids.has(w.id) && (!currentUnitOnly || w.unitId === unitId));
    if (!collection.length) return toast("当前范围没有待复习的单词");
    setMode("learn");
    order = collection; index = 0; reviewLabel = label;
    renderCard();
    toast(ids === mistakes ? "记住错词后，下次错词复习将不再出现" : "收藏复习列表已生成");
  }
  $("#reviewBtn").addEventListener("click", () => review(saved, "全部收藏"));
  $("#unitReviewBtn").addEventListener("click", () => review(saved, `${unit().label} 收藏`, true));
  $("#mistakeReviewBtn").addEventListener("click", () => review(mistakes, "错词复习"));
  $("#exitReviewBtn").addEventListener("click", () => changeUnit(unitId));
  // 打印当前单元的听写答题纸：只有中文提示与书写线，不含英文
  $("#printSheetBtn").addEventListener("click", () => { dictation.stop(); window.printAnswerSheet([{ title: `单词听写 · ${unit().label} ${unit().theme}`, sections: [{ heading: "本单元单词", items: unit().words, columns: 2, roomy: true }] }]); });
  document.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("input, select, textarea, [contenteditable]") || $("#voiceDialog").open) return;
    if (mode === "dictation") return void dictation.handleKeydown(event);
    if (mode !== "learn") return;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      move(event.key === "ArrowLeft" ? -1 : 1);
    } else if (event.key === " " || event.key === "Enter") {
      if (target?.closest("button, a")) return;
      event.preventDefault();
      if (!event.repeat) learningCard.toggle();
    } else if (event.key.toLowerCase() === "p") {
      event.preventDefault();
      speak(current().en);
    }
  });

  if (settings.accent) $("#accentSelect").value = settings.accent;
  if (settings.rate) $("#rateRange").value = settings.rate;
  $("#rateOutput").textContent = `${Number($("#rateRange").value).toFixed(2)}×`;
  if (settings.repeatDelay) $("#dictationRepeatDelay").value = settings.repeatDelay;
  if (settings.nextDelay) $("#dictationNextDelay").value = settings.nextDelay;
  persist(); renderTabs(); renderCard(); renderList(); startQuiz(); dictation.refresh({ group: dictationGroup, index: 0 });
  // 自动朗读开关要在首次 renderCard 之后恢复，避免页面一加载就发声
  if (settings.autoSpeak) $("#autoSpeak").checked = true;
  if (Speech.storageFailed) toast("本地存储异常，本次进度可能无法保存");
})();
