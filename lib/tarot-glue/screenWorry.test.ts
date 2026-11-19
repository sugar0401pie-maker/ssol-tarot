import { test } from "node:test";
import assert from "node:assert/strict";
import { screenWorry } from "./screenWorry.ts";

test("데이터로 옮긴 위험 단어를 잡는다(v4.1 CSO 2026-10-22 기준)", () => {
  // urgent(카드 멈춤) = 죽음에 대한 직접 표현·자해 행동·작별 준비
  // v2.3.20(CSO 2026-11-15): '그만 살려/래/까'·'삶을 끝내'·'뛰어내리' 등은 키워드로는 watch(109 안내) — 카드를 멈출지는 AI 분류([안전 판단])가 정한다.
  assert.equal(screenWorry("요즘 그만 살려고요").level, "watch");
  assert.equal(screenWorry("뛰어내리고 싶어요").level, "watch");
  // 2026-11-19 owner: 구체적 시기·장소가 없으면 직접 표현도 watch(카드는 그대로, 109 안내 한 줄)
  assert.equal(screenWorry("차라리 죽을까 생각해요").level, "watch");
  // 2026-11-15 owner(v2.3.18): 낱말만으로는 갈리는 표현은 키워드에서 빼고 AI 분류가 맡음, 문맥 규칙은 watch
  // v2.3.24 CSO 정답 세트: 문맥 규칙 7개 모두 watch(U4 '가족에게 편지를 써 뒀' 포함). 받는 사람이 없으면 낱말만으로는 none.
  assert.equal(screenWorry("가족한테 편지를 써 뒀어요").level, "watch");
  assert.equal(screenWorry("친구 생일이라 편지를 써 뒀어요").level, "none");
  assert.equal(screenWorry("이 집에서 그만 살고 싶어요").level, "none");
  assert.equal(screenWorry("더 버틸 이유가 없어요").level, "watch");
  assert.equal(screenWorry("강아지가 아픈데 죽을까요?").level, "watch");
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
  assert.equal(screenWorry("죽고 싶어요").level, "watch"); // 2026-11-19 owner: 시기·장소 없으면 watch
  assert.equal(screenWorry("자해를 한 적이 있어요").level, "watch");
  assert.equal(screenWorry("혼자 살기 시작했는데 외로워요").level, "none");
  assert.equal(screenWorry("회사에서 인정받지 못해 지쳐요").level, "none");
});

test("카드 멈춤은 자기 죽음의 구체적 시기·장소를 말할 때만(owner 2026-11-19)", () => {
  // 시기
  for (const t of ["내일 죽으려고요", "이번 주말에 자살할 거예요", "언제 죽을지 고민 중이에요", "죽을 날을 정했어요", "오늘 밤에 죽으려고요"])
    assert.equal(screenWorry(t).level, "urgent", t);
  // 장소
  for (const t of ["어디서 죽어야 할지 찾아보고 있어요", "죽을 곳을 알아보는 중이에요", "한강 다리에서 죽으려고요", "옥상에서 죽으려고요"])
    assert.equal(screenWorry(t).level, "urgent", t);
  // 시기·장소 없는 직접 표현·관용 표현·남 이야기는 멈추지 않음
  assert.equal(screenWorry("회사 너무 힘들어서 죽고 싶어요").level, "watch");
  assert.equal(screenWorry("한강 다리에서 뛰어내릴까 해요").level === "urgent", false);
  assert.equal(screenWorry("옥상에서 뛰어내리고 싶다").level === "urgent", false);
  assert.equal(screenWorry("내일 밤에 뛰어내리려고요").level === "urgent", false);
  assert.equal(screenWorry("결혼 날짜를 정했어요").level, "none");
  assert.equal(screenWorry("내일 시험이라 죽겠어요").level, "none");
  assert.equal(screenWorry("내일 발표인데 죽을 것 같아요").level, "none");
  assert.equal(screenWorry("인생 언제 죽을지 모르니까 하고 싶은 거 해야죠").level, "watch");
  assert.equal(screenWorry("강아지가 아픈데 언제 죽을지 몰라 무서워요").level === "urgent", false);
  assert.equal(screenWorry("헤어지자고 하면 내일 죽어버리겠대요").level === "urgent", false);
});
