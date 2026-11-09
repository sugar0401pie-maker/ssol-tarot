// 한국 시간 날짜(YYYY-MM-DD) 다루기 — 관리자 화면의 "그 날" 기준.
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 한국 시간 오늘 날짜. */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 올바른 날짜 문자열인지(달력에 있는 날). */
export function isValidDay(day: unknown): day is string {
  if (typeof day !== "string" || !DAY_RE.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

/** 그 날(한국 시간) 0시와 다음 날 0시를 UTC ISO 문자열로. */
export function kstDayBounds(day: string): { start: string; end: string } {
  const start = new Date(`${day}T00:00:00+09:00`);
  return { start: start.toISOString(), end: new Date(start.getTime() + 24 * 3600_000).toISOString() };
}

/** 날짜에 n일 더하기. */
export function addDays(day: string, n: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 24 * 3600_000).toISOString().slice(0, 10);
}

/** ISO 시각 → 한국 시간 "YYYY-MM-DD HH:mm". */
export function kstStamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  return new Date(t.getTime() + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ");
}
