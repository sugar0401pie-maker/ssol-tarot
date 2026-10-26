// 로그인 없이 타로 보기(owner 2026-10-26)의 하루 횟수 제한 — 순수 판단(테스트 있음).
// 같은 기기 24시간 3번 · 같은 인터넷 주소(IP) 24시간 20번. IP를 기기처럼 낮게 잡지 않는 이유:
// 휴대폰 통신사·회사·가족은 여러 사람이 같은 IP를 같이 써서, 낮게 잡으면 상관없는 사람까지 막힌다.
// 기기 값은 브라우저가 만든 임의 값이라 지우고 다시 보낼 수 있다 — 그런 자동 프로그램은 IP 제한이 막는다.
// 로그인한 사람은 제한하지 않는다(AI 비용을 쓰는 건 고민 분류·연결 한 줄이고, 계정이 있으면 남용을 따라갈 수 있다).
export const GUEST_DEVICE_LIMIT = 3;
export const GUEST_IP_LIMIT = 20;
export const GUEST_WINDOW_MS = 24 * 60 * 60 * 1000;
/** 로그인 없이 만든 결과와 횟수 기록의 보관 기간(owner 결정 7일). */
export const GUEST_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

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
