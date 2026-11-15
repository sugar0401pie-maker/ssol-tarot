import { test } from "node:test";
import assert from "node:assert/strict";
import { STEP_PATH, stepFromPath, canFollow, entryStep, worryStep } from "./steps.ts";

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

test("고민 쓰기 뒤 질문 장면도 자기 주소(owner 2026-11-15 hard rule)", () => {
  assert.equal(worryStep(null), "worry");
  assert.equal(worryStep({ multi: true, shown: 0 }), "worry_pick");
  assert.equal(worryStep({ shown: 0 }), "worry_more");
  assert.equal(worryStep({ shown: 1 }), "worry_more_2");
  assert.equal(stepFromPath("/worry-more-2"), "worry_more_2");
  assert.equal(canFollow("worry_more_2", "worry_more"), true);
  assert.equal(canFollow("worry_more", "worry"), true);
  assert.equal(canFollow("worry_pick", "worry"), true);
  assert.equal(canFollow("shuffle", "worry_more"), false);
  assert.equal(entryStep("worry_more"), "welcome");
});
