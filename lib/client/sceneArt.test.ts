import { test } from "node:test";
import assert from "node:assert/strict";
import { pickSceneArt } from "./sceneArt.ts";

const f = (n: string) => `/images/tarot/scenes/welcome/${n}`;

test("장면 그림: 없으면 null, 있으면 무작위 한 장(범위 밖 값도 안전)", () => {
  assert.equal(pickSceneArt({}, "welcome", 0.3), null);
  const map = { welcome: [f("a.webp"), f("b.webp")] };
  assert.equal(pickSceneArt(map, "welcome", 0)?.endsWith("a.webp"), true);
  assert.equal(pickSceneArt(map, "welcome", 0.99)?.endsWith("b.webp"), true);
  assert.equal(pickSceneArt(map, "welcome", 1)?.endsWith("b.webp"), true);
  assert.equal(pickSceneArt(map, "worry", 0.5), null);
});

import { withExtraPool } from "./sceneArt.ts";
test("그림 없는 단계·공용 그림은 앞 단계와 결과 6·7쪽 후보에 섞인다(2026-11-08)", () => {
  const map = { welcome: ["w"], shuffle: ["s"], draw: ["d"], reveal: ["r"], loading: ["l"], extra: ["e1", "e2"] };
  const m = withExtraPool(map);
  assert.deepEqual(m.welcome, ["w", "s", "d", "r", "l", "e1", "e2"]);
  assert.deepEqual(m.shuffle, ["s", "d", "r", "l", "e1", "e2"]);
  assert.deepEqual(m.draw, ["d", "s", "r", "l", "e1", "e2"]);
  assert.equal(m.loading, map.loading, "기다림 단계 자기 목록은 그대로(화면엔 안 씀)");
});

test("다 뽑음 그림은 앞 단계 후보에 섞이고, 원래 지도는 그대로", () => {
  const map = { welcome: ["w.webp"], worry: ["k.webp"], reveal: ["r1.webp", "r2.webp"] };
  const m = withExtraPool(map);
  assert.deepEqual(m.welcome, ["w.webp", "r1.webp", "r2.webp"]);
  assert.deepEqual(m.worry, ["k.webp", "r1.webp", "r2.webp"]);
  assert.deepEqual(m.experience, ["r1.webp", "r2.webp"]);
  assert.deepEqual(map.welcome, ["w.webp"]);
  assert.deepEqual(withExtraPool({ welcome: ["w.webp"] }).welcome, ["w.webp"]);
});
