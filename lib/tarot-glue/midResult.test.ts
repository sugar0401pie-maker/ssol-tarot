import { test } from "node:test";
import assert from "node:assert/strict";
import db from "../../data/mid_result_db.json" with { type: "json" };
import { midResult, type MidDb } from "./midResult.ts";
import { worryPageBody, type SecretCopy } from "./secretThird.ts";
import data from "../../data/tarot_data.json" with { type: "json" };

const D = db as unknown as MidDb;
const pick = (no: number, reversed = false, name = "카드") => ({ reversed, positionName: "자리", card: { no, name } });

test("기획 예시(직업, 11 역 → 2 정)와 같은 문장으로 조립", () => {
  const out = midResult(D, "CAR", [pick(11, true), pick(2)]);
  assert.ok(out);
  assert.equal(out!.length, 2);
  assert.ok(out![0].startsWith("!! **그동안 프로젝트가 틀어지면 남보다 내 실수부터"));
  assert.ok(out![0].includes("퇴근해 왔어요.** 지금은"), "첫 문장만 굵게");
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
  assert.ok(midResult(D, "XYZ", [pick(0), pick(1)])![0].startsWith(`!! **${D.lines.NONE["0_up"].past!}**`));
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

test("합 문장은 과거형(owner 예시 C1>D)", () => {
  assert.equal(D.merge["C1>D"], "답이 보이지 않으니 상상으로 나쁜 쪽부터 그리게 되고, 겁이 날수록 더 확실한 신호를 기다렸어요. 기다림과 걱정이 서로를 키워, 시간이 갈수록 오히려 더 불안해졌어요.");
  for (const v of Object.values(D.merge)) assert.ok(!/(있어요|돼요|상태예요|없어요)\.(\s|$)/.test(v), v);
});

const LEADS = (data.copy.result as unknown as { secret3: { change_leads: string[] } }).secret3.change_leads;
test("3쪽 순서: 중간 결과 → 전환 문장(그러는 한편…, 두 장을 종합하면 대신) → 하지만…", () => {
  const R = (c: string) => `${c}라, ‘이직하기’ 쪽을 가리켜요.`;
  const lean = { option: "이직하기", cards: [{ option: "이직하기", reason: R("가볍게 새 자리로 첫발을 내디뎌도 좋은 때") }, { option: "이직하기", reason: R("익숙한 조건에 묶인 자리에서 풀려날 수 있는 카드") }, { option: "x", reason: "c" }] };
  const picks = [pick(0), pick(15), pick(19)];
  const body = worryPageBody({ name: "도현", oldPage1: "", reading: "읽기.", frame: { options: ["이직하기", "더 다니기"] }, lean, picks, copy: { ...copy, change_leads: LEADS }, frameTitle: "x", mid: D, domain: "CAR" });
  assert.ok(!body.includes("두 장을 종합하면"));
  const lead = LEADS.find((l) => body.includes(`!! **${l}** 가볍게 새 자리로 첫발을 내디뎌도 좋은 때이고, 익숙한 조건에 묶인 자리에서 풀려날 수 있는 모양이에요.`)); // 전환 문장만 굵게
  assert.ok(lead, body);
  const iMid = body.indexOf("!! **그동안"), iMerge = body.indexOf(D.merge["C1>D"]), iChange = body.indexOf(lead!), iKey = body.indexOf("같아요");
  assert.ok(iMid > 0 && iMid < iMerge && iMerge < iChange && iChange < iKey, body);
  // 같은 결과는 다시 열어도 같은 전환 문장
  assert.equal(body, worryPageBody({ name: "도현", oldPage1: "", reading: "읽기.", frame: { options: ["이직하기", "더 다니기"] }, lean, picks, copy: { ...copy, change_leads: LEADS }, frameTitle: "x", mid: D, domain: "CAR" }));
});

test("전환 문장 후보: 여러 개·'예언/운명/반드시'를 쓰지 않음('예측'은 owner 허용 2026-11-02)", () => {
  assert.ok(LEADS.length >= 4);
  for (const l of LEADS) { assert.ok(/요\.$|다\.$/.test(l), l); assert.ok(!/예언|반드시|분명히|운명/.test(l), l); }
});
