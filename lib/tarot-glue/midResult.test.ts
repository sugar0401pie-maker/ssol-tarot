import { test } from "node:test";
import assert from "node:assert/strict";
import db from "../../data/mid_result_db.json" with { type: "json" };
import { midResult, type MidDb } from "./midResult.ts";
import { worryPageBody, type SecretCopy } from "./secretThird.ts";

const D = db as unknown as MidDb;
const pick = (no: number, reversed = false, name = "카드") => ({ reversed, positionName: "자리", card: { no, name } });

test("기획 예시(직업, 11 역 → 2 정)와 같은 문장으로 조립", () => {
  const out = midResult(D, "CAR", [pick(11, true), pick(2)]);
  assert.ok(out);
  assert.equal(out!.length, 2);
  assert.ok(out![0].startsWith("그동안 프로젝트가 틀어지면 남보다 내 실수부터"));
  assert.ok(out![0].includes(" 지금은 속으로 이 회사가 나와 맞지 않다고"));
  assert.equal(out![1], D.merge["F2>C"]);
});

test("모든 영역·두 장 조합(같은 카드 제외)에서 빠짐없이 나온다", () => {
  for (const dm of ["CAR", "DIR", "LOV", "FAM", "SOC", "LIF", null]) {
    for (let a = 0; a < 22; a++) for (const ra of [false, true]) for (let b = 0; b < 22; b++) for (const rb of [false, true]) {
      if (a === b) continue;
      const out = midResult(D, dm, [pick(a, ra), pick(b, rb)]);
      assert.ok(out && out.length === 2, `${dm} ${a}${ra} ${b}${rb}`);
    }
  }
});

test("영역을 모르면 고민 미작성 문장, 카드를 모르면 null", () => {
  assert.ok(midResult(D, "XYZ", [pick(0), pick(1)])![0].startsWith(D.lines.NONE["0_up"].past!));
  assert.equal(midResult(D, "CAR", [{ card: {} }, pick(1)]), null);
});

const copy: SecretCopy = { intro: "", worry_title: "{nickname}님의 고민 풀어보기", two_title: "지금까지 두 장이 보여 준 것", same: "같아요 {options}", split: "달라요", general: "일반",
  next_button: "", p4_title: "", p4_options: "", p4_general: "" };
test("3쪽: 카드별 이유 목록(◦ … 쪽을 가리켜요) 대신 중간 결과, 세 번째 카드는 쓰지 않음", () => {
  const lean = { option: "이직하기", cards: [{ option: "이직하기", reason: "a라, ‘이직하기’ 쪽을 가리켜요." }, { option: "이직하기", reason: "b라, ‘이직하기’ 쪽을 가리켜요." }, { option: "x", reason: "c" }] };
  const picks = [pick(0, false, "첫 물장구"), pick(15, true, "부풀어 오른 마음"), pick(19, false, "비밀카드")];
  const body = worryPageBody({ name: "도현", oldPage1: "", reading: "읽기.", frame: { options: ["이직하기", "남기"] }, lean, picks, copy, frameTitle: "x", mid: D, domain: "CAR" });
  assert.ok(!body.includes("◦ ") && !body.includes("쪽을 가리켜요"));
  assert.ok(body.includes(D.lines.CAR["0_up"].past!) && body.includes(D.lines.CAR["15_rev"].block!));
  assert.ok(!body.includes("비밀카드"));
  // 고민 미작성(방향 없음)에도 두 장 중간 결과가 나온다
  const none = worryPageBody({ name: "도현", oldPage1: "", reading: "읽기.", frame: null, lean: null, picks, copy, frameTitle: "x", mid: D, domain: null });
  assert.ok(none.includes(D.lines.NONE["0_up"].past!));
  // DB가 없으면 예전 목록 그대로
  const old = worryPageBody({ name: "도현", oldPage1: "", reading: "읽기.", frame: null, lean, picks, copy, frameTitle: "x" });
  assert.ok(old.includes("◦ 자리 ‘첫 물장구’"));
});
