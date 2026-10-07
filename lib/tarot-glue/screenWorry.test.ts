import { test } from "node:test";
import assert from "node:assert/strict";
import { screenWorry } from "./screenWorry.ts";

test("v2.5에서 데이터로 옮긴 새 위험 단어도 잡는다", () => {
  assert.equal(screenWorry("요즘은 다 끝내고 싶다는 생각만 들어요").level, "urgent");
  assert.equal(screenWorry("살 이유가 없는 것 같아요").level, "urgent");
  assert.equal(screenWorry("사는 게 지옥 같아요").level, "watch");
  assert.equal(screenWorry("남자친구가 저를 밀쳤어요").violence, true);
});

test("예전부터 있던 단어와 오탐 방지 규칙은 그대로", () => {
  assert.equal(screenWorry("죽고 싶어요").level, "urgent");
  assert.equal(screenWorry("자해를 한 적이 있어요").level, "urgent");
  assert.equal(screenWorry("혼자 살기 시작했는데 외로워요").level, "none");
  assert.equal(screenWorry("회사에서 인정받지 못해 지쳐요").level, "none");
});
