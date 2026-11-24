// v3.7 과제 1 2안(CSO 2026-11-23): C가 41자 이상 고민에 함께 쓰는 "글에서 짚는 한 줄"(free_lines {p1, p2})을 C 응답에서 꺼낸다.
// 여기서는 모양만 본다(문자열·길이 상한). 원문 낱말·숫자·금지어 검사는 화면 조립 때 패키지 checkFreeLine(deepRead → freeSection)이 한다 —
// 그래서 저장은 tarot_sessions.links.free_lines에 날것으로 두고, 떨어진 줄은 화면에 안 나간다(1안 사정 줄로).
export type FreeLines = { p1: string; p2: string };

const MAX = 200;
const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, MAX) : "");

export function pickFreeLines(raw: string): FreeLines | null {
  let o: unknown;
  try {
    o = JSON.parse(String(raw).replace(/^\s*```(json)?/, "").replace(/```\s*$/, "").trim());
  } catch {
    return null;
  }
  const fl = o && typeof o === "object" ? (o as { free_lines?: unknown }).free_lines : null;
  if (!fl || typeof fl !== "object") return null;
  const p1 = str((fl as { p1?: unknown }).p1), p2 = str((fl as { p2?: unknown }).p2);
  return p1 || p2 ? { p1, p2 } : null;
}

/** 덧붙임을 붙일 만큼 긴 고민인지(패키지 situation_lines.json free_line.min_chars — 글자 수, 띄어쓰기 포함). */
export function isLongWorry(text: string | null | undefined, minChars: number): boolean {
  return [...String(text ?? "")].length >= minChars;
}
