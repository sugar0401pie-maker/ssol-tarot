// 유료 리포트 가격(마스터스펙: 1,900원). 금액은 서버가 주문을 만들 때 currentReportPrice()로 정한다(브라우저 값 무시).
// 2026-11 한정 할인(owner 2026-10-26): 2026-11-01 00:00 ~ 2026-11-30 24:00(한국 시간) 동안 990원. 12월 1일 0시가 되면 자동으로 정가.
// 화면(결제 상자·결제 화면·첫 화면 띠)과 실제 청구가 반드시 이 한 곳의 계산을 쓴다 — 표시 금액과 청구 금액이 어긋나지 않게.
export const REPORT_LIST_PRICE = 1900;
export const PROMO_REPORT_PRICE = 990;
export const PROMO_START = new Date("2026-11-01T00:00:00+09:00");
export const PROMO_END = new Date("2026-12-01T00:00:00+09:00"); // 이 시각부터 정가(끝 시각 미포함)
export const REPORT_ORDER_NAME = "쏠 타로 하우스 전체 리포트";

export const isPromoActive = (now: Date = new Date()): boolean => now >= PROMO_START && now < PROMO_END;
export const currentReportPrice = (now: Date = new Date()): number => (isPromoActive(now) ? PROMO_REPORT_PRICE : REPORT_LIST_PRICE);
export const won = (n: number): string => `${n.toLocaleString("ko-KR")}원`;

// 결제 전 청약철회 제한 고지(이용약관 제13조 2항) — 쏠 아스트로 하우스 결제 화면과 같은 문구(같은 사업자·같은 약관).
// 문구를 바꾸면 버전도 바꾼다(누가 어떤 문구에 동의했는지 주문에 남긴다).
export const WITHDRAWAL_NOTICE_VERSION = "tarot-withdrawal-2026-10-21";
export const WITHDRAWAL_NOTICE_LINES = [
  "전체 리포트는 결제 직후 나만을 위해 만들어지는 디지털 콘텐츠예요. 리포트 생성이 끝난 뒤에는 청약철회(단순 변심 환불)가 제한될 수 있어요.",
  "리포트가 안내와 다르게 제공되었거나 회사 사정으로 정상적으로 제공되지 않았다면 제공일로부터 3개월 이내, 또는 그 사실을 안 날로부터 30일 이내에 환불을 요청할 수 있어요.",
] as const;
export const WITHDRAWAL_CHECK_LABEL = "[필수] 위 내용을 확인했고, 리포트 생성 후 청약철회가 제한되는 것에 동의합니다.";
