// 영문 정책 문서(docs/policies/en/*.md, 기획 초안)를 화면용 HTML로 바꾸는 작은 변환기 — 새 의존성 없이.
// 문서가 쓰는 것만: 제목(#·##·###), 문단, 굵게(**), 기울임(*), 목록(- / 1.), 표(|), 이메일·주소 링크.
// 모든 글자는 먼저 이스케이프하므로 문서 안 글자가 HTML로 실행되지 않는다(테스트 md.test.ts).
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function inline(s: string): string {
  let t = esc(s);
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, "$1<em>$2</em>");
  t = t.replace(/\b([\w.+-]+@[\w-]+\.[\w.-]*\w)\b/g, '<a href="mailto:$1">$1</a>');
  t = t.replace(/\b((?:tools\.google\.com|findahelpline\.com)[\w/.-]*)/g, '<a href="https://$1" target="_blank" rel="noopener">$1</a>');
  return t;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** md → html. 첫 # 제목은 빼고(페이지가 따로 그림) 나머지를 돌려준다. idPrefix로 소제목 앵커를 만든다. */
export function mdToHtml(md: string, idPrefix = ""): { title: string; html: string } {
  const lines = md.replace(/\r/g, "").split("\n");
  let title = "";
  const out: string[] = [];
  let i = 0;
  const para: string[] = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para.length = 0;
  };
  while (i < lines.length) {
    const line = lines[i];
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      if (h[1].length === 1 && !title) title = h[2].trim();
      else out.push(`<h${h[1].length + 1} id="${idPrefix}${slug(h[2])}">${inline(h[2].trim())}</h${h[1].length + 1}>`);
      i++;
      continue;
    }
    if (/^\s*\|/.test(line)) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{3,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        `<div class="tbl"><table>${head.every((c) => !c) ? "" : `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`}<tbody>${body
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`,
      );
      continue;
    }
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (ul || ol) {
      flush();
      const tag = ul ? "ul" : "ol";
      const items: string[] = [];
      while (i < lines.length) {
        const m = (ul ? /^\s*[-*]\s+(.*)$/ : /^\s*\d+\.\s+(.*)$/).exec(lines[i]);
        if (!m) break;
        items.push(`<li>${inline(m[1])}</li>`);
        i++;
      }
      out.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }
    if (!line.trim()) flush();
    else para.push(line.trim());
    i++;
  }
  flush();
  return { title, html: out.join("\n") };
}
