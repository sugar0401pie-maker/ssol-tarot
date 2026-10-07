// v1.2 화면 흐름 — 화면 이동을 한곳에서 정해 두는 상태 기계.
// 인트로 → 환영(닉네임) → 타로 경험 질문 → (처음이면 안내) → 고민 쓰기(건너뛰기 가능)
// → 셔플(다시 섞기) → 뽑기 → 다 뽑음 → (대기) → 결과. 위기 신호(urgent)면 어디서든 안전 안내로.

export const SCREENS = ["intro", "welcome", "experience", "first_time", "worry", "shuffle", "draw", "reveal", "loading", "result", "safety"];

export function initialState() {
  return { screen: "intro", nickname: null, experience: null, worryText: null, worrySkipped: false, picked: 0 };
}

export function next(state, action, data) {
  const s = { ...state };
  const c = data.copy;
  switch (action.type) {
    case "START":
      if (s.screen !== "intro") break;
      s.screen = "welcome"; return s;
    case "SUBMIT_NICKNAME": {
      if (s.screen !== "welcome") break;
      const n = String(action.nickname || "").trim();
      if (n.length < c.welcome.min_len) return { ...s, error: c.welcome.empty_error };
      s.nickname = n.slice(0, c.welcome.max_len); s.error = null; s.screen = "experience"; return s;
    }
    case "CHOOSE_EXPERIENCE":
      if (s.screen !== "experience") break;
      s.experience = action.value; // "returning" | "first"
      s.screen = action.value === "first" ? "first_time" : "worry"; return s;
    case "FIRST_TIME_OK":
      if (s.screen !== "first_time") break;
      s.screen = "worry"; return s;
    case "SUBMIT_WORRY": {
      if (s.screen !== "worry") break;
      const t = String(action.text || "").trim();
      if (t.length < c.worry.min_len) return { ...s, error: c.worry.too_short };
      s.worryText = t.slice(0, c.worry.max_len); s.worrySkipped = false; s.error = null;
      // 서버: 안전 키워드 즉시 확인. urgent면 셔플로 가지 않음. AI 분류는 셔플 연출 동안 백그라운드.
      s.screen = action.localUrgent ? "safety" : "shuffle"; return s;
    }
    case "SKIP_WORRY":
      if (s.screen !== "worry") break;
      s.worryText = null; s.worrySkipped = true; s.error = null; s.screen = "shuffle"; return s;
    case "AI_URGENT": // 백그라운드 AI 분류가 셔플·뽑기 도중 urgent를 돌려준 경우
      if (!["shuffle", "draw", "reveal", "loading"].includes(s.screen)) break;
      s.screen = "safety"; return s;
    case "RESHUFFLE":
      if (s.screen !== "shuffle") break;
      return s; // 같은 화면 유지, 서버가 새 셔플 발급
    case "PICK_NOW":
      if (s.screen !== "shuffle") break;
      s.screen = "draw"; s.picked = 0; return s;
    case "PICK":
      if (s.screen !== "draw" || s.picked >= data.deck.pick_count) break;
      s.picked += 1;
      if (s.picked === data.deck.pick_count) s.screen = "reveal";
      return s;
    case "SEE_RESULT":
      if (s.screen !== "reveal") break;
      s.screen = action.ready ? "result" : "loading"; return s;
    case "RESULT_READY":
      if (s.screen !== "loading") break;
      s.screen = "result"; return s;
  }
  throw new Error(`허용되지 않는 이동: ${state.screen} + ${action.type}`);
}
