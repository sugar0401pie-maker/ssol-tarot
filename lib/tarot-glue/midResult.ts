// 3쪽 '두 장 중간 결과'(owner 2026-11-02, data/mid_result_db.json — 기획 문장 DB v1).
// 조립: [지나온 길 카드의 '그동안' 문장] + [지금의 흐름 카드의 '지금은' 문장] / [합 문장(지나온 길 막힘 주제 > 지금의 흐름 막힘 대분류)].
// 첫 번째·두 번째 카드만 쓴다 — 세 번째 카드(결제 전 비공개)는 보지 않는다. AI 호출 없음.
type Pick = { reversed?: boolean; card: { no?: number } };
export type MidDb = {
  card_themes: Record<string, { past: string; present: string }>;
  lines: Record<string, Record<string, { past?: string; block?: string }>>;
  merge: Record<string, string>;
};
// v2.3.4(v4.3): 영역 키는 v43.midAreaKey가 고른다(취업 JOB·시험 EDU·연애 단계 LOV_SINGLE·LOV_CRUSH·LOV_EX 포함). DB에 있는 묶음이면 그대로 쓴다.
const keyOf = (p: Pick | undefined) => (p && Number.isInteger(p.card?.no) ? `${p.card.no}_${p.reversed ? "rev" : "up"}` : null);

/** 문단 배열(카드 문장 한 문단 + 합 문장(과거형 — scripts/mid_merge_past.py) 한 문단). 카드 문장을 못 찾으면 null — 부르는 쪽이 예전 표시로 돌아간다. */
export function midResult(db: MidDb, domain: string | null | undefined, picks: Pick[]): string[] | null {
  const k1 = keyOf(picks[0]), k2 = keyOf(picks[1]);
  if (!k1 || !k2) return null;
  const lines = db.lines[domain && db.lines[domain] ? domain : "NONE"];
  const past = lines?.[k1]?.past, block = lines?.[k2]?.block;
  if (!past || !block) return null;
  const t1 = db.card_themes[k1]?.past, t2 = db.card_themes[k2]?.present;
  const merge = t1 && t2 ? db.merge[`${t1}>${t2[0]}`] : undefined;
  // 첫 문장('그동안' 문장)은 굵게 + 남색(owner 2026-11-02) — pageBlocks의 "!! " 문단
  const first = `!! **${past}** ${block}`;
  return merge ? [first, merge] : [first];
}
