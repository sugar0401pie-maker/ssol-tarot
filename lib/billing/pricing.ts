// 유료 리포트 가격(마스터스펙: 1,900원). 금액은 서버가 주문을 만들 때 이 값으로 정한다(브라우저 값 무시).
// 화면 문구(copy.result.paywall_*)의 "1,900원"과 같은지는 테스트(pricing.test.ts)로 확인한다.
export const REPORT_PRICE = 1900;
export const REPORT_ORDER_NAME = "쏠 타로 하우스 전체 리포트";
export const reportPriceLabel = (): string => `${REPORT_PRICE.toLocaleString("ko-KR")}원`;

// 결제 전 청약철회 제한 고지(이용약관 제13조 2항) — 쏠 아스트로 하우스 결제 화면과 같은 문구(같은 사업자·같은 약관).
// 문구를 바꾸면 버전도 바꾼다(누가 어떤 문구에 동의했는지 주문에 남긴다).
export const WITHDRAWAL_NOTICE_VERSION = "tarot-withdrawal-2026-10-21";
export const WITHDRAWAL_NOTICE_LINES = [
  "전체 리포트는 결제 직후 나만을 위해 만들어지는 디지털 콘텐츠예요. 리포트 생성이 끝난 뒤에는 청약철회(단순 변심 환불)가 제한될 수 있어요.",
  "리포트가 안내와 다르게 제공되었거나 회사 사정으로 정상적으로 제공되지 않았다면 제공일로부터 3개월 이내, 또는 그 사실을 안 날로부터 30일 이내에 환불을 요청할 수 있어요.",
] as const;
export const WITHDRAWAL_CHECK_LABEL = "[필수] 위 내용을 확인했고, 리포트 생성 후 청약철회가 제한되는 것에 동의합니다.";
