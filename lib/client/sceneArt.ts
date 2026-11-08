// 장면별 그림(owner 2026-10-20 "아스트로 테스트처럼 장면마다 이미지, 제일 위에").
// 파일은 public/images/tarot/scenes/<장면>/ 아래에 넣기만 하면 된다(이름 자유, webp·jpg·png) — 빌드 때 서버가 폴더를 읽어 목록을 만든다.
// 화면을 열 때마다 그 장면 그림 중 한 장을 무작위로. 그림이 없으면 아무것도 그리지 않는다(지금 화면 그대로).
export const SCENES = [
  "intro", "welcome", "experience", "first_time", "worry", "shuffle", "draw", "reveal", "loading",
  // 로그인 화면 안내 그림(owner 2026-10-21 "아스트로 로그인처럼") — 폴더가 비어 있으면 환영 장면 그림을 쓴다
  "login",
  // 결과 화면(owner 그림 09~12): 해석 → 5쪽, 웰니스 처방 → 8쪽, 실천 → 9쪽, 쏘웰라로 이어 가기 → 10쪽 (RESULT_PAGE_SCENE)
  "result_interpret", "result_wellness", "result_practice", "result_continue",
  // 공용 그림(owner 2026-11-08): 특정 단계 없이 받은 그림 — 혼자는 어디에도 안 나오고 EXTRA_POOL로 다른 화면 후보에만 섞인다
  "extra",
] as const;
// 안전 안내 화면(safety)은 일부러 넣지 않는다 — 승인된 안내만 보이게.
export type SceneId = (typeof SCENES)[number];
export type SceneArtMap = Partial<Record<SceneId, string[]>>;

/** rand는 0 이상 1 미만. 그림이 없으면 null. */
export function pickSceneArt(map: SceneArtMap, id: SceneId, rand: number): string | null {
  const files = map[id] ?? [];
  if (!files.length) return null;
  return files[Math.min(files.length - 1, Math.max(0, Math.floor(rand * files.length)))];
}

/** 결과 쪽 번호 → 그 쪽 맨 위 그림 장면(없으면 그림 없음). 1~4쪽은 카드 그림이 이미 맨 위에 있다. */
// 6~8쪽(owner 2026-10-21 "결과 6~8쪽에 캐릭터가 없어서 넣어 주세요"): 섞기·뽑기 화면에서 뺀 그림과 다 뽑음 그림을 다시 쓴다.
export const RESULT_PAGE_SCENE: Partial<Record<number, SceneId>> = {
  // 2026-10-22 8쪽(변화) 숨김 → 10쪽(쏘웰라 쪽은 다시 따로, owner). 예전 8쪽 그림(reveal)만 빠짐.
  5: "result_interpret", 6: "shuffle", 7: "draw", 8: "result_wellness", 9: "result_practice", 10: "result_continue",
};

// 화면에 그림을 띄우지 않는 단계(섞기·뽑기·다 뽑음·결과 기다림)의 그림과 공용 그림(extra)은 다른 화면의 무작위 후보로 돌린다
// (owner 2026-11-02 reveal → 앞 단계, 2026-11-08 "다른 화면의 무작위 후보로" — loading·extra·섞기·뽑기 그림도).
// 대상: 앞 단계 4곳(환영·경험 질문·처음 안내·고민 쓰기) + 결과 6쪽(shuffle)·7쪽(draw). 기다림 화면 자체에는 여전히 그림 없음.
const SHARED: SceneId[] = ["shuffle", "draw", "reveal", "loading", "extra"];
const others = (self?: SceneId) => SHARED.filter((s) => s !== self);
export const EXTRA_POOL: Partial<Record<SceneId, SceneId[]>> = {
  welcome: others(), experience: others(), first_time: others(), worry: others(),
  shuffle: others("shuffle"), draw: others("draw"),
};
/** 장면별 후보에 EXTRA_POOL 그림을 더한 지도(같은 파일은 한 번만). */
export function withExtraPool(map: SceneArtMap, extra: Partial<Record<SceneId, SceneId[]>> = EXTRA_POOL): SceneArtMap {
  const out: SceneArtMap = { ...map };
  for (const [id, from] of Object.entries(extra) as [SceneId, SceneId[]][]) {
    const own = map[id] ?? [];
    const add = from.flatMap((f) => map[f] ?? []);
    if (add.length) out[id] = [...new Set([...own, ...add])];
  }
  return out;
}
