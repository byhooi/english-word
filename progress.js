// progress.js - 单词页的纯业务规则：收藏、错词、掌握状态与测验选项。
// 没有 DOM 依赖，页面与 scripts/check.cjs 共用同一份实现，避免规则只在浏览器里被验证。
(() => {
  "use strict";

  // 旧版进度用"单元-序号"作 ID，按位置映射到新的"单元-英文"ID，无法识别的脏数据直接丢弃。
  function buildLegacyIdMap(units) {
    const map = new Map();
    units.forEach(unit => unit.words.forEach((word, wordIndex) => map.set(`${unit.id}-${wordIndex}`, word.id)));
    return map;
  }

  // 读取时统一迁移旧 ID 并过滤掉已经不存在的词。
  function normalizeIds(raw, { legacyIdMap, validIds }) {
    const list = Array.isArray(raw) ? raw : [];
    return list.map(id => legacyIdMap.get(id) || id).filter(id => validIds.has(id));
  }

  // 答错时记入错词并撤销已掌握；答对不自动标记掌握，也不清除错词。
  function applyQuizAnswer({ correct, wordId, mistakes, mastered }) {
    if (correct) return { mistakes, mastered };
    mistakes.add(wordId);
    mastered.delete(wordId);
    return { mistakes, mastered };
  }

  // 主动"我记住了"：标记掌握并清除该词的错词记录。
  function toggleMastered({ wordId, mastered, mistakes }) {
    const nowMastered = !mastered.has(wordId);
    if (nowMastered) {
      mastered.add(wordId);
      mistakes.delete(wordId);
    } else {
      mastered.delete(wordId);
    }
    return { nowMastered, mistakes, mastered };
  }

  // 收藏只影响收藏集合，不碰掌握状态与错词。
  function toggleSaved({ wordId, saved }) {
    const nowSaved = !saved.has(wordId);
    if (nowSaved) saved.add(wordId);
    else saved.delete(wordId);
    return { nowSaved, saved };
  }

  // 三选一：正确答案 + 两个释义不同的干扰项，选项顺序打乱。
  const buildAnswers = ({ word, allWords, shuffle }) => {
    const usedMeanings = new Set([word.zh]);
    const distractors = [];
    for (const candidate of shuffle(allWords)) {
      if (usedMeanings.has(candidate.zh)) continue;
      usedMeanings.add(candidate.zh);
      distractors.push(candidate);
      if (distractors.length === 2) break;
    }
    return shuffle([word, ...distractors]);
  };

  // 测验每题判定只比较 id，不受选项文案影响。
  const isCorrectAnswer = ({ pickedId, word }) => Boolean(word) && pickedId === word.id;

  window.Progress = {
    buildLegacyIdMap,
    normalizeIds,
    applyQuizAnswer,
    toggleMastered,
    toggleSaved,
    buildAnswers,
    isCorrectAnswer
  };
})();
