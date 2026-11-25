// 구글 광고 결제 완료 전환(owner 2026-11-24, 한국어 사이트). 태그는 components/Analytics.tsx(AW-18592628933).
// 금액은 owner 예시의 990 고정 대신 실제 결제 금액(가격이 바뀌어도 맞게), transaction_id = 주문 번호(구글이 같은 결제를 두 번 세지 않음).
// 같은 브라우저에서 새로고침·뒤로 가기로 다시 보내지 않게 주문 번호마다 한 번만. 고민 글·닉네임·이메일은 보내지 않는다.
type Gtag = (cmd: "event", name: string, params: Record<string, string | number>) => void;

export function adsPurchase(amount: number, orderId: string) {
  if (typeof window === "undefined" || !orderId || !(amount > 0)) return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag !== "function") return;
  const k = `ssol_ads_purchase_${orderId}`;
  try {
    if (window.sessionStorage.getItem(k)) return;
    window.sessionStorage.setItem(k, "1");
  } catch {
    /* 저장소를 못 쓰면 그냥 보낸다(구글이 transaction_id로 중복을 거름) */
  }
  try {
    gtag("event", "purchase", { value: amount, currency: "KRW", transaction_id: orderId });
  } catch {
    /* 광고 측정 실패는 서비스에 영향 없게 */
  }
}

// 결제 화면(990원 결제 상자)이 처음 보이는 순간의 구글 광고 전환(owner 2026-11-25, 한국어 사이트).
// 사이트 전체가 아니라 결제 상자가 있는 쪽(4쪽 세 번째 카드·잠긴 쪽)으로 넘어간 순간에만 — 결과 화면은 주소가 쪽마다 바뀌어도
// 페이지를 새로 열지 않으므로 ResultView가 그 순간에 직접 부른다. 결과 하나에 한 번만(새로고침·다시 넘김에도 다시 안 보냄).
export const ADS_PAYWALL_SEND_TO = "AW-18592628933/RUJeCInuh78dEMWB1KFF";
export function adsPaywallView(resultId: string) {
  if (typeof window === "undefined" || !resultId) return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag !== "function") return;
  const k = `ssol_ads_paywall_${resultId}`;
  try {
    if (window.sessionStorage.getItem(k)) return;
    window.sessionStorage.setItem(k, "1");
  } catch {}
  try {
    gtag("event", "conversion", { send_to: ADS_PAYWALL_SEND_TO });
  } catch {}
}
