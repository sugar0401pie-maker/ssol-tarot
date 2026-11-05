// 데이터(copy)에 없는 짧은 화면 문구(오류 대체 문구·접근성 이름 등) — 언어별. 화면 문구 대부분은 데이터에서 온다.
import type { Locale } from "./locale.ts";

const KO = {
  retryLater: "잠시 후 다시 시도해 주세요.",
  tapAgain: "잠시 후 다시 눌러 주세요.",
  worryAria: "고민 쓰기",
  numberLocale: "ko-KR",
};
const EN: typeof KO = {
  retryLater: "Something went wrong. Please try again in a moment.",
  tapAgain: "Something went wrong. Please tap again in a moment.",
  worryAria: "Write your question",
  numberLocale: "en-US",
};
export const uiText = (l: Locale) => (l === "en" ? EN : KO);
