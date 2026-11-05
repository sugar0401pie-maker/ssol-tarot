// 영문판 동의 문구 — 기획 정책 문서 docs/policies/en/08_on-screen-texts.md 1·2장 그대로.
// 바꾼 곳 1곳: ② 아래 작은 글씨의 보관 기간 "30 days if you don't sign in" → "1 year if you don't sign in"
// (owner 2026-11-05 결정: 영문판도 로그인 없이 본 결과는 1년 — 기획 정책 문서 쪽 수정도 요청함).
export const CONSENT_EN = {
  terms: { before: "I am 18 years old or older, I agree to the ", terms: "Terms of Use", mid: ", and I have read the ", privacy: "Privacy Policy", after: "." },
  termsMissing: "Please tick the box to continue.",
  worry: "I agree that SSOL may use what I write, including anything about my health, relationships or safety, to create my reading and to check for signs that I may need help. My text is sent to OpenAI to help write my reading.",
  worryDetails: "Details",
  worrySmall: "Used only for your reading and your safety · Never shown on your share card · Kept until you delete your account (1 year if you don't sign in) · You can withdraw anytime.",
  worryNames: "Please leave out other people's names and contact details. \"My manager\" or \"my ex\" is enough.",
  worryAi: "Your text goes to OpenAI only to help write your reading. It isn't used to train AI and is deleted there within 30 days. Prefer not to? Tap the button below to skip writing and still get your cards.",
  worryMissing: "Please tick the box to submit. If you'd rather not, you can still draw cards without writing anything.",
} as const;
// 동의 문구 판(주문·세션에 기록). 문구를 바꾸면 날짜를 바꾼다.
export const CONSENT_EN_VERSION = "en-consent-2026-11-05";
