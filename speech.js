// speech.js - 两个页面共用的浏览器语音朗读与本地设置读写。
(() => {
  "use strict";

  // 单词页与知识清单页共用同一个 key：口音、语速跨页面生效，页面各自的字段用前缀区分。
  const SETTINGS_KEY = "word-island-settings";
  const memory = new Map();
  let storageFailed = false;
  function readData(key, fallback) {
    try {
      const raw = memory.has(key) ? memory.get(key) : localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      storageFailed = true;
      return fallback;
    }
  }
  function writeData(key, value) {
    const raw = JSON.stringify(value);
    try {
      localStorage.setItem(key, raw);
      memory.delete(key);
    } catch (error) {
      memory.set(key, raw);
      storageFailed = true;
    }
  }
  const supported = "speechSynthesis" in window;
  // iOS 和 Edge 统一人名读音；iPadOS 桌面模式按触控点数识别。
  const useChineseName = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    || /\b(?:Edg|EdgA|EdgiOS|Edge)\//.test(navigator.userAgent);

  function loadSettings() {
    try {
      const value = readData(SETTINGS_KEY, {});
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch (error) {
      console.error(error);
      return {};
    }
  }

  // 合并写入，避免一个页面保存时抹掉另一个页面的字段。
  function saveSettings(patch) {
    const next = { ...loadSettings(), ...patch };
    try {
      writeData(SETTINGS_KEY, next);
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

  let runToken = 0;
  let finishCurrent = null;

  function cancel() {
    runToken += 1;
    // 有些浏览器取消语音后不触发回调，主动结束等待，阻止旧句子的后半段继续播放。
    if (finishCurrent) finishCurrent(false);
    if (supported) speechSynthesis.cancel();
  }

  // 朗读前把 "more ... than ..." 这类省略号换成 something，避免引擎读出停顿或跳过。
  const readableEnglish = text => String(text).replace(/(\.{3}|…)/g, " something ").replace(/\s+/g, " ").trim();

  // 提前排入整句的各段，避免每读完一段才重新启动下一种音色。
  // 整段朗读共用令牌：正常读完返回 true，取消或出错返回 false。
  function speakParts(parts) {
    cancel();
    const token = runToken;
    return new Promise(resolve => {
      if (!supported) return resolve(false);
      if (!parts.length) return resolve(true);
      let remaining = parts.length;
      const finish = finished => {
        if (finishCurrent === finish) finishCurrent = null;
        resolve(finished && token === runToken);
      };
      finishCurrent = finish;
      for (const { text, lang, rate } of parts) {
        if (token !== runToken) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = rate;
        const voice = findVoice(lang);
        if (voice) utterance.voice = voice;
        utterance.onend = () => {
          if (token !== runToken) return;
          remaining -= 1;
          if (!remaining) finish(true);
        };
        utterance.onerror = () => {
          // 任一段出错时清空后续队列，旧句子的回调不能停止新句子。
          if (token === runToken) cancel();
        };
        speechSynthesis.speak(utterance);
      }
    });
  }

  const speak = (text, { lang, rate }) => speakParts([{ text, lang, rate }]);

  function speakEnglish(text, { accent = "en-US", rate = 0.7 } = {}) {
    const readable = readableEnglish(text);
    if (!useChineseName) return speak(readable, { lang: accent, rate });
    // iOS 和 Edge 都用普通话读“小月”，随后连续播放英文。
    const parts = readable.split(/(\bXiaoyue\b[,，.!?;:]*)/gi).map((part, index) => ({
      // 分段本身已有停顿，省去姓名后的逗号，并清理英文段首尾空白。
      text: index % 2 ? part.replace(/Xiaoyue/i, "小月").replace(/[,，]+$/, "") : part.trim(),
      lang: index % 2 ? "zh-CN" : accent,
      rate
    })).filter(part => part.text.trim());
    return speakParts(parts);
  }
  const speakChinese = text => speak(text, { lang: "zh-CN", rate: 0.78 });

  window.Speech = { readData, writeData, get storageFailed() { return storageFailed; }, supported, loadSettings, saveSettings, findVoice, cancel, speak, speakEnglish, speakChinese, readableEnglish };
})();
