// 로그인 없이 타로 보기(owner 2026-10-26)의 하루 횟수 제한 — 순수 판단(테스트 있음).
// 같은 기기 24시간 5번 · 같은 인터넷 주소(IP) 24시간 20번. IP를 기기처럼 낮게 잡지 않는 이유:
// 휴대폰 통신사·회사·가족은 여러 사람이 같은 IP를 같이 써서, 낮게 잡으면 상관없는 사람까지 막힌다.
// 기기 값은 브라우저가 만든 임의 값이라 지우고 다시 보낼 수 있다 — 그런 자동 프로그램은 IP 제한이 막는다.
// 로그인한 사람은 제한하지 않는다(AI 비용을 쓰는 건 고민 분류·연결 한 줄이고, 계정이 있으면 남용을 따라갈 수 있다).
export const GUEST_DEVICE_LIMIT = 5; // owner 2026-11-02: 3 → 5
export const GUEST_IP_LIMIT = 20;
export const GUEST_WINDOW_MS = 24 * 60 * 60 * 1000;
/** 횟수 기록(IP·기기 요약값)과, 2026-12-06 전에 만든 로그인 없는 결과의 보관 기간(owner 결정 7일). */
export const GUEST_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
// owner 2026-11-05 A안: 로그인 없는 결과 보관을 1년으로 늘리되, 개인정보처리방침 개정을 30일 전에 공지하고 그 시행일부터 만든 결과에만 적용.
// 시행일 전에 만든 결과는 "7일 보관"으로 안내받았으므로 계속 7일 뒤 지운다. 방침 문구(app/legal/page.tsx 2-3항)도 이 날짜로 함께 바뀐다.
export const GUEST_RESULT_YEAR_FROM = new Date("2026-12-06T00:00:00+09:00");
export const GUEST_RESULT_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** 로그인 없는 결과를 지울 기준 두 개: shortBefore 이전(=시행일 전에 만든 것 중 7일 지난 것), longBefore 이전(=1년 지난 것). */
export function guestResultCutoffs(now: Date = new Date()): { shortBefore: Date; longBefore: Date } {
  const sevenAgo = now.getTime() - GUEST_RETENTION_MS;
  return {
    shortBefore: new Date(Math.min(sevenAgo, GUEST_RESULT_YEAR_FROM.getTime())),
    longBefore: new Date(now.getTime() - GUEST_RESULT_YEAR_MS),
  };
}
/** 방침에 1년 보관 문구를 보일 때인지(시행일부터). */
export const guestYearRetentionActive = (now: Date = new Date()): boolean => now >= GUEST_RESULT_YEAR_FROM;

export type GuestCounts = { device: number | null; ip: number | null };

/** 최근 24시간 시작 수 → 막을지. 값을 셀 수 없으면(null) 그쪽 제한은 없는 것으로, 둘 다 셀 수 없으면 막는다(더 조심스러운 쪽). */
export function guestLimitReached(c: GuestCounts): boolean {
  if (c.device === null && c.ip === null) return true;
  if (c.device !== null && c.device >= GUEST_DEVICE_LIMIT) return true;
  if (c.ip !== null && c.ip >= GUEST_IP_LIMIT) return true;
  return false;
}

/** 요청 헤더에서 접속 IP(Vercel이 앞에 붙이는 x-forwarded-for의 첫 값). 없으면 null. */
export function clientIp(h: { get(name: string): string | null }): string | null {
  const first = (h.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ip = first || (h.get("x-real-ip") ?? "").trim();
  return ip && ip.length <= 64 ? ip : null;
}

/** 브라우저가 보낸 기기 값(임의 문자열 16~64자, 영문·숫자·-만). 형식이 틀리면 null. */
export function deviceId(h: { get(name: string): string | null }): string | null {
  const v = (h.get("x-tarot-device") ?? "").trim();
  return /^[A-Za-z0-9-]{16,64}$/.test(v) ? v : null;
}
