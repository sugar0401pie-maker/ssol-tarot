import { test } from "node:test";
import assert from "node:assert/strict";
import { followupArm, shouldAskFollowup, checkAnswers } from "./followup.ts";

test("A/B 칸은 결과 번호로 고정되고 대략 반씩 나뉜다", () => {
  assert.equal(followupArm("abc"), followupArm("abc"));
  const n = Array.from({ length: 400 }, (_, i) => followupArm(`s-${i}`)).filter((x) => x === "B").length;
  assert.ok(n > 150 && n < 250, String(n));
});

test("짧은 글·B칸·한국어·위기 아님일 때만 묻는다", () => {
  const b = Array.from({ length: 50 }, (_, i) => `s-${i}`).find((id) => followupArm(id) === "B")!;
  const a = Array.from({ length: 50 }, (_, i) => `s-${i}`).find((id) => followupArm(id) === "A")!;
  assert.equal(shouldAskFollowup(b, "그 사람 마음이 궁금해요", { urgent: false, locale: "ko" }), true);
  assert.equal(shouldAskFollowup(a, "그 사람 마음이 궁금해요", { urgent: false, locale: "ko" }), false);
  assert.equal(shouldAskFollowup(b, "그 사람 마음이 궁금해요", { urgent: true, locale: "ko" }), false);
  assert.equal(shouldAskFollowup(b, "그 사람 마음이 궁금해요", { urgent: false, locale: "en" }), false);
  assert.equal(shouldAskFollowup(b, "그 사람 마음이 궁금해요. 요즘 연락이 뜸해져서 혹시 마음이 식은 건 아닐까 걱정이에요.", { urgent: false, locale: "ko" }), false);
});

test("답 검사: 질문 순서대로만, 아니면 null", () => {
  assert.deepEqual(checkAnswers([]), []);
  assert.deepEqual(checkAnswers([{ q: "q1", id: "love" }, { q: "love", id: "crush" }]), [{ q: "q1", id: "love" }, { q: "love", id: "crush" }]);
  assert.equal(checkAnswers([{ q: "love", id: "crush" }]), null);
  assert.equal(checkAnswers([{ q: "q1", id: "nope" }]), null);
  assert.equal(checkAnswers([{ q: "q1", id: "love" }, { q: "work", id: "think" }]), null);
  assert.equal(checkAnswers([{ q: "q1", id: "love" }, { q: "love", id: "crush" }, { q: "want", id: "x" }]), null);
  assert.equal(checkAnswers("x"), null);
});

import { pickGuess } from "./followup.ts";
test("분야 짐작: 10개 중 7개 이상 같은 분야이고 첫 질문 답에 있을 때만", () => {
  assert.deepEqual(pickGuess([..."LLLLLLLCCJ"].map((x) => ({ L: "LOV", C: "CAR", J: "JOB" })[x])), { area: "LOV", id: "love", share: 0.7 });
  assert.equal(pickGuess([..."LLLLLLCCCJ"].map((x) => ({ L: "LOV", C: "CAR", J: "JOB" })[x])), null); // 6개
  assert.equal(pickGuess(Array(10).fill("FORT")), null); // 첫 질문 답에 없는 분야
  assert.equal(pickGuess([]), null);
  assert.equal(pickGuess(["LOV", "LOV", "LOV", null, null, null, null, null, null, null]), null);
});
