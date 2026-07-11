(() => {
  const units = window.WORD_UNITS;
  const allWords = units.flatMap(unit => unit.words.map(word => ({...word, unitId: unit.id, unitLabel: unit.label})));
  const saved = new Set(JSON.parse(localStorage.getItem("word-island-saved") || "[]"));
  const mastered = new Set(JSON.parse(localStorage.getItem("word-island-mastered") || "[]"));
  let unitId = "u1", mode = "learn", index = 0, order = [], quizWord = null, quizScore = 0, answered = false;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const unit = () => units.find(item => item.id === unitId);
  const words = () => order.length ? order : unit().words;
  const current = () => words()[index] || words()[0];
  const persist = () => { localStorage.setItem("word-island-saved", JSON.stringify([...saved])); localStorage.setItem("word-island-mastered", JSON.stringify([...mastered])); };

  function speak(text, slow = false) {
    if (!("speechSynthesis" in window)) return toast("当前浏览器暂不支持语音朗读");
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = $("#accentSelect").value;
    utterance.rate = slow ? Math.max(.5, Number($("#rateRange").value) - .25) : Number($("#rateRange").value);
    const lang = utterance.lang.toLowerCase();
    const voice = speechSynthesis.getVoices().find(v => v.lang.toLowerCase() === lang) || speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(lang.slice(0,2)));
    if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
  }

  function renderTabs() {
    $("#unitTabs").innerHTML = units.map(u => `<button class="unit-tab ${u.id === unitId ? "active" : ""}" data-unit="${u.id}" role="tab" aria-selected="${u.id === unitId}">${u.label}</button>`).join("");
  }

  function renderCard(announce = false) {
    const w = current(); if (!w) return;
    $("#flashcard").classList.remove("flipped");
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
    const percent = allWords.length ? mastered.size / allWords.length * 100 : 0;
    $("#overallProgressText").textContent = `${mastered.size} / ${allWords.length}`;
    $("#routeFill").style.width = `${percent}%`; $("#routeBoat").style.left = `${percent}%`;
    $("#encourageText").textContent = percent === 100 ? "全册通关！你已经环游了整座单词岛。" : percent > 50 ? "已经走过一半航程，坚持就是超能力！" : percent > 0 ? "探险船出发了，今天也在稳稳进步。" : "从 Unit 1 出发吧，第一步最了不起！";
    $("#routeStops").innerHTML = units.map(u => `<span>${u.id === "proper" ? "名词" : u.label.replace("Unit ", "U")}</span>`).join("");
  }

  function changeUnit(nextId) { unitId = nextId; index = 0; order = []; renderTabs(); renderCard(); renderList(); newQuiz(); }
  function move(step) { index = (index + step + words().length) % words().length; renderCard(); }
  function setMode(nextMode) { mode = nextMode; $$(".mode-button").forEach(b => b.classList.toggle("active", b.dataset.mode === mode)); $$(".view").forEach(v => v.classList.remove("active")); $(`#${mode}View`).classList.add("active"); if (mode === "quiz") newQuiz(); if (mode === "list") renderList(); }

  function newQuiz() {
    answered = false; const pool = unit().words; quizWord = pool[Math.floor(Math.random() * pool.length)];
    const distractors = allWords.filter(w => w.zh !== quizWord.zh).sort(() => Math.random() - .5).slice(0,2);
    const answers = [quizWord, ...distractors].sort(() => Math.random() - .5);
    $("#quizWord").textContent = quizWord.en; $("#quizFeedback").textContent = ""; $("#quizNextBtn").classList.remove("show");
    $("#answerGrid").innerHTML = answers.map(w => `<button class="answer-button" data-id="${w.id}">${w.zh}</button>`).join("");
  }

  function answerQuiz(button) {
    if (answered) return; answered = true; const correct = button.dataset.id === quizWord.id;
    $$(".answer-button").forEach(b => { if (b.dataset.id === quizWord.id) b.classList.add("correct"); });
    if (!correct) button.classList.add("wrong");
    quizScore = correct ? quizScore + 1 : 0; $("#quizScore").textContent = quizScore;
    $("#quizFeedback").textContent = correct ? `答对了！${quizWord.en} 就是“${quizWord.zh}”。` : `再记一次：${quizWord.en} — ${quizWord.zh}`;
    $("#quizNextBtn").classList.add("show"); if (correct) { mastered.add(quizWord.id); persist(); renderStats(); }
    speak(quizWord.en, false);
  }

  function renderList() {
    const query = ($("#searchInput")?.value || "").trim().toLowerCase();
    const filtered = unit().words.filter(w => !query || w.en.toLowerCase().includes(query) || w.zh.includes(query));
    $("#listTitle").textContent = `${unit().label} 全部单词`;
    $("#wordGrid").innerHTML = filtered.map(w => `<article class="word-row"><div><strong lang="en">${w.star ? "★ " : ""}${w.en}</strong><span>${w.zh}</span></div><button type="button" data-speak="${encodeURIComponent(w.en)}" aria-label="朗读 ${w.en}">▶</button></article>`).join("") || "<p>没有找到匹配的单词。</p>";
  }

  let toastTimer; function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 1800); }

  $("#unitTabs").addEventListener("click", e => { const b = e.target.closest("[data-unit]"); if (b) changeUnit(b.dataset.unit); });
  $$(".mode-button").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  $("#prevBtn").addEventListener("click", () => move(-1)); $("#nextBtn").addEventListener("click", () => move(1));
  $("#speakBtn").addEventListener("click", () => speak(current().en)); $("#slowSpeakBtn").addEventListener("click", () => speak(current().en, true));
  $("#cardSpeakBtn").addEventListener("click", e => { e.stopPropagation(); speak(current().en); }); $("#exampleSpeakBtn").addEventListener("click", e => { e.stopPropagation(); speak(current().en); });
  $("#flashcard").addEventListener("click", e => { if (!e.target.closest("button")) $("#flashcard").classList.toggle("flipped"); });
  $("#saveBtn").addEventListener("click", e => { e.stopPropagation(); const id = current().id; saved.has(id) ? saved.delete(id) : saved.add(id); persist(); renderCard(); toast(saved.has(id) ? "已加入收藏词" : "已取消收藏"); });
  $("#masterBtn").addEventListener("click", () => { const id = current().id; mastered.has(id) ? mastered.delete(id) : mastered.add(id); persist(); renderCard(); if (mastered.has(id)) { toast("记住啦，探险船前进了一步！"); setTimeout(() => move(1), 500); } });
  $("#shuffleBtn").addEventListener("click", () => { order = [...unit().words].sort(() => Math.random() - .5); index = 0; renderCard(); toast("单词顺序已打乱"); });
  $("#answerGrid").addEventListener("click", e => { const b = e.target.closest(".answer-button"); if (b) answerQuiz(b); });
  $("#quizNextBtn").addEventListener("click", newQuiz); $("#quizSpeakBtn").addEventListener("click", () => speak(quizWord.en));
  $("#searchInput").addEventListener("input", renderList); $("#wordGrid").addEventListener("click", e => { const b = e.target.closest("[data-speak]"); if (b) speak(decodeURIComponent(b.dataset.speak)); });
  $("#voiceSettingsBtn").addEventListener("click", () => $("#voiceDialog").showModal()); $("#rateRange").addEventListener("input", e => $("#rateOutput").textContent = `${Number(e.target.value).toFixed(2)}×`);
  $("#startBtn").addEventListener("click", () => { setMode("learn"); $("#learnView").scrollIntoView({behavior:"smooth"}); renderCard(true); });
  $("#reviewBtn").addEventListener("click", () => { const collection = allWords.filter(w => saved.has(w.id)); if (!collection.length) return toast("先在单词卡右上角收藏几个难词吧"); const first = collection[0]; unitId = first.unitId; order = collection.filter(w => w.unitId === unitId); index = 0; renderTabs(); setMode("learn"); renderCard(); $("#learnView").scrollIntoView({behavior:"smooth"}); });
  document.addEventListener("keydown", e => { if (e.target.matches("input,select") || mode !== "learn") return; if (e.key === "ArrowRight") move(1); if (e.key === "ArrowLeft") move(-1); if (e.code === "Space") { e.preventDefault(); $("#flashcard").classList.toggle("flipped"); } if (e.key.toLowerCase() === "p") speak(current().en); });

  renderTabs(); renderCard(); renderList(); newQuiz();
})();
