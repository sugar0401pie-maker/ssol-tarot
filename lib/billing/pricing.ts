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
// ---- 토스 키·결제 UI 고르기(owner 정정 2026-11-06) ----
// 결제위젯 키 **한 벌**(live_gck_ / live_gsk_)로 상점(MID) 두 개를 쓰고, 어느 MID로 갈지는 variantKey가 정한다:
//   기본 UI "DEFAULT" → q_ssolwenlor(원화, 국내 결제) · 추가 UI "dollar.only" → sastroaib3(달러, 해외카드·PayPal)
// 그래서 원화·달러 모두 같은 키 세트(NEXT_PUBLIC_TOSS_CLIENT_KEY / TOSS_SECRET_KEY 또는 TOSS_CLIENT_KEY_KRW / TOSS_SECRET_KEY_KRW)를 쓴다.
// 달러만 따로 넣고 싶을 때만 TOSS_CLIENT_KEY_USD / TOSS_SECRET_KEY_USD(**둘 다** 있을 때만 씀 — 짝이 어긋나지 않게).
// 예전 달러 전용 이름(NEXT_PUBLIC_TOSS_EN_CLIENT_KEY / TOSS_EN_SECRET_KEY)은 읽지 않는다 — 거기 남은 예전 API 개별 연동 키(live_ck_/live_sk_)가
// 결제위젯 키와 엇갈리지 않게. 통화는 서버가 주문(tarot_orders.currency)으로 정하고, 클라이언트 키도 서버가 결제 화면에 넘긴다.
export type Currency = "KRW" | "USD";
export type TossStore = Currency;
type Env = Record<string, string | undefined>;
export function tossKeysFor(currency: Currency, env: Env = process.env): { clientKey: string | null; secretKey: string | null } {
  const shared = { clientKey: env.TOSS_CLIENT_KEY_KRW || env.NEXT_PUBLIC_TOSS_CLIENT_KEY || null, secretKey: env.TOSS_SECRET_KEY_KRW || env.TOSS_SECRET_KEY || null };
  if (currency === "USD" && env.TOSS_CLIENT_KEY_USD && env.TOSS_SECRET_KEY_USD) return { clientKey: env.TOSS_CLIENT_KEY_USD, secretKey: env.TOSS_SECRET_KEY_USD };
  return shared;
}
/** 주문 통화 → 결제위젯 UI(variantKey). 원화 = DEFAULT(국내 MID), 달러 = dollar.only(해외 MID). */
export const variantKeyFor = (currency: Currency, env: Env = process.env): string =>
  currency === "USD" ? env.NEXT_PUBLIC_TOSS_EN_VARIANT || "dollar.only" : "DEFAULT";
export const tossSecretFor = (currency: Currency, env: Env = process.env): string | null => tossKeysFor(currency, env).secretKey;
/** 세션 언어 → 주문 통화(서버가 정함): 영문 결과 = USD, 한국어 결과 = KRW */
export const currencyForLocale = (locale: "ko" | "en"): Currency => (locale === "en" ? "USD" : "KRW");
// 달러 결제는 달러 상점의 두 키가 다 있을 때만 연다
export const usdCheckoutEnabled = (env: Env = process.env): boolean => {
  const k = tossKeysFor("USD", env);
  return Boolean(k.clientKey && k.secretKey);
};
/** 키 종류(아스트로와 같음): 결제위젯 키(…_gck_…)면 토스 결제위젯(외화결제 UI), API 개별 연동 키(…_ck_…)면 결제창을 바로 연다. */
export function tossKeyKind(clientKey: string | null | undefined): "widget" | "api" | null {
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
