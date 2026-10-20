// owner가 올린 원본 그림(png)을 앱이 쓰는 이름·형식(webp)으로 정리한다. 다시 올리면 다시 돌린다: node scripts/import_art.mjs
//  · 카드: public/images/tarot/NN-이름.png → 같은 번호의 기존 파일 이름 card-NN-*.webp (원본 해상도, 품질 92)
//  · 장면: public/images/tarot/scenes/NN-이름-a.png → scenes/<장면>/a.webp (원본 해상도, 품질 90)
// 변환이 끝난 png는 지운다(웹에 원본 png를 그대로 내보내지 않게 — 원본은 git 기록에 남아 있다).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const CARDS = "public/images/tarot";
const SCENES = path.join(CARDS, "scenes");
// 장면 번호 → 앱의 장면 이름(lib/client/sceneArt.ts SCENES)
const SCENE_OF = {
  "01": "welcome", "02": "experience", "03": "first_time", "04": "worry", "05": "shuffle", "06": "draw", "07": "reveal",
  "08": "loading", "09": "result_interpret", "10": "result_wellness", "11": "result_practice", "12": "result_continue",
};

const existing = fs.readdirSync(CARDS).filter((f) => /^card-\d\d-.+\.webp$/.test(f));
let cards = 0, scenes = 0;
for (const f of fs.readdirSync(CARDS).filter((f) => /^\d\d-.+\.(png|jpe?g|webp)$/i.test(f))) {
  const no = f.slice(0, 2);
  const target = existing.find((e) => e.startsWith(`card-${no}-`));
  if (!target) { console.warn("번호에 맞는 카드 없음:", f); continue; }
  await sharp(path.join(CARDS, f)).webp({ quality: 92 }).toFile(path.join(CARDS, target + ".tmp"));
  fs.renameSync(path.join(CARDS, target + ".tmp"), path.join(CARDS, target));
  fs.unlinkSync(path.join(CARDS, f));
  cards++;
}
for (const f of fs.readdirSync(SCENES).filter((f) => /^\d\d-.+\.(png|jpe?g|webp)$/i.test(f))) {
  const m = f.match(/^(\d\d)-.+?-([a-z0-9]+)\.\w+$/i);
  const scene = m && SCENE_OF[m[1]];
  if (!scene) { console.warn("장면을 알 수 없음:", f); continue; }
  fs.mkdirSync(path.join(SCENES, scene), { recursive: true });
  await sharp(path.join(SCENES, f)).webp({ quality: 90 }).toFile(path.join(SCENES, scene, `${m[2].toLowerCase()}.webp`));
  fs.unlinkSync(path.join(SCENES, f));
  scenes++;
}
console.log(`카드 ${cards}장, 장면 그림 ${scenes}장 정리`);
