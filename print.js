// print.js - 两个页面共用的打印答题纸：只输出中文提示与书写线，不含英文答案。
(() => {
  "use strict";

  const escapeHtml = str => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const NUMBERS = ["一", "二", "三", "四"];

  // pages: [{ title, subtitle?, note?, sections: [{ heading, items: [{ zh }], columns?: 1 | 2, roomy?: boolean }] }]
  // 每个 page 打印成一页；内容写入 #printSheet 后调用 window.print()。
  // roomy 为 true 时行更高字略大，适合条目少的单词页。
  window.printAnswerSheet = pages => {
    const sheet = document.getElementById("printSheet");
    if (!sheet || !pages || !pages.length) return false;

    const renderSection = (section, index, total) => {
      const prefix = total > 1 ? `${NUMBERS[index] || index + 1}、` : "";
      const columns = section.columns === 1 ? "print-single" : "print-double";
      const roomy = section.roomy ? " print-roomy" : "";
      const items = section.items.map((item, n) =>
        `<li class="print-item"><b>${n + 1}</b><span class="print-zh">${escapeHtml(item.zh)}</span><span class="print-line"></span></li>`
      ).join("");
      return `<h2 class="print-section">${prefix}${escapeHtml(section.heading)}（${section.items.length} 题）</h2><ol class="print-list ${columns}${roomy}">${items}</ol>`;
    };

    sheet.innerHTML = pages.map(page => {
      const sections = (page.sections || []).filter(s => s.items && s.items.length);
      return `
        <article class="print-page">
          <header class="print-head">
            <div>
              <h1>${escapeHtml(page.title)}</h1>
              ${page.subtitle ? `<p lang="en">${escapeHtml(page.subtitle)}</p>` : ""}
            </div>
            <p class="print-info">姓名：__________　日期：__________　得分：______</p>
          </header>
          ${page.note ? `<p class="print-note">${escapeHtml(page.note)}</p>` : ""}
          ${sections.map((s, i) => renderSection(s, i, sections.length)).join("")}
        </article>`;
    }).join("");

    window.print();
    return true;
  };
})();
