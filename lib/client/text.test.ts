import { test } from "node:test";
import assert from "node:assert/strict";
import { clean, fill } from "./text.ts";

test("내부 확인 메모는 화면에서 지운다", () => {
  assert.equal(clean("24시간 [확인필요: 출시 전 최신 번호 확인]"), "24시간");
  assert.equal(clean("긴급 시 112에서 도움받을 수 있어요. [확인필요]"), "긴급 시 112에서 도움받을 수 있어요.");
  assert.equal(clean("그대로"), "그대로");
});

test("자리표시자 채우기", () => {
  assert.equal(fill("{nickname}님, 안녕하세요", { nickname: "지수" }), "지수님, 안녕하세요");
  assert.equal(fill("{picked} / 3", { picked: 2 }), "2 / 3");
  assert.equal(fill("{unknown}", {}), "{unknown}");
});
