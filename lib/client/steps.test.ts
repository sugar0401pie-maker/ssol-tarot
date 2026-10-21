import { test } from "node:test";
import assert from "node:assert/strict";
import { STEP_PATH, stepFromPath, canFollow, entryStep } from "./steps.ts";

test("주소 ↔ 화면", () => {
  assert.equal(stepFromPath("/"), "intro");
  assert.equal(stepFromPath("/first-time"), "first_time");
  assert.equal(stepFromPath("/draw/"), "draw");
  assert.equal(stepFromPath("/login"), null);
  for (const [k, v] of Object.entries(STEP_PATH)) assert.equal(stepFromPath(v), k);
});

test("뒤로 가기는 고민을 내기 전 단계 안에서, 앞쪽으로만", () => {
  assert.equal(canFollow("experience", "welcome"), true);
  assert.equal(canFollow("worry", "intro"), true);
  assert.equal(canFollow("welcome", "experience"), false); // 앞으로 가기는 버튼으로만
  assert.equal(canFollow("shuffle", "worry"), false); // 고민 낸 뒤에는 되돌아가지 않음
  assert.equal(canFollow("draw", "shuffle"), false);
});

test("주소로 바로 들어오면 첫 화면 또는 환영 화면부터", () => {
  assert.equal(entryStep(null), "intro");
  assert.equal(entryStep("intro"), "intro");
  assert.equal(entryStep("draw"), "welcome");
  assert.equal(entryStep("welcome"), "welcome");
});
