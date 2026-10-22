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

// 메인 문구 줄바꿈(copy.result.headline_break): 첫 쉼표 뒤. 쉼표가 없으면 메인 문구 틀(headline_frames)의 이음말
// "~을 지나 / ~으로", "~에서 / ~으로" 뒤에서 자동으로 바꾼다(owner 2026-10-21 "여러 갈래로 흩어지는 힘을 지나 / 한 가지만 지키는 여유로").
// 앞뒤가 너무 짧으면(4자 미만) 나누지 않는다 — AI가 쓴 메인 문구에 우연히 낀 '에서'로 어색하게 끊기지 않게.
const HEADLINE_JOINS = [" 지나 ", "에서 "];
export function splitHeadline(s: string): string[] {
  const i = s.indexOf(", ");
  if (i >= 0) return [s.slice(0, i + 1), s.slice(i + 2)];
  for (const j of HEADLINE_JOINS) {
    const k = s.indexOf(j);
    if (k < 0) continue;
    const head = s.slice(0, k + j.length).trimEnd();
    const tail = s.slice(k + j.length).trim();
    if (head.length >= 4 && tail.length >= 4) return [head, tail];
  }
  return [s];
}

// 잠긴 쪽 예고 한 줄(copy.result.pages[].teaser) 줄바꿈(owner 2026-10-21 "애매하게 두 줄 되는 것"): 쉼표나 " — " 뒤에서 나눈다.
// 화면에서는 줄마다 단어 단위로 고르게(text-wrap: balance) 맞춘다. 나눌 곳이 없으면 한 줄 그대로.
export function splitTeaser(s: string): string[] {
  // 줄표(—)가 있으면 그 자리가 문장의 큰 마디라 먼저 끊는다("오늘 바로, 3일 안에, 이번 주 안에 — 내가 해 볼…"이 첫 쉼표에서 끊기지 않게).
  for (const sep of [" — ", ", "]) {
    const i = s.indexOf(sep);
    if (i > 3 && i < s.length - sep.length - 3) return [s.slice(0, i + (sep === ", " ? 1 : 0)).trimEnd(), s.slice(i + sep.length).trimStart()];
  }
  return [s];
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
