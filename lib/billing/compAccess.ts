// 결제 없이 전체 리포트(유료 부분 포함)를 열 수 있는 계정(owner가 정한 시험·확인용, 기간 한정).
// 결제 화면에서 이 계정이 [결제]로 들어오면 토스를 거치지 않고 그 결과를 결제한 것처럼 연다 — 주문·결제 기록은 만들지 않는다(매출·결제 집계에 안 섞임).
// 기간이 지나면 자동으로 일반 결제로 돌아간다. 추가·연장은 이 목록만 고친다.
export type CompGrant = { email: string; until: string; note: string };

export const COMP_GRANTS: CompGrant[] = [
  // owner 2026-11-02 "오늘 하루만" — 한국 시간 11월 2일 자정까지
  { email: "owner-test@ssolwellnesshouse.com", until: "2026-11-03T00:00:00+09:00", note: "owner 확인용, 2026-11-02 하루" },
];

export function hasCompAccess(email: string | null | undefined, now: Date = new Date(), grants: CompGrant[] = COMP_GRANTS): boolean {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e) return false;
  return grants.some((g) => g.email.toLowerCase() === e && now.getTime() < new Date(g.until).getTime());
}
