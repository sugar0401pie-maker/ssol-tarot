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
  // 문장이 4개 이상인 문단을 둘로 나눌지(owner 2026-10-22, 6쪽 "문단 한 번 더 나눠줘") — 유료 6쪽에만 켠다.
  splitLong?: boolean;
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
  // 패키지가 붙이는 " / 번호 오름차순·내림차순"은 화면에 쓰지 않는다(owner 2026-10-22 "번호 내림차순은 없애도 될 듯").
  src = src.replace(/\s*\/\s*번호\s*(오름|내림)차순\s*$/, "");
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

/** 문단을 문장으로 나눈다(마침표·물음표·느낌표 + 띄어쓰기). 굵게(**…**)와 따옴표 안은 끊지 않는다. */
export function splitSentences(s: string): string[] {
  const out: string[] = [];
  let bold = false, quote = false, start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.startsWith("**", i)) {
      // 굵은 문장이 끝나는 곳("…예요.** 다음 문장")도 문장 끝으로 본다.
      const closesSentence = bold && /[.?!]/.test(s[i - 1] ?? "") && /\s/.test(s[i + 2] ?? "");
      bold = !bold;
      i++;
      if (closesSentence) { out.push(s.slice(start, i + 1).trim()); start = i + 1; }
      continue;
    }
    const ch = s[i];
    if (ch === "\u201C" || ch === "\u201D" || ch === '"') { quote = ch === "\u201C" ? true : ch === "\u201D" ? false : !quote; continue; }
    if (!bold && !quote && /[.?!]/.test(ch) && /\s/.test(s[i + 1] ?? "") ) {
      out.push(s.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  const rest = s.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/** 문장이 4개 이상인 문단은 앞뒤 둘로(앞쪽이 같거나 한 문장 더 많게). 3개 이하는 그대로. */
export function splitLongParagraph(line: string): string[] {
  const ss = splitSentences(line);
  if (ss.length < 4) return [line];
  const k = Math.ceil(ss.length / 2);
  return [ss.slice(0, k).join(" "), ss.slice(k).join(" ")];
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
      else if (o.splitLong) for (const part of splitLongParagraph(line)) out.push({ type: "p", inline: parseInline(part) });
      else out.push({ type: "p", inline: parseInline(line) });
    }
  }
  return out;
}
