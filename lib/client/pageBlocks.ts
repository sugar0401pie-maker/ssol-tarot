// 결과 쪽 본문(줄 글) → 화면 블록. 순수 함수(브라우저·서버 어디서나, 단위 테스트 있음).
// 규칙은 owner 시안 docs/design/result-swipe-preview-v4.html의 렌더링을 그대로 따른다:
//   빈 줄 = 블록 구분 · "## " 메인 문구(첫 쉼표 뒤 줄바꿈) · 소제목 목록에 있는 줄 = 소제목(곱씹기 질문 제목만 큰 소제목)
//   줄 전체가 **…** = 요약 줄(sum) · "◦ " 줄이 이어지면 목록 · "▸ " 다리 문장 · "• 제목" + 다음 줄 = 처방·실천 항목
//   "※ " 작은 글씨 · [[읽기 지도: …]] = 세 장 지도 · "[버튼 문구]" = 버튼 · 1쪽의 카드 이미지 줄·"N. 자리 · 카드" 줄·"#키워드" 줄
//   그 밖은 문단(줄 안의 **…**는 굵게).

export type Inline = { text: string; bold: boolean }[];

export type ForceDir = "up" | "flat" | "down";
export type MapCell = { position: string; name: string; reversed: boolean; force: string; dir: ForceDir };

export type Block =
  | { type: "headline"; lines: string[] }
  | { type: "sub"; text: string }
  | { type: "sec"; text: string }
  | { type: "sum"; text: string }
  | { type: "list"; items: Inline[] }
  | { type: "bridge"; text: string }
  | { type: "item"; title: string; body: Inline | null }
  | { type: "fine"; text: string }
  | { type: "map"; cells: MapCell[] }
  | { type: "button"; text: string }
  | { type: "strip" }
  | { type: "mini"; position: string; name: string; character: string; reversed: boolean }
  | { type: "kw"; tags: string[] }
  | { type: "p"; inline: Inline };

export type ParseOpts = {
  subheads: string[]; // 작은 소제목(h4)으로 그릴 고정 줄
  secHeads: string[]; // 큰 소제목(h3.sec)으로 그릴 고정 줄 — "이 질문들을 곱씹어 볼까요?"
  planHeadSuffix?: string; // 관계형 계획 머리말("‘{선택지}’ 쪽으로 정했다면, 이번 주에 이것부터")처럼 목록에 없는 소제목의 끝말
  positions: string[]; // 자리 이름(지나온 길·지금의 흐름·앞으로의 열쇠) — 읽기 지도에서 자리와 카드명을 가름
  forceLabels: Record<ForceDir, string[]>;
};

export function parseInline(s: string): Inline {
  const out: Inline = [];
  const parts = s.split("**");
  // 짝이 맞지 않는 **는 글자 그대로 둔다(굵게 처리하다 문장이 통째로 굵어지는 것을 막음)
  if (parts.length % 2 === 0) return [{ text: s, bold: false }];
  parts.forEach((t, i) => {
    if (t) out.push({ text: t, bold: i % 2 === 1 });
  });
  return out;
}

// 메인 문구가 길면 첫 쉼표 뒤에서 줄을 바꾼다(copy.result.headline_break).
export function splitHeadline(s: string): string[] {
  const i = s.indexOf(", ");
  return i < 0 ? [s] : [s.slice(0, i + 1), s.slice(i + 2)];
}

const WHOLE_BOLD = /^\*\*([^*]+)\*\*$/;
const MINI = /^\d+\.\s+(.+?)\s+·\s+(.+?)\s+—\s+(.+?)(\s*\(역방향\))?$/;
const MAP = /^\[\[읽기 지도:\s*(.+)\]\]$/;
const BUTTON = /^\[([^\]]+)\]$/;

function mapCells(src: string, o: ParseOpts): MapCell[] {
  return src.split(/\s+→\s+/).map((seg) => {
    const [left, ...rest] = seg.split(" — ");
    const force = rest.join(" — ").trim();
    const position = o.positions.find((p) => left.startsWith(p + " ")) ?? "";
    let name = (position ? left.slice(position.length) : left).trim();
    const reversed = /\(역방향\)$/.test(name);
    name = name.replace(/\s*\(역방향\)$/, "");
    const dir = (["up", "down", "flat"] as ForceDir[]).find((d) => (o.forceLabels[d] ?? []).includes(force)) ?? "flat";
    return { position, name, reversed, force, dir };
  });
}

function isSub(line: string, o: ParseOpts) {
  return o.subheads.includes(line) || Boolean(o.planHeadSuffix && line.endsWith(o.planHeadSuffix) && line.length <= 40 && !line.includes("**"));
}

export function parseBlocks(text: string | null | undefined, o: ParseOpts): Block[] {
  if (!text) return [];
  const out: Block[] = [];
  for (const chunk of String(text).split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("## ")) out.push({ type: "headline", lines: splitHeadline(line.slice(3).trim()) });
      else if (o.secHeads.includes(line)) out.push({ type: "sec", text: line });
      else if (isSub(line, o)) out.push({ type: "sub", text: line });
      else if (line.startsWith("◦ ")) {
        const items: Inline[] = [];
        while (i < lines.length && lines[i].startsWith("◦ ")) items.push(parseInline(lines[i++].slice(2).trim()));
        i--;
        out.push({ type: "list", items });
      } else if (line.startsWith("▸ ")) out.push({ type: "bridge", text: line.slice(2).trim() });
      else if (line.startsWith("• ")) {
        const next = lines[i + 1];
        const takesNext = next !== undefined && !/^(• |◦ |▸ |※ |## |\[)/.test(next) && !isSub(next, o) && !o.secHeads.includes(next);
        out.push({ type: "item", title: line.slice(2).trim().replace(/\*\*/g, ""), body: takesNext ? parseInline(next) : null });
        if (takesNext) i++;
      } else if (line.startsWith("※ ")) out.push({ type: "fine", text: line.slice(2).trim() });
      else if (MAP.test(line)) out.push({ type: "map", cells: mapCells(line.match(MAP)![1], o) });
      else if (line.startsWith("[카드 이미지")) out.push({ type: "strip" });
      else if (BUTTON.test(line)) out.push({ type: "button", text: line.match(BUTTON)![1] });
      else if (line.startsWith("#")) out.push({ type: "kw", tags: line.split(/\s+(?=#)/).map((t) => t.replace(/^#/, "").trim()).filter(Boolean) });
      else if (MINI.test(line) && o.positions.some((p) => line.match(MINI)![1] === p)) {
        const m = line.match(MINI)!;
        out.push({ type: "mini", position: m[1], name: m[2], character: m[3], reversed: Boolean(m[4]) });
      } else if (WHOLE_BOLD.test(line)) out.push({ type: "sum", text: line.match(WHOLE_BOLD)![1] });
      else out.push({ type: "p", inline: parseInline(line) });
    }
  }
  return out;
}
