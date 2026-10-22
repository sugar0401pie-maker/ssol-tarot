import { test } from "node:test";
import assert from "node:assert/strict";
import { screenWorry } from "./screenWorry.ts";

test("데이터로 옮긴 위험 단어를 잡는다(v4.1 CSO 2026-10-22 기준)", () => {
  // urgent(카드 멈춤) = 죽음에 대한 직접 표현·자해 행동·작별 준비
  assert.equal(screenWorry("요즘 그만 살고 싶어요").level, "urgent");
  assert.equal(screenWorry("가족한테 편지를 써 뒀어요").level, "urgent");
  assert.equal(screenWorry("더 버틸 이유가 없어요").level, "urgent");
  // watch(결과 그대로 + 마지막 쪽 109 안내) = 소극적 표현. v4.0까지는 urgent였다 — owner가 CSO 결정 그대로 따르기로 함(2026-10-22):
  // 한 번 적은 문장만으로 판별하는 테스트라 여러 차례 대화하는 쏘웰라와 기준이 같을 수 없다.
  assert.equal(screenWorry("요즘은 다 끝내고 싶다는 생각만 들어요").level, "watch");
  assert.equal(screenWorry("살 이유가 없는 것 같아요").level, "watch");
  assert.equal(screenWorry("그냥 사라지고 싶어요").level, "watch");
  assert.equal(screenWorry("사는 게 지옥 같아요").level, "none");
  assert.equal(screenWorry("남자친구가 저를 밀쳤어요").violence, true);
  // 물건 던지기는 폭력이 아니라 두려움(안내 박스 + 방향 계산)
  const thrown = screenWorry("싸우면 남편이 물건을 던져요");
  assert.equal(thrown.fear, true);
  assert.equal(thrown.violence, false);
});

test("예전부터 있던 단어와 오탐 방지 규칙은 그대로", () => {
  assert.equal(screenWorry("죽고 싶어요").level, "urgent");
  assert.equal(screenWorry("자해를 한 적이 있어요").level, "urgent");
  assert.equal(screenWorry("혼자 살기 시작했는데 외로워요").level, "none");
  assert.equal(screenWorry("회사에서 인정받지 못해 지쳐요").level, "none");
});
