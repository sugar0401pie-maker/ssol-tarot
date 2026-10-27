/* eslint-disable @typescript-eslint/no-explicit-any */
// 5쪽 첫 줄 뒤에 붙이는 "카드 내용을 종합하면 …" 한 문장(owner 2026-10-27).
// 카드별 이유 줄("{뜻} 카드라, ‘선택지’ 쪽을 가리켜요." — decision_tables reasons DB)에서 뜻 부분만 꺼내,
// 결론과 같은 쪽을 가리키는 카드 앞의 두 장을 "A고, B 모양입니다."로 잇는다. AI 호출 없음.
// 결론 이름(‘선택지’)은 넣지 않는다 — 결제 전 화면에 나가는 문장이라 어느 쪽인지 드러내지 않는다.

const HANGUL = 0xac00;
const jong = (ch: string) => (ch.charCodeAt(0) - HANGUL) % 28;
const isHangul = (ch: string) => { const c = ch.charCodeAt(0); return c >= HANGUL && c <= 0xd7a3; };
const setJong = (ch: string, j: number) => String.fromCharCode(ch.charCodeAt(0) - jong(ch) + j);
const J_N = 4, J_L = 8, J_B = 17; // ㄴ, ㄹ, ㅂ

type Clause = { adn: string; noun: string };

/** "오해가 걷혀 서로의 마음이 또렷해지는 카드" → { adn: "오해가 … 또렷해지는", noun: "카드" } */
export function splitClause(clause: string): Clause | null {
  const m = String(clause || "").trim().match(/^(.+?)\s+(카드|상태|때)$/);
  return m ? { adn: m[1], noun: m[2] } : null;
}

/** "~다는/~라는"(인용형) 끝을 보통 관형형으로. "~하라는"(시키는 말)은 바꾸지 않고 null(그 카드는 문장에서 뺀다). */
export function normalizeAdn(adn: string): string | null {
  if (/라는$/.test(adn)) return null;
  return adn.replace(/있다는$/, "있는").replace(/없다는$/, "없는").replace(/괜찮다는$/, "괜찮은").replace(/졌다는$/, "진");
}

/** 관형형 끝("~는/~은/~ㄴ/~ㄹ")을 연결형 "~고"로. 모르는 모양이면 null(그 카드는 문장에서 뺀다). */
export function toConnective(adn: string): string | null {
  if (/나은$/.test(adn)) return adn.replace(/나은$/, "낫고"); // ㅅ 불규칙(편이 나은)
  if (/든$/.test(adn)) return adn.replace(/든$/, "들고"); // ㄹ 탈락(줄어든)
  const s = adn.slice(-1), stem = adn.slice(0, -1);
  if (!isHangul(s)) return null;
  if (s === "는") return stem + "고";
  if (s === "은") return stem + "고";
  if (s === "운") {
    // ㅂ 불규칙 형용사(가벼운→가볍고, 어려운→어렵고). 앞 글자에 받침이 없을 때만.
    const prev = stem.slice(-1);
    if (prev && isHangul(prev) && jong(prev) === 0) return stem.slice(0, -1) + setJong(prev, J_B) + "고";
    return null;
  }
  if (jong(s) === J_N || jong(s) === J_L) return stem + setJong(s, 0) + "고"; // 편한→편하고, 지친→지치고, 살필→살피고
  return null;
}

function piece(c: Clause, last: boolean): string | null {
  const adn = normalizeAdn(c.adn);
  if (!adn) return null;
  if (c.noun === "때") return last ? `${adn} 때인` : `${adn} 때이고`;
  // 끝 조각이 "~할/~늦출"(앞으로의 일)이면 "모양입니다" 앞에 '때인'을 붙여야 자연스럽다(늦출 모양 → 늦출 때인 모양).
  if (last) return jong(adn.slice(-1)) === J_L ? `${adn} 때인` : adn;
  return toConnective(adn);
}

/** 카드별 이유 줄에서 뜻 부분: "{뜻}이라/라, ‘…’ 쪽을 가리켜요." */
export function clauseOfReason(reason: string | null | undefined): string | null {
  const m = String(reason || "").match(/^(.+?)(?:이라|라),\s*‘/);
  return m ? m[1].trim() : null;
}

/** lean.cards(위치 순) 중 결론(lean.option) 쪽 카드에서 앞의 두 장(바꿀 수 없는 카드는 건너뜀)으로 한 문장. 만들 수 없으면 null. */
export function cardGistLine(lean: { option?: string; cards?: { option?: string; reason?: string | null }[] } | null | undefined): string | null {
  if (!lean || !Array.isArray(lean.cards)) return null;
  const clauses = lean.cards
    .filter((c) => c && c.option === lean.option)
    .map((c) => splitClause(clauseOfReason(c.reason) ?? ""))
    .filter((c): c is Clause => !!c);
  for (let i = 0; i < clauses.length; i++) {
    const a = piece(clauses[i], false);
    if (!a) continue;
    for (let j = i + 1; j < clauses.length; j++) {
      const b = piece(clauses[j], true);
      if (b) return `카드 내용을 종합하면 ${a}, ${b} 모양입니다.`;
    }
  }
  for (const c of clauses) {
    const one = piece(c, true);
    if (one) return `카드 내용을 종합하면 ${one} 모양입니다.`;
  }
  return null;
}

/**
 * 5쪽 첫 줄(lead) 뒤에 종합 한 문장을 붙인다(owner 2026-10-27). 결제 전(hideSummary)에는
 * "세 장을 종합하면 이렇습니다" 카드별 이유 목록을 응답에서 빼서 블러 아래로 보낸다(데이터를 아예 보내지 않음).
 * 결정형이 아니거나(목록·lean 없음) 문장을 만들 수 없으면 목록 숨김만 하고 문장은 붙이지 않는다.
 */
export function applyCardGist(pages: any[], lean: any, summaryTitle: string, { hideSummary }: { hideSummary: boolean }): any[] {
  const gist = cardGistLine(lean);
  const edit = (text: string | null | undefined): string | null | undefined => {
    if (typeof text !== "string") return text;
    const chunks = text.split(/\n\s*\n/);
    const si = chunks.findIndex((c) => c.trim().startsWith(summaryTitle));
    if (si < 0) return text;
    if (gist && si >= 1 && !chunks[si - 1].includes("카드 내용을 종합하면")) chunks[si - 1] = `${chunks[si - 1].trimEnd()} ${gist}`;
    if (hideSummary) chunks.splice(si, 1);
    return chunks.join("\n\n");
  };
  return pages.map((p) => (p.page === 5 ? { ...p, free: edit(p.free), body: edit(p.body) } : p));
}
