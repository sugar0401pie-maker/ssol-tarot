// 영문 페이지 공개 여부(owner 2026-11-06: 토스 해외결제가 계속 실패해 토스에 문의 중 — 답을 받기 전까지 영문판 숨김).
// 코드 상수로 둔다(쏠 아스트로 하우스 EN_PAGES_HIDDEN과 같은 방식 — 환경 변수 실수로 열리지 않게).
// true면 /en·/en/… 화면은 모두 한국어 첫 화면("/")으로 보낸다(app/en/layout.tsx). 영문 API·코드·이미 만든 데이터는 그대로.
// 다시 열 때: false로 바꿔 배포.
export const EN_PAGES_HIDDEN = true;
