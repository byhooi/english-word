// dictation.js - 单词听写与知识清单听写共用的纸上听写引擎。
// 页面负责提供数据、分组大小、等待时间和朗读函数；引擎负责分组、渲染、自动播报和按钮事件。
(() => {
  "use strict";

  const byId = id => document.getElementById(id);

  window.createDictation = ({
    card,
    getItems,
    getGroupSize = () => 5,
    getRepeatDelay = () => 1200,
    getNextDelay = () => 5000,
    speakChinese,
    speakEnglish,
    toast = () => {},
    onRender = () => {},
    onPositionChange = () => {},
    completeMessage = "本组题目已全部听写完毕！"
  }) => {
    const els = {
      groupLabel: byId("dictationGroupLabel"),
      position: byId("dictationPosition"),
      progress: byId("dictationProgress"),
      meaning: byId("dictationMeaning"),
      word: byId("dictationWord"),
      status: byId("dictationStatus"),
      autoBtn: byId("dictationAutoBtn"),
      groupSelect: byId("dictationGroupSelect"),
      prevBtn: byId("dictationPrevBtn"),
      nextBtn: byId("dictationNextBtn"),
      speakBtn: byId("dictationSpeakBtn"),
      englishBtn: byId("dictationEnglishSpeakBtn"),
      restartBtn: byId("dictationRestartBtn")
    };

    let groups = [[]];
    let group = 0;
    let index = 0;
    let running = false;
    let runToken = 0;
    let lastSize = 0;

    const groupSize = () => Math.max(1, Number(getGroupSize()) || 5);
    const currentGroup = () => groups[group] || [];
    const currentItem = () => currentGroup()[index] || null;

    function rebuild() {
      const items = getItems() || [];
      const size = groupSize();
      groups = [];
      for (let start = 0; start < items.length; start += size) groups.push(items.slice(start, start + size));
      if (!groups.length) groups = [[]];
      if (group >= groups.length) group = groups.length - 1;
      if (index >= currentGroup().length) index = 0;
    }

    function renderSelect() {
      const size = groupSize();
      els.groupSelect.innerHTML = groups.map((items, i) => {
        const start = i * size + 1;
        const range = items.length ? `${start}–${start + items.length - 1}` : "空";
        return `<option value="${i}">第 ${i + 1} 组（${range}）</option>`;
      }).join("");
      els.groupSelect.value = String(group);
    }

    function updateStatus(text = "") {
      els.status.textContent = text || (running ? "播放中" : "已就绪");
      els.status.classList.toggle("running", running);
      els.autoBtn.textContent = running ? "暂停自动听写" : "开始自动听写";
    }

    function render() {
      const items = currentGroup();
      const item = currentItem();
      const start = group * groupSize() + 1;
      card.reset();
      els.groupLabel.textContent = `第 ${group + 1} 组 / 共 ${groups.length} 组`;
      els.position.textContent = items.length ? `${start + index} / ${start + items.length - 1}` : "0 / 0";
      els.progress.innerHTML = items.map((_, i) => `<span class="${i < index ? "done" : i === index ? "current" : ""}"></span>`).join("");
      els.meaning.textContent = item ? item.zh : "暂无匹配内容";
      els.word.textContent = item ? item.en : "";
      els.groupSelect.value = String(group);
      onRender(item);
      updateStatus();
      onPositionChange({ group, index });
    }

    // 令牌机制：暂停、切组、切模式后旧的计时器与朗读回调不再推进进度。
    const wait = (ms, token) => new Promise(resolve => setTimeout(() => resolve(running && token === runToken), ms));

    async function sayChinese(text, token) {
      if (token !== runToken) return false;
      const finished = await speakChinese(text);
      return finished && token === runToken;
    }

    async function speakPair(token) {
      const item = currentItem();
      if (!item) return false;
      updateStatus("第 1 遍");
      if (!await sayChinese(item.zh, token)) return false;
      updateStatus("等待第 2 遍");
      if (!await wait(Number(getRepeatDelay()) || 1200, token)) return false;
      updateStatus("第 2 遍");
      return sayChinese(item.zh, token);
    }

    function stop(statusText = "") {
      running = false;
      runToken += 1;
      window.Speech.cancel();
      updateStatus(statusText);
    }

    async function start() {
      if (running) return stop("已暂停");
      if (!currentItem()) return toast("当前范围没有可听写的内容");
      if (index >= currentGroup().length - 1) {
        index = 0;
        render();
      }
      running = true;
      const token = ++runToken;
      updateStatus();
      while (running && token === runToken) {
        if (!await speakPair(token)) return;
        if (index === currentGroup().length - 1) {
          stop("本组完成");
          toast(completeMessage);
          return;
        }
        const nextDelay = getNextDelay(currentItem());
        if (nextDelay === "manual") return stop("请书写完成后点击下一题");
        updateStatus("留出书写时间");
        if (!await wait(Number(nextDelay) || 5000, token)) return;
        index += 1;
        render();
      }
    }

    async function repeat() {
      stop();
      if (!currentItem()) return;
      running = true;
      const token = ++runToken;
      updateStatus("重听本题");
      await speakPair(token);
      if (token === runToken) stop("已重听");
    }

    function speakCurrentEnglish() {
      const item = currentItem();
      if (!item) return;
      stop();
      speakEnglish(item.en);
    }

    function move(step) {
      stop();
      const items = currentGroup();
      if (step > 0 && index >= items.length - 1) {
        if (group >= groups.length - 1) return toast("已经是最后一组最后一题了");
        group += 1;
        index = 0;
      } else if (step < 0 && index === 0) {
        if (group === 0) return toast("已经是第一题了");
        group -= 1;
        index = Math.max(0, currentGroup().length - 1);
      } else {
        index += step;
      }
      render();
    }

    function setGroup(next) {
      stop();
      group = Math.min(Math.max(0, Number(next) || 0), groups.length - 1);
      index = 0;
      render();
    }

    function restart() {
      stop();
      index = 0;
      render();
      toast("已回到本组第一题");
    }

    // 数据或分组大小变化后重新分组。不传位置时保留原位置；分组大小变了则按绝对序号换算。
    function refresh(position = {}) {
      stop();
      const size = groupSize();
      let nextGroup = position.group ?? group;
      let nextIndex = position.index ?? index;
      if (position.group === undefined && position.index === undefined && lastSize && size !== lastSize) {
        const absolute = group * lastSize + index;
        nextGroup = Math.floor(absolute / size);
        nextIndex = absolute % size;
      }
      lastSize = size;
      group = Math.max(0, Number(nextGroup) || 0);
      index = Math.max(0, Number(nextIndex) || 0);
      rebuild();
      renderSelect();
      render();
    }

    // 返回 true 表示按键已处理；页面需先排除输入框和弹窗场景。
    function handleKeydown(event) {
      const target = event.target instanceof Element ? event.target : null;
      const key = event.key;
      if (key === "ArrowLeft" || key === "ArrowRight") {
        event.preventDefault();
        move(key === "ArrowLeft" ? -1 : 1);
        return true;
      }
      if (key === " " || key === "Enter") {
        if (target?.closest("button, a")) return false;
        event.preventDefault();
        if (!event.repeat) card.toggle();
        return true;
      }
      if (key.toLowerCase() === "r") {
        event.preventDefault();
        repeat();
        return true;
      }
      if (key.toLowerCase() === "p") {
        event.preventDefault();
        speakCurrentEnglish();
        return true;
      }
      return false;
    }

    els.groupSelect.addEventListener("change", event => setGroup(event.target.value));
    els.speakBtn.addEventListener("click", repeat);
    els.autoBtn.addEventListener("click", start);
    els.prevBtn.addEventListener("click", () => move(-1));
    els.nextBtn.addEventListener("click", () => move(1));
    els.englishBtn.addEventListener("click", speakCurrentEnglish);
    els.restartBtn.addEventListener("click", restart);

    return { refresh, render, stop, start, repeat, move, restart, setGroup, speakCurrentEnglish, handleKeydown, currentItem, getState: () => ({ group, index, groupCount: groups.length }) };
  };
})();
