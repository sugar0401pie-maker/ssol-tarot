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
