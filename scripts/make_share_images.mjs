// 카카오톡 공유 카드용 그림 만들기(800×800 jpg — 카카오 카드는 webp를 못 쓰는 경우가 있어 jpg).
// 밤색 바탕 가운데 카드 한 장. 역방향 카드는 180도 돌린 판(-rev)도 만든다. 사이트 미리보기 그림(og, 1200×630)도 함께.
// 카드 그림을 고화질로 바꾸면 다시 돌린다: node scripts/make_share_images.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = "public/images/tarot";
const OUT = path.join(SRC, "kakao");
const NIGHT = { r: 1, g: 47, b: 83 }; // --night #012F53
fs.mkdirSync(OUT, { recursive: true });

const files = fs.readdirSync(SRC).filter((f) => /^card-\d\d-.+\.webp$/.test(f));
for (const f of files) {
  const base = f.replace(/\.webp$/, "");
  const card = await sharp(path.join(SRC, f)).resize({ height: 700 }).toBuffer();
  for (const rev of [false, true]) {
    const c = rev ? await sharp(card).rotate(180).toBuffer() : card;
    const meta = await sharp(c).metadata();
    await sharp({ create: { width: 800, height: 800, channels: 3, background: NIGHT } })
      .composite([{ input: c, left: Math.round((800 - meta.width) / 2), top: 50 }])
      .jpeg({ quality: 86 })
      .toFile(path.join(OUT, `${base}${rev ? "-rev" : ""}.jpg`));
  }
}

// 사이트 미리보기 그림: 카드 뒷면 세 장
const back = await sharp(path.join(SRC, "card-back.webp")).resize({ height: 520 }).toBuffer();
const bw = (await sharp(back).metadata()).width;
const gap = 40;
const left0 = Math.round((1200 - (bw * 3 + gap * 2)) / 2);
await sharp({ create: { width: 1200, height: 630, channels: 3, background: NIGHT } })
  .composite([0, 1, 2].map((i) => ({ input: back, left: left0 + i * (bw + gap), top: 55 })))
  .jpeg({ quality: 86 })
  .toFile("app/opengraph-image.jpg");
console.log(`카드 ${files.length}장 × 2 + 미리보기 그림 1장`);
