// 영문 결제 화면 문구 — 기획 정책 문서 docs/policies/en/08_on-screen-texts.md 4장 그대로(손으로 바꾸지 않음).
// 문구를 바꾸면 CHECKOUT_EN_VERSION도 바꾼다(주문 tarot_orders.withdrawal_version에 남는다).
export const CHECKOUT_EN_VERSION = "en-checkout-2026-11-06";
export const CHECKOUT_EN = {
  back: "← Back to my reading",
  title: "Full report",
  product: "Full report — US$1.99, one-time payment. No subscription, no automatic renewal.",
  ackBefore: "Your report unlocks right after payment. By paying, you ask us to deliver it now and agree that you can't cancel once it is shown, as set out in the ",
  terms: "Terms of Use",
  and: " and ",
  refund: "Refund Policy",
  ackAfter: ".",
  methods: "Visa · Mastercard · JCB · PayPal. Your bank may add a foreign-transaction fee.",
  pay: "Pay US$1.99 and see my full reading",
  payPaypal: "Pay with PayPal", // 아스트로 영문 결제와 같은 문구(08 문서에 없는 버튼)
  needAck: "Tick the box above to continue",
  loading: "Loading payment…",
  opening: "Opening payment…",
  checking: "Checking…",
  notReady: "Payment isn't set up yet.",
  widgetFailed: "We couldn't load the payment window. Check your connection and refresh this page.",
  openFailed: "We couldn't open the payment window. Please try again in a moment.",
  // 결제 완료·실패(08 문서). 영수증 이메일 문장은 주문 확인 메일 발송이 생긴 뒤에 붙인다(아직 없음).
  confirming: "Confirming your payment…",
  confirmFailed: "We couldn't confirm your payment.",
  missingInfo: "We couldn't read the payment details.",
  backToReading: "Back to my reading",
  checkAgain: "Check my payment again",
  stuck: "If you've already paid and still see this, open this page again on the device you paid with, or email contact@ssolwellness.com.",
  failTitle: "Payment didn't go through",
  failBody: "Payment didn't go through, and you were not charged. Please try again or use another method.",
  cancelTitle: "Payment stopped",
  cancelBody: "Your reading so far is still here.",
  tryAgain: "Try again",
};
