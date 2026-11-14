// 데이터(copy)에 없는 짧은 화면 문구(오류 대체 문구·접근성 이름 등) — 언어별. 화면 문구 대부분은 데이터에서 온다.
import type { Locale } from "./locale.ts";

const KO = {
  retryLater: "잠시 후 다시 시도해 주세요.",
  tapAgain: "잠시 후 다시 눌러 주세요.",
  worryAria: "고민 쓰기",
  numberLocale: "ko-KR",
  // 첫 화면 참여자 수 뒤에 붙는 기준일(owner 2026-11-14) — iso는 lib/stats/participants.ts의 날짜
  asOf: (iso: string) => `(${iso.replaceAll("-", ".")} 기준)`,
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
  // 뽑기 판 카드 버튼(화면 읽기 프로그램용)
  slot: (n: number) => `${n}번째 카드`,
  // 내 결과 목록(/results)
  results: {
    home: "← 처음으로",
    title: "내 타로 결과",
    sub: "지금까지 뽑은 카드를 다시 볼 수 있어요.",
    loading: "불러오는 중…",
    empty: "아직 저장된 결과가 없어요.",
    start: "지금 보러 갈까요?",
    hidden: "결제 후 열려요",
    paid: "전체 열람 가능",
    dateLocale: "ko-KR",
  },
};
const EN: typeof KO = {
  retryLater: "Something went wrong. Please try again in a moment.",
  tapAgain: "Something went wrong. Please tap again in a moment.",
  worryAria: "Write your question",
  numberLocale: "en-US",
  asOf: (iso: string) => `(as of ${new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })})`,
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
  slot: (n: number) => `Card ${n}`,
  results: {
    home: "← Back to start",
    title: "My tarot readings",
    sub: "See the cards you've drawn so far.",
    loading: "Loading…",
    empty: "You don't have any saved readings yet.",
    start: "Draw your cards now",
    hidden: "opens after payment",
    paid: "Full report unlocked",
    dateLocale: "en-US",
  },
};
export const uiText = (l: Locale) => (l === "en" ? EN : KO);
