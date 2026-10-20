// 장면별 그림(owner 2026-10-20 "아스트로 테스트처럼 장면마다 이미지, 제일 위에").
// 파일은 public/images/tarot/scenes/<장면>/ 아래에 넣기만 하면 된다(이름 자유, webp·jpg·png) — 빌드 때 서버가 폴더를 읽어 목록을 만든다.
// 화면을 열 때마다 그 장면 그림 중 한 장을 무작위로. 그림이 없으면 아무것도 그리지 않는다(지금 화면 그대로).
export const SCENES = ["intro", "welcome", "experience", "first_time", "worry", "shuffle", "draw", "reveal", "loading"] as const;
// 안전 안내 화면(safety)은 일부러 넣지 않는다 — 승인된 안내만 보이게.
export type SceneId = (typeof SCENES)[number];
export type SceneArtMap = Partial<Record<SceneId, string[]>>;

/** rand는 0 이상 1 미만. 그림이 없으면 null. */
export function pickSceneArt(map: SceneArtMap, id: SceneId, rand: number): string | null {
  const files = map[id] ?? [];
  if (!files.length) return null;
  return files[Math.min(files.length - 1, Math.max(0, Math.floor(rand * files.length)))];
}
