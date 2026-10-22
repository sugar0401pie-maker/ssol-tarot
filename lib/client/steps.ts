// 테스트 화면마다 자기 주소(owner 2026-10-21 "모든 페이지 개별 링크"). 화면 상태는 한 컴포넌트(TarotFlow)가 그대로 들고 있고,
// 화면이 바뀔 때 주소만 바꾼다. 결과는 /result/{id}/{쪽}.
export const STEP_PATH = {
  intro: "/",
  welcome: "/welcome",
  experience: "/experience",
  first_time: "/first-time",
  worry: "/worry",
  shuffle: "/shuffle",
  draw: "/draw",
  reveal: "/reveal",
  loading: "/loading",
  safety: "/safety",
} as const;
export type Step = keyof typeof STEP_PATH;

/** 주소 → 화면 이름(모르는 주소면 null) */
export function stepFromPath(path: string): Step | null {
  const clean = path.length > 1 ? path.replace(/\/+$/, "") : path;
  for (const [k, v] of Object.entries(STEP_PATH)) if (v === clean) return k as Step;
  return null;
}

// 뒤로 가기로 돌아갈 수 있는 화면 — 세션(고민·카드)이 서버에 쌓이기 전 단계만.
// 고민을 낸 뒤(섞기부터)는 서버 기록과 화면이 어긋나지 않게 뒤로 가도 지금 화면에 머문다.
const BACKABLE: readonly Step[] = ["intro", "welcome", "experience", "first_time", "worry"];

/** 뒤로/앞으로 가기로 주소가 to로 바뀌었을 때 화면을 따라 바꿔도 되는지 */
export function canFollow(from: Step, to: Step): boolean {
  return BACKABLE.includes(from) && BACKABLE.includes(to) && BACKABLE.indexOf(to) < BACKABLE.indexOf(from);
}

/** 주소로 처음 들어왔을 때(새로고침·링크) 시작할 화면. 고민·카드는 저장해 두지 않아서 환영 화면부터 다시 한다. */
export function entryStep(step: Step | null): "intro" | "welcome" {
  return step && step !== "intro" ? "welcome" : "intro";
}
