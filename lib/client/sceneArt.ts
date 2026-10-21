// 장면별 그림(owner 2026-10-20 "아스트로 테스트처럼 장면마다 이미지, 제일 위에").
// 파일은 public/images/tarot/scenes/<장면>/ 아래에 넣기만 하면 된다(이름 자유, webp·jpg·png) — 빌드 때 서버가 폴더를 읽어 목록을 만든다.
// 화면을 열 때마다 그 장면 그림 중 한 장을 무작위로. 그림이 없으면 아무것도 그리지 않는다(지금 화면 그대로).
export const SCENES = [
  "intro", "welcome", "experience", "first_time", "worry", "shuffle", "draw", "reveal", "loading",
  // 로그인 화면 안내 그림(owner 2026-10-21 "아스트로 로그인처럼") — 폴더가 비어 있으면 환영 장면 그림을 쓴다
  "login",
  // 결과 화면(owner 그림 09~12): 해석 → 5쪽, 웰니스 처방 → 9쪽, 실천 → 10쪽, 쏘웰라로 이어 가기 → 11쪽
  "result_interpret", "result_wellness", "result_practice", "result_continue",
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
export const RESULT_PAGE_SCENE: Partial<Record<number, SceneId>> = { 5: "result_interpret", 9: "result_wellness", 10: "result_practice", 11: "result_continue" };
