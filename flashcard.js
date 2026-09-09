// 单词卡、单词听写和知识清单听写共用的翻卡交互。
(() => {
  "use strict";

  window.createFlashcard = (card, {
    frontLabel,
    backLabel,
    toggleButton = null,
    showBackText = "查看答案",
    showFrontText = "返回题目"
  }) => {
    const front = card?.querySelector(".card-front");
    const back = card?.querySelector(".card-back");
    if (!front || !back) throw new Error("翻卡缺少正面或背面");

    let flipped = false;

    function setFlipped(value) {
      flipped = Boolean(value);
      const hiddenFace = flipped ? front : back;
      const moveFocus = hiddenFace.contains(document.activeElement);

      card.classList.toggle("flipped", flipped);
      card.setAttribute("aria-label", flipped ? backLabel : frontLabel);
      front.setAttribute("aria-hidden", String(flipped));
      back.setAttribute("aria-hidden", String(!flipped));
      front.inert = flipped;
      back.inert = !flipped;

      if (toggleButton) {
        toggleButton.textContent = flipped ? showFrontText : showBackText;
        toggleButton.setAttribute("aria-expanded", String(flipped));
        toggleButton.setAttribute("aria-controls", back.id);
      }
      if (moveFocus) card.focus({ preventScroll: true });
    }

    const toggle = () => setFlipped(!flipped);
    const reset = () => setFlipped(false);

    card.addEventListener("click", event => {
      if (!event.target.closest("button, a, input, select, textarea, [contenteditable]")) toggle();
    });
    card.addEventListener("keydown", event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target !== card || (event.key !== " " && event.key !== "Enter")) return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) toggle();
    });
    if (toggleButton) toggleButton.addEventListener("click", toggle);

    reset();
    return { toggle, reset };
  };
})();
