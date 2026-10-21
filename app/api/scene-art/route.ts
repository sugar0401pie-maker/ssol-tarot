import { loadSceneArt } from "@/lib/server/sceneArt";

// 장면 그림 목록. 빌드 때 한 번 만들어 두는 정적 응답 — 결과 화면(요청마다 그리는 페이지)은 서버에서
// public 폴더를 읽을 수 없을 수 있어(배포 환경) 이 목록을 받아 쓴다.
export const dynamic = "force-static";

export function GET() {
  return Response.json(loadSceneArt());
}
