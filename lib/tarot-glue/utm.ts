// 광고 소재(UTM) — 화면과 서버가 같이 쓰는 순수 부분(owner 2026-11-14).
//   화면: 첫 방문 주소에 utm_*가 있으면 브라우저에 30일 보관(새 utm 주소로 오면 바꿈) → 테스트를 시작할 때 같이 보낸다.
//   서버: 값을 다시 검사(알 수 없는 칸·긴 값·이상한 글자 버림)해 tarot_sessions.utm과 tarot_utm_counts에 쓴다.
export type Utm = { source: string; medium: string; campaign: string; content: string; term: string };
export const UTM_KEYS = ["source", "medium", "campaign", "content", "term"] as const;
export const UTM_STORE_KEY = "tarot_utm";
export const UTM_MAX_AGE_MS = 30 * 24 * 3600 * 1000;
const MAX_LEN = 100;

const clean = (v: unknown): string =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_LEN) : "";

/** 아무 값이나 받아 Utm으로(utm_source가 없으면 null). */
export function sanitizeUtm(raw: unknown): Utm | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const u = Object.fromEntries(UTM_KEYS.map((k) => [k, clean(r[k])])) as Utm;
  return u.source ? u : null;
}

/** 주소의 검색 부분(?utm_source=x&…)에서 Utm(utm_source가 없으면 null). */
export function utmFromSearch(search: string): Utm | null {
  const p = new URLSearchParams(search);
  return sanitizeUtm(Object.fromEntries(UTM_KEYS.map((k) => [k, p.get(`utm_${k}`) ?? ""])));
}

/** 브라우저에 보관한 값(시각 포함)에서 30일이 안 지난 Utm만. */
export function storedUtm(raw: string | null, now = Date.now()): Utm | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { utm?: unknown; at?: number };
    if (typeof o.at !== "number" || now - o.at > UTM_MAX_AGE_MS || now < o.at - 60_000) return null;
    return sanitizeUtm(o.utm);
  } catch {
    return null;
  }
}
export const utmKey = (u: Utm) => [u.source, u.medium, u.campaign, u.content, u.term].join("|");
