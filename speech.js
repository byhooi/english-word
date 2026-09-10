// speech.js - 两个页面共用的浏览器语音朗读与本地设置读写。
(() => {
  "use strict";

  // 单词页与知识清单页共用同一个 key：口音、语速跨页面生效，页面各自的字段用前缀区分。
  const SETTINGS_KEY = "word-island-settings";
  const supported = "speechSynthesis" in window;

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") || {};
    } catch (error) {
      console.error(error);
      return {};
    }
  }

  // 合并写入，避免一个页面保存时抹掉另一个页面的字段。
  function saveSettings(patch) {
    const next = { ...loadSettings(), ...patch };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch (error) {
      console.error(error);
    }
    return next;
  }

  // Chrome 的语音列表异步加载，首次 getVoices() 常为空，需监听 voiceschanged。
  let voices = [];
  const refreshVoices = () => { if (supported) voices = speechSynthesis.getVoices(); };
  if (supported) {
    refreshVoices();
    speechSynthesis.onvoiceschanged = refreshVoices;
  }

  const normalizeLang = lang => String(lang || "").toLowerCase().replace("_", "-");

  function findVoice(language) {
    if (!voices.length) refreshVoices();
    const lang = normalizeLang(language);
    return voices.find(v => normalizeLang(v.lang) === lang)
      || voices.find(v => normalizeLang(v.lang).startsWith(lang.slice(0, 2)))
      || null;
  }

  function cancel() {
    if (supported) speechSynthesis.cancel();
  }

  // 朗读前把 "more ... than ..." 这类省略号换成 something，避免引擎读出停顿或跳过。
  const readableEnglish = text => String(text).replace(/(\.{3}|…)/g, " something ").replace(/\s+/g, " ").trim();

  // 返回 Promise：正常读完 resolve(true)，被打断或出错 resolve(false)。
  function speak(text, { lang, rate }) {
    return new Promise(resolve => {
      if (!supported) return resolve(false);
      cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      const voice = findVoice(lang);
      if (voice) utterance.voice = voice;
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      speechSynthesis.speak(utterance);
    });
  }

  const speakEnglish = (text, { accent = "en-US", rate = 0.7 } = {}) => speak(readableEnglish(text), { lang: accent, rate });
  const speakChinese = text => speak(text, { lang: "zh-CN", rate: 0.78 });

  window.Speech = { supported, loadSettings, saveSettings, findVoice, cancel, speak, speakEnglish, speakChinese, readableEnglish };
})();
