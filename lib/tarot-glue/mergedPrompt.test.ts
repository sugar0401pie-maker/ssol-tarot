import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMergedSystem, splitMerged } from "./mergedPrompt.js";

test("합친 프롬프트는 두 원문을 고치지 않고 그대로 담는다", () => {
  const m = buildMergedSystem("분류 원문 A", "고민 틀 원문 A2");
  assert.ok(m.includes("분류 원문 A") && m.includes("고민 틀 원문 A2"));
  assert.ok(m.indexOf("분류 원문 A") < m.indexOf("고민 틀 원문 A2"));
  assert.match(m, /"classification"/);
});

test("합친 응답을 두 절반으로 나누고, 형식이 틀린 절반은 null(그 절반만 다시 부름)", () => {
  const r = splitMerged('```json\n{"classification":{"crisis_level":"none"},"frame":{"table":"job"}}\n```');
  assert.deepEqual(JSON.parse(r.classification!), { crisis_level: "none" });
  assert.deepEqual(JSON.parse(r.frame!), { table: "job" });
  assert.deepEqual(splitMerged('{"classification":{"crisis_level":"urgent"}}'), { classification: '{"crisis_level":"urgent"}', frame: null });
  assert.deepEqual(splitMerged("JSON 아님"), { classification: null, frame: null });
});
