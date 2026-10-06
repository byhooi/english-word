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
  const { sandbox: speech } = context({ "word-island-settings": "[]", broken: "{" });
  load(speech, "speech.js");
  assert.equal(Object.keys(speech.Speech.loadSettings()).length, 0);
  assert.equal(speech.Speech.readData("broken", null), null);
  speech.localStorage.setItem = () => { throw Error("blocked"); };
  speech.Speech.saveSettings({ accent: "en-GB" });
  speech.Speech.saveSettings({ zsUnit: "u2" });
  assert.equal(speech.Speech.loadSettings().accent, "en-GB");
  assert.equal(speech.Speech.loadSettings().zsUnit, "u2");
  assert(speech.Speech.storageFailed);
  const { sandbox, elements, timers } = context();
  sandbox.Speech = { cancel() {} };
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
  console.log("通过：全部 JS 语法、数据唯一性、存储降级、听写恢复/失败/取消/分组检查");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
