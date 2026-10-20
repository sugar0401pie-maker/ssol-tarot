import "server-only";
import fs from "node:fs";
import path from "node:path";
import { SCENES, type SceneArtMap } from "@/lib/client/sceneArt";

// public/images/tarot/scenes/<장면>/의 그림 목록(이름순). 빌드 때 한 번 읽는다 — 새 그림을 넣으면 다시 배포하면 된다.
const DIR = path.join(process.cwd(), "public/images/tarot/scenes");
const EXT = /\.(webp|jpe?g|png)$/i;

export function loadSceneArt(): SceneArtMap {
  const out: SceneArtMap = {};
  for (const id of SCENES) {
    const dir = path.join(DIR, id);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => EXT.test(f)).sort();
    if (files.length) out[id] = files.map((f) => `/images/tarot/scenes/${id}/${encodeURIComponent(f)}`);
  }
  return out;
}
