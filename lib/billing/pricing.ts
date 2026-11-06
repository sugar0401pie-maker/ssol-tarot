// 유료 리포트 가격(마스터스펙: 1,900원). 금액은 서버가 주문을 만들 때 currentReportPrice()로 정한다(브라우저 값 무시).
// 2026-11 한정 할인(owner 2026-10-26): 2026-11-01 00:00 ~ 2026-11-30 24:00(한국 시간) 동안 990원. 12월 1일 0시가 되면 자동으로 정가.
// 화면(결제 상자·결제 화면·첫 화면 띠)과 실제 청구가 반드시 이 한 곳의 계산을 쓴다 — 표시 금액과 청구 금액이 어긋나지 않게.
export const REPORT_LIST_PRICE = 1900;
export const PROMO_REPORT_PRICE = 990;
export const PROMO_START = new Date("2026-10-26T00:00:00+09:00") // owner 2026-10-26: 10월 말부터 바로;
export const PROMO_END = new Date("2026-12-01T00:00:00+09:00"); // 이 시각부터 정가(끝 시각 미포함)
export const REPORT_ORDER_NAME = "쏠 타로 하우스 전체 리포트";

export const isPromoActive = (now: Date = new Date()): boolean => now >= PROMO_START && now < PROMO_END;
export const currentReportPrice = (now: Date = new Date()): number => (isPromoActive(now) ? PROMO_REPORT_PRICE : REPORT_LIST_PRICE);
export const won = (n: number): string => `${n.toLocaleString("ko-KR")}원`;

// 영문판(owner 2026-11-05): US$1.99, 할인 없음. 토스 해외 결제(Visa·Mastercard·JCB·PayPal)로 받는다.
export const REPORT_PRICE_USD = 1.99;
export const usd = (n: number): string => `US$${n.toFixed(2)}`;
export const REPORT_ORDER_NAME_EN = "Ssol Tarot House Full Reading";
// 주문 표(tarot_orders.amount)는 정수 칸이라 달러는 센트로 저장한다(1.99달러 = 199). 토스 승인·조회에는 달러 금액(1.99)을 쓴다.
export const toMinor = (currency: "KRW" | "USD", major: number): number => (currency === "USD" ? Math.round(major * 100) : major);
export const toMajor = (currency: "KRW" | "USD", minor: number): number => (currency === "USD" ? minor / 100 : minor);
// 영문 결제는 owner가 켜고(TAROT_USD_CHECKOUT=1) **해외결제 상점 키**(TOSS_EN_SECRET_KEY)가 있을 때만 연다.
// 한국어(원화) 상점 키로 대신하지 않는다(2026-11-06 — 원화 상점으로 달러를 요청하면 토스 2003).
export const usdCheckoutEnabled = (env: Record<string, string | undefined> = process.env): boolean => env.TAROT_USD_CHECKOUT === "1" && Boolean(env.TOSS_EN_SECRET_KEY);
export type TossStore = "ko" | "en";
/** 상점별 비밀 키 — 한국어(원화) = TOSS_SECRET_KEY, 영문(달러) = TOSS_EN_SECRET_KEY. 없으면 null(서로 대신 쓰지 않는다). */
export const tossSecretFor = (store: TossStore, env: Record<string, string | undefined> = process.env): string | null =>
  (store === "en" ? env.TOSS_EN_SECRET_KEY : env.TOSS_SECRET_KEY) || null;
/** 영문 결제창 키 — 해외결제 상점 키만(NEXT_PUBLIC_TOSS_EN_CLIENT_KEY). 한국어 키(NEXT_PUBLIC_TOSS_CLIENT_KEY)로 대신하지 않는다. */
export const enTossClientKey = (): string | undefined => process.env.NEXT_PUBLIC_TOSS_EN_CLIENT_KEY || undefined;
/** 키 종류(아스트로와 같음): 결제위젯 키(…_gck_…)면 토스 결제위젯(외화결제 UI), API 개별 연동 키(…_ck_…)면 결제창을 바로 연다. */
export function tossKeyKind(clientKey: string | undefined): "widget" | "api" | null {
  if (!clientKey) return null;
  if (/_gck_/.test(clientKey)) return "widget";
  if (/_ck_/.test(clientKey)) return "api";
  return null;
}
export type ReportPrice = { currency: "KRW" | "USD"; amount: number; label: string };
export function reportPriceFor(locale: "ko" | "en", now: Date = new Date()): ReportPrice {
  if (locale === "en") return { currency: "USD", amount: REPORT_PRICE_USD, label: usd(REPORT_PRICE_USD) };
  const a = currentReportPrice(now);
  return { currency: "KRW", amount: a, label: won(a) };
}

// 결제 전 동의(owner 2026-11-02): 긴 청약철회 안내 상자 대신 "타로 하우스 이용 관련 약관에 동의합니다" 체크 한 줄 + 약관 링크.
// 청약철회 제한(이용약관 제13조)은 약관 링크 안에 있다 — owner가 결정("약관 하이퍼링크 정도면 충분").
// 문구를 바꾸면 버전도 바꾼다(누가 어떤 문구에 동의했는지 주문에 남긴다 — tarot_orders.withdrawal_version).
export const WITHDRAWAL_NOTICE_VERSION = "tarot-terms-2026-11-02";
export const TERMS_CHECK_BEFORE = "타로 하우스 ";
export const TERMS_CHECK_LINK = "이용 관련 약관";
export const TERMS_CHECK_AFTER = "에 동의합니다";
// 보관 안내(실제 동작에 맞춘 문구 — 결제한 리포트는 지우지 않고 '내 타로 결과'에서 다시 볼 수 있게 보관)
export const STORAGE_NOTE = "고객님의 전체 리포트 작성과 다시 보기를 위해 입력하신 정보를 보관하며, 결제한 리포트는 ‘내 타로 결과’에서 언제든 다시 볼 수 있어요.";
// 결제 화면 할인 표시(owner 2026-11-02 "11월 한정 할인가")
export const PROMO_LABEL = "11월 한정 할인가";
