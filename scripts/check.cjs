const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
process.chdir(path.join(__dirname, ".."));
for (const file of fs.readdirSync(".").filter(file => file.endsWith(".js"))) {
  execFileSync(process.execPath, ["--check", file]);
}
function element() {
  return { value: "", textContent: "", innerHTML: "", classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {}, setAttribute() {}, reset() {} };
}
function context(storage = {}) {
  const elements = new Map();
  const timers = [];
  const sandbox = { console, navigator: {}, localStorage: {
    getItem(key) { return storage[key] ?? null; }, setItem(key, value) { storage[key] = value; }
  }, document: { getElementById(id) {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  } }, setTimeout(fn) { timers.push(fn); }, clearTimeout() {} };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  return { sandbox, elements, timers };
}
function load(sandbox, file) { vm.runInContext(fs.readFileSync(file, "utf8"), sandbox); }
async function main() {
  const { sandbox: data } = context();
  load(data, "words.js"); load(data, "zs_data.js");
  for (const items of [data.WORD_UNITS.flatMap(u => u.words), data.ZS_DATA]) {
    assert.equal(new Set(items.map(i => i.id)).size, items.length);
    assert(items.every(i => i.en.trim() && i.zh.trim()));
  }
  // 同一单元内中文释义必须唯一，否则三选一会出现两个一模一样的选项。
  for (const unit of data.WORD_UNITS) {
    const meanings = unit.words.map(w => w.zh);
    assert.equal(new Set(meanings).size, meanings.length, `${unit.label} 存在重复释义`);
  }
  const { sandbox: speech } = context({ "word-island-settings": "[]", broken: "{" });
  load(speech, "speech.js");
  assert.equal(Object.keys(speech.Speech.loadSettings()).length, 0);
  assert.equal(speech.Speech.readData("broken", null), null);
  // 共享转义必须覆盖全部会破坏 HTML 结构的字符。
  assert.equal(
    speech.Speech.escapeHtml(`<a href="x">'&'</a>`),
    "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;"
  );
  speech.localStorage.setItem = () => { throw Error("blocked"); };
  speech.Speech.saveSettings({ accent: "en-GB" });
  speech.Speech.saveSettings({ zsUnit: "u2" });
  assert.equal(speech.Speech.loadSettings().accent, "en-GB");
  assert.equal(speech.Speech.loadSettings().zsUnit, "u2");
  assert(speech.Speech.storageFailed);
  const { sandbox: sandboxProgress } = context();
  load(sandboxProgress, "progress.js");
  const Progress = sandboxProgress.Progress;

  // 旧 ID 迁移：按位置映射到新 slug，脏数据与失效 ID 一并丢弃。
  const legacy = Progress.buildLegacyIdMap(data.WORD_UNITS);
  const firstWord = data.WORD_UNITS[0].words[0];
  const validIds = new Set(data.WORD_UNITS.flatMap(u => u.words.map(w => w.id)));
  const migrated = Progress.normalizeIds([`${data.WORD_UNITS[0].id}-0`, "missing-id", firstWord.id], { legacyIdMap: legacy, validIds });
  assert.equal(migrated.length, 2, "旧 ID 应迁移到新 ID，失效 ID 应被丢弃");
  assert.equal(migrated.join(","), `${firstWord.id},${firstWord.id}`);
  // 沙箱（vm）里返回的数组来自另一个 realm，只比较长度与内容，不比较原型。
  assert.equal(Progress.normalizeIds("not-an-array", { legacyIdMap: legacy, validIds }).length, 0);

  // 答错记入错词并撤销掌握；答对既不加错词也不自动掌握。
  {
    const mistakes = new Set(), mastered = new Set([firstWord.id]);
    Progress.applyQuizAnswer({ correct: false, wordId: firstWord.id, mistakes, mastered });
    assert(mistakes.has(firstWord.id), "答错应记入错词");
    assert(!mastered.has(firstWord.id), "答错应撤销已掌握");

    const m2 = new Set(), s2 = new Set();
    Progress.applyQuizAnswer({ correct: true, wordId: firstWord.id, mistakes: m2, mastered: s2 });
    assert(!m2.has(firstWord.id), "答对不应自动加入错词");
    assert(!s2.has(firstWord.id), "答对不应自动标记掌握");
  }

  // 主动掌握会清除错词；再次点击取消掌握不影响收藏。
  {
    const mistakes = new Set([firstWord.id]), mastered = new Set(), saved = new Set([firstWord.id]);
    const first = Progress.toggleMastered({ wordId: firstWord.id, mastered, mistakes });
    assert(first.nowMastered);
    assert(!mistakes.has(firstWord.id), "标记掌握应清除错词");
    const second = Progress.toggleMastered({ wordId: firstWord.id, mastered, mistakes });
    assert(!second.nowMastered && !mastered.has(firstWord.id));
    assert(saved.has(firstWord.id), "掌握状态不应影响收藏");
  }

  // 收藏是独立开关，不影响掌握与错词。
  {
    const saved = new Set(), mastered = new Set([firstWord.id]), mistakes = new Set([firstWord.id]);
    assert(Progress.toggleSaved({ wordId: firstWord.id, saved }).nowSaved);
    assert(saved.has(firstWord.id));
    assert(mastered.has(firstWord.id) && mistakes.has(firstWord.id), "收藏不应改动掌握或错词");
    assert(!Progress.toggleSaved({ wordId: firstWord.id, saved }).nowSaved);
    assert(!saved.has(firstWord.id));
  }

  // 三选一：三个选项释义互不相同，正确答案一定在内，且不去重时不重复抽取同一词。
  {
    const allWords = data.WORD_UNITS.flatMap(u => u.words);
    for (const word of allWords.slice(0, 40)) {
      const answers = Progress.buildAnswers({ word, allWords, shuffle: list => [...list] });
      assert.equal(answers.length, 3, `${word.en} 应生成 3 个选项`);
      assert.equal(new Set(answers.map(a => a.zh)).size, 3, `${word.en} 的选项释义重复`);
      assert(answers.some(a => a.id === word.id), `${word.en} 缺少正确选项`);
      assert.equal(new Set(answers.map(a => a.id)).size, 3, `${word.en} 抽到了重复的词`);
    }
  }

  // 判定只比较 id：选项文案变化不影响对错。
  {
    assert(Progress.isCorrectAnswer({ pickedId: firstWord.id, word: firstWord }));
    assert(!Progress.isCorrectAnswer({ pickedId: "whatever", word: firstWord }));
    assert(!Progress.isCorrectAnswer({ pickedId: firstWord.id, word: null }));
  }

  const { sandbox, elements, timers } = context();
  sandbox.Speech = { cancel() {}, escapeHtml: str => String(str) };
  load(sandbox, "dictation.js");
  let spoken = [], fail = false, reject = false, size = 5;
  const engine = sandbox.createDictation({ card: { reset() {} },
    getItems: () => Array.from({ length: 5 }, (_, i) => ({ zh: String(i), en: String(i) })),
    getGroupSize: () => size,
    speakChinese: async text => { spoken.push(text); if (reject) throw Error("voice"); return !fail; },
    speakEnglish() {} });
  const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
  engine.refresh({ index: 4 });
  const run = engine.start(); await flush();
  assert.equal(spoken[0], "4", "最后一题开始不应重置");
  engine.stop(); timers.shift()(); await run;
  assert.equal(engine.getState().index, 4);
  fail = true; await engine.start();
  assert.equal(elements.get("dictationAutoBtn").textContent, "开始自动听写");
  fail = false; reject = true; await engine.start();
  assert.match(elements.get("dictationStatus").textContent, /朗读未完成/);
  reject = false; spoken = [];
  const complete = engine.start(); await flush(); timers.shift()(); await complete;
  assert.equal(spoken.join(","), "4,4");
  const restart = engine.start(); await flush();
  assert.equal(engine.getState().index, 0);
  engine.stop(); timers.shift()(); await restart;
  engine.refresh({ index: 4 }); size = 2; engine.refresh();
  assert.equal(engine.getState().group, 2);
  assert.equal(engine.getState().index, 0);
  console.log("通过：全部 JS 语法、数据唯一性与释义去重、HTML 转义、存储降级、学习进度规则（收藏/掌握/错词/测验选项）、听写恢复/失败/取消/分组检查");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
