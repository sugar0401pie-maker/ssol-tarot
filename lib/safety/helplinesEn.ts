// 영문판 위기·폭력 안내 연락처 — 기획 전달 data/en/safety_resources.json(v1.2.3, 2026-11-03 웹 검색으로 번호 확인, 6개월마다 재확인)
// 영어 데이터 문구의 자리 표시({crisis_line}·{crisis_text}·{emergency}·{dv_line}·{youth_line})를 접속 국가로 채운다.
// 규칙(파일 _fallback_rule): 표에 없는 나라·국가를 모르면 GLOBAL(findahelpline.com) — 다른 나라 번호는 절대 보여 주지 않는다.
// 출시 전 영어권 임상 전문가 검토 필요(docs/spec/en/safety/SAFETY_EN_NOTES.md).
import res from "../../data/en/safety_resources.json" with { type: "json" };

export type Helplines = { crisis_line: string; crisis_text: string; emergency: string; dv_line: string; youth_line: string };
type Market = Partial<Helplines> & Record<string, unknown>;
const MARKETS = (res as { markets: Record<string, Market> }).markets;
// 접속 국가 코드(ISO, Vercel 헤더) → 파일의 시장 이름
const ALIAS: Record<string, string> = { GB: "UK", UK: "UK", US: "US", CA: "CA", AU: "AU" };

const pick = (m: Market | undefined): Helplines => {
  const g = MARKETS.GLOBAL;
  const v = (k: keyof Helplines) => String((m && m[k]) || g[k] || "");
  return { crisis_line: v("crisis_line"), crisis_text: v("crisis_text"), emergency: v("emergency"), dv_line: v("dv_line"), youth_line: v("youth_line") };
};

export function helplinesFor(country: string | null | undefined): Helplines {
  const key = ALIAS[String(country || "").toUpperCase()];
  return pick(key ? MARKETS[key] : undefined);
}

/** 문구 속 {crisis_line} 같은 자리를 채운다. 다른 자리({nickname} 등)는 그대로 둔다. 빈 값(GLOBAL의 crisis_text)이면 그 자리만 빈다. */
export function fillHelplines(text: string, h: Helplines): string {
  return text.replace(/\{(crisis_line|crisis_text|emergency|dv_line|youth_line)\}/g, (_m, k: keyof Helplines) => h[k]);
}

/** 결과 응답처럼 겹친 값 안의 모든 글에 fillHelplines(영문 결과의 watch 안내·두려움 안내 박스 등). */
export function fillHelplinesDeep<T>(v: T, h: Helplines): T {
  if (typeof v === "string") return fillHelplines(v, h) as T;
  if (Array.isArray(v)) return v.map((x) => fillHelplinesDeep(x, h)) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fillHelplinesDeep(x, h)])) as T;
  return v;
}

/** 전화로 걸 수 있는 번호(tel:)를 고른다 — 문구에 숫자가 있으면 첫 번호, 없으면 null(전화 버튼 대신 글만). */
export function telOf(label: string): string | null {
  const m = label.match(/(\+?\d[\d\s-]{1,14}\d)/);
  return m ? m[1].replace(/[\s-]/g, "") : null;
}
