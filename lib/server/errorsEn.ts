// 영문판 API 오류 문구. 서버 오류는 한국어로 만들어지므로, 영문 화면(요청 헤더 x-tarot-locale: en)에는 이 표로 바꿔 보낸다.
// 표에 없는 문구는 일반 안내 하나로(한국어가 영문 화면에 새지 않게).
export const GENERIC_EN = "Something went wrong. Please try again in a moment.";
const MAP: Record<string, string> = {
  safety: "safety",
  "결과가 아직 준비되지 않았어요.": "Your reading isn't ready yet.",
  "결제 금액이 일치하지 않아요.": "The payment amount doesn't match.",
  "결제 정보가 올바르지 않아요.": "The payment details aren't valid.",
  "고민 쓰기부터 해 주세요.": "Please write your question first.",
  "로그인이 필요해요.": "Please sign in first.",
  "로그인한 본인 결과만 결제할 수 있어요.": "You can only pay for your own reading while signed in.",
  "세션을 찾을 수 없어요.": "We couldn't find this reading.",
  "이 결과는 결제할 수 없어요.": "This reading can't be purchased.",
  "이 결과를 볼 수 있는 권한이 없어요.": "You don't have access to this reading.",
  "이미 결제한 결과예요. 결과 화면에서 바로 볼 수 있어요.": "You've already paid for this reading. You can open it from the result page.",
  "이미 결제한 리포트예요.": "You've already paid for this report.",
  "이미 다른 계정에 저장된 결과예요.": "This reading is already saved to another account.",
  "이미 처리된 주문이에요.": "This order has already been processed.",
  "이미 카드를 뽑기 시작했어요.": "You've already started drawing cards.",
  "이미 카드를 섞기 시작했어요.": "You've already started shuffling.",
  "이용 관련 약관에 동의해 주세요.": "Please agree to the terms to continue.",
  "잠시 후 다시 시도해 주세요.": GENERIC_EN,
  "주문 정보를 찾을 수 없어요.": "We couldn't find this order.",
  "영문 결제는 아직 준비 중이에요.": "Payment isn't available yet. We're getting it ready.",
  "주문을 만들지 못했어요. 잠시 후 다시 시도해 주세요.": "We couldn't create your order. Please try again in a moment.",
  "카드를 다시 섞어 주세요.": "Please shuffle the cards again.",
  "카드를 고를 수 없어요.": "That card can't be picked.",
};
/** 영어 문장이면(한글이 없으면) 그대로 — 데이터의 영어 문구(copy.*)에서 온 오류. */
export function toEnglishError(message: string): string {
  if (!/[가-힣]/.test(message)) return message;
  return MAP[message] ?? GENERIC_EN;
}
