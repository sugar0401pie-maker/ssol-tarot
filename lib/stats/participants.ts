// 첫 화면 "벌써 {count}명이…"와 /about "지금까지 {n}명이 참여했어요"가 함께 쓰는 숫자(owner: 두 곳이 늘 같아야 함).
// owner 2026-10-21 결정: 당분간 실제 세션 수 대신 고정 숫자(1,294 → 1,355 → 2,381 → 5,358 → 13,751 → 24,350 → 99,846). 숫자를 바꿀 때 기준일(AS_OF)도 같이 바꾼다.
// 되돌릴 때는 participantCount()(lib/server/session.ts — 실제 tarot_sessions 수)를 쓰면 된다.
export const DISPLAY_PARTICIPANTS = 99846;
export const DISPLAY_PARTICIPANTS_AS_OF = "2026-11-14"; // 위 숫자를 마지막으로 바꾼 날(한국 날짜)

/** "2026.11.02" */
export const asOfDots = (iso: string = DISPLAY_PARTICIPANTS_AS_OF): string => iso.replaceAll("-", ".");
