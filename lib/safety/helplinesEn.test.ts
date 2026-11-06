import { test } from "node:test";
import assert from "node:assert/strict";
import { helplinesFor, fillHelplines, telOf } from "./helplinesEn.ts";

test("표에 없는 나라·국가 모름 → GLOBAL(다른 나라 번호를 보여 주지 않는다)", () => {
  for (const c of [null, "", "ZZ", "KR", "DE", "IN"]) {
    const h = helplinesFor(c);
    assert.match(h.crisis_line, /findahelpline/);
    assert.ok(!/988|116 123|13 11 14|911|999|000/.test(JSON.stringify(h)), `${c}: 다른 나라 번호`);
  }
});
test("나라별: 미국 988·911, 영국(GB) 116 123·999, 캐나다 988, 호주 13 11 14·000", () => {
  assert.match(helplinesFor("US").crisis_line, /988/); assert.equal(helplinesFor("US").emergency, "911");
  assert.match(helplinesFor("GB").crisis_line, /116 123/); assert.equal(helplinesFor("GB").emergency, "999");
  assert.match(helplinesFor("CA").crisis_line, /988/);
  assert.match(helplinesFor("AU").crisis_line, /13 11 14/); assert.equal(helplinesFor("AU").emergency, "000");
});
test("자리 채우기: 다른 자리는 그대로", () => {
  assert.equal(fillHelplines("Call {emergency} now, {nickname}.", helplinesFor("US")), "Call 911 now, {nickname}.");
});
test("전화 번호 고르기", () => {
  assert.equal(telOf("988 Suicide & Crisis Lifeline: call or text 988"), "988");
  assert.equal(telOf("Samaritans: call 116 123"), "116123");
  assert.equal(telOf("your local emergency number"), null);
});

import { fillHelplinesDeep } from "./helplinesEn.ts";
test("결과 응답 전체의 자리 표시를 채운다(다른 자리·숫자는 그대로)", () => {
  const h = helplinesFor("ZZ");
  const out = fillHelplinesDeep({ pages: [{ page: 10, fineprint: "Call {crisis_line}.", n: 3, body: "Hi {nickname}" }] }, h);
  assert.equal(out.pages[0].fineprint, `Call ${h.crisis_line}.`);
  assert.equal(out.pages[0].body, "Hi {nickname}");
  assert.equal(out.pages[0].n, 3);
});
