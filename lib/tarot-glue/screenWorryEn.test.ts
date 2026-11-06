import { test } from "node:test";
import assert from "node:assert/strict";
import { screenTextEn, normEn } from "./screenWorryEn.ts";

// 영어 사전 _note·프롬프트 메모(A_classify_en)의 경계 예시. 사전이 바뀌어 이 테스트가 깨지면 느슨해진 것인지 먼저 본다.
test("urgent: 직접 표현", () => {
  for (const s of ["I want to die", "honestly i wanna die", "I'm going to kill myself", "kms", "I've been thinking about suicide", "I want to end my life"]) {
    assert.equal(screenTextEn(s).level, "urgent", s);
  }
});
test("watch: 소극적 표현", () => {
  for (const s of ["I just want to disappear", "I don't want to be here anymore"]) assert.equal(screenTextEn(s).level, "watch", s);
});
test("none: 관용 표현은 제외", () => {
  for (const s of ["This exam is killing me", "my boss is literally killing me lol", "I'm starving to death", "We killed it at the gig", "Should I text my ex?"]) {
    const r = screenTextEn(s);
    assert.equal(r.level, "none", s);
  }
});
test("남이 한 협박: urgent 아님, violence", () => {
  const r = screenTextEn("My boyfriend said he'll kill himself if I leave him");
  assert.equal(r.level, "none");
  assert.equal(r.violence, true);
});
test("violence / fear", () => {
  assert.equal(screenTextEn("He hit me last night").violence, true);
  const f = screenTextEn("When he's angry he throws things");
  assert.equal(f.violence, false);
  assert.equal(f.fear, true);
});
test("정리: 곧은 따옴표·gonna", () => {
  assert.equal(normEn("I’m  GONNA   go"), "i'm going to go");
});

// 기획 시험 문장 60개(docs/spec/en/safety/test_cases_en.json — run_test.py와 같은 기대값). 실패하면 사전이 느슨해진 것인지 먼저 본다.
import fs from "node:fs";
test("기획 영어 안전 시험 60문장", () => {
  const cases = JSON.parse(fs.readFileSync(new URL("../../docs/spec/en/safety/test_cases_en.json", import.meta.url), "utf8")).cases as { id: string; text: string; expected: string }[];
  const bad: string[] = [];
  for (const c of cases) {
    const r = screenTextEn(c.text);
    const got = r.level !== "none" ? r.level : r.violence ? "violence" : r.fear ? "fear" : "none";
    if (got !== c.expected) bad.push(`${c.id}: ${c.expected} → ${got}`);
  }
  assert.deepEqual(bad, []);
});
