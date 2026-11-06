// 데이터(copy)에 없는 짧은 화면 문구(오류 대체 문구·접근성 이름 등) — 언어별. 화면 문구 대부분은 데이터에서 온다.
import type { Locale } from "./locale.ts";

const KO = {
  retryLater: "잠시 후 다시 시도해 주세요.",
  tapAgain: "잠시 후 다시 눌러 주세요.",
  worryAria: "고민 쓰기",
  numberLocale: "ko-KR",
  result: {
    noAccess: "이 결과는 카드를 뽑은 브라우저나, 결과를 저장한 계정으로 로그인해야 볼 수 있어요.",
    home: "처음으로",
    notDrawn: "아직 카드를 다 뽑지 않았어요.",
    savedAlready: "내 계정에 저장된 결과예요. 쏘웰라 마이페이지에서 다시 볼 수 있어요.",
    savedNow: "내 계정에 저장했어요. 쏘웰라 마이페이지에서 다시 볼 수 있어요.",
    share: "SNS 공유하기",
    save: "저장하기",
    about: "이 테스트 자세히 보기",
    zoom: "크게 보기",
    zoomClose: "크게 보기 닫기",
    reversed: "역방향",
    upright: "정방향",
    arcana: "원래 타로 카드",
  },
};
const EN: typeof KO = {
  retryLater: "Something went wrong. Please try again in a moment.",
  tapAgain: "Something went wrong. Please tap again in a moment.",
  worryAria: "Write your question",
  numberLocale: "en-US",
  result: {
    noAccess: "You can see this reading in the browser where you drew the cards, or after logging in to the account it was saved to.",
    home: "Back to start",
    notDrawn: "You haven't drawn all three cards yet.",
    savedAlready: "This reading is already saved to your account.",
    savedNow: "Saved to your account.",
    share: "Share",
    save: "Save",
    about: "About this reading",
    zoom: "View larger",
    zoomClose: "Close larger view",
    reversed: "Reversed",
    upright: "Upright",
    arcana: "Original tarot card",
  },
};
export const uiText = (l: Locale) => (l === "en" ? EN : KO);
