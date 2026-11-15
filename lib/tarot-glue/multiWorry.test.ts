import test from "node:test";
import assert from "node:assert/strict";
import { multiFor, checkChoice, MULTI_DB } from "./multiWorry.ts";
import { composeFocus, applyFocus, focusLine, multiQuestion } from "../tarot/multiWorry.js";

const two = "수능 잘 볼 수 있을까요? 연애도 할 수 있을까요?";

test("여러 고민: 두 묶음 이상 + 묻는 말이면 묻는다", () => {
  const d = multiFor(two, { urgent: false, locale: "ko" });
  assert.ok(d);
  assert.deepEqual(d!.options.map((o) => o.key), ["work", "love"]);
  const q = multiQuestion(d!, MULTI_DB, "해달");
  assert.equal(q!.options.at(-1)!.id, "linked");
  assert.ok(q!.small.includes("해달님"));
});

test("여러 고민: 위기·영문·한 가지 고민은 묻지 않는다", () => {
  assert.equal(multiFor(two, { urgent: true, locale: "ko" }), null);
  assert.equal(multiFor(two, { urgent: false, locale: "en" }), null);
  assert.equal(multiFor("남자친구랑 다시 만날 수 있을까요?", { urgent: false, locale: "ko" }), null);
});

test("여러 고민: 선택 id 검사 — 선택지·linked만", () => {
  const d = multiFor(two, { urgent: false, locale: "ko" });
  assert.equal(checkChoice(d, "love"), "love");
  assert.equal(checkChoice(d, "linked"), "linked");
  assert.equal(checkChoice(d, "money"), null);
  assert.equal(checkChoice(d, 3), null);
  assert.equal(checkChoice(null, "love"), null);
});

test("여러 고민: 고른 고민을 AI 글에 붙이고 3쪽 첫 줄을 만든다", () => {
  const d = multiFor(two, { urgent: false, locale: "ko" })!;
  assert.ok(composeFocus(two, "love", d, MULTI_DB).endsWith("(고른 고민: 연애)"));
  const f = applyFocus({ area: null }, d, "love", MULTI_DB);
  assert.equal(f.focus.how, "picked");
  assert.ok(focusLine(f.focus, MULTI_DB)!.includes("‘연애’"));
  const n = applyFocus({ area: "EDU" }, d, null, MULTI_DB);
  assert.equal(n.focus.how, "not_asked");
  assert.ok(focusLine(n.focus, MULTI_DB)!.includes("중심으로"));
  assert.equal(focusLine(applyFocus({}, d, "linked", MULTI_DB).focus, MULTI_DB), null);
});

test("여러 고민: 3쪽 첫 줄이 고민 읽기 문장보다 먼저 나온다", async () => {
  const { worryPageBody } = await import("./secretThird.ts");
  const body = worryPageBody({
    name: "해달", oldPage1: "", reading: "고민을 읽었어요.", frame: {} as never, lean: null as never, picks: [], frameTitle: "x",
    copy: { worry_title: "{name}님의 고민 풀어보기", general: "답은 아직.", two_title: "t", same: "", split: "" } as never,
    focus: "적어 주신 고민 중 ‘연애’ 고민으로 카드를 읽었어요.",
  });
  const i = body.indexOf("‘연애’"), j = body.indexOf("고민을 읽었어요");
  assert.ok(i >= 0 && j > i);
});
