import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { parseBlocks, parseInline, splitHeadline, splitTeaser, type Block } from "./pageBlocks.ts";
import { resultParseOpts } from "../tarot-glue/v4.ts";
import { runCase } from "../tarot/fixtures/runCase.mjs";

const data = JSON.parse(fs.readFileSync(new URL("../../data/tarot_data.json", import.meta.url), "utf8"));
const tables = JSON.parse(fs.readFileSync(new URL("../../data/decision_tables.json", import.meta.url), "utf8"));
const r = runCase(fileURLToPath(new URL("../tarot/fixtures/도현/", import.meta.url)), data, tables);
const O = resultParseOpts();
const page = (n: number) => r.paid.find((p: { page: number }) => p.page === n);
const types = (b: Block[]) => b.map((x) => x.type);

test("굵게: 짝이 맞는 **만, 짝이 안 맞으면 글자 그대로", () => {
  assert.deepEqual(parseInline("**가나** 다라"), [{ text: "가나", bold: true }, { text: " 다라", bold: false }]);
  assert.deepEqual(parseInline("가 ** 나"), [{ text: "가 ** 나", bold: false }]);
});

test("메인 문구는 첫 쉼표 뒤에서 줄바꿈(시안과 같음)", () => {
  assert.deepEqual(splitHeadline("회사일까 일일까, 세 장이 답했어요"), ["회사일까 일일까,", "세 장이 답했어요"]);
  assert.deepEqual(splitHeadline("쉼표 없음"), ["쉼표 없음"]);
  // 메인 문구 틀의 이음말에서 자동 줄바꿈(owner 2026-10-21)
  assert.deepEqual(splitHeadline("여러 갈래로 흩어지는 힘을 지나 한 가지만 지키는 여유로"), ["여러 갈래로 흩어지는 힘을 지나", "한 가지만 지키는 여유로"]);
  assert.deepEqual(splitHeadline("익숙한 고민에서 내 목소리를 듣는 쪽으로"), ["익숙한 고민에서", "내 목소리를 듣는 쪽으로"]);
  assert.deepEqual(splitHeadline("지금은 버티는 힘, 다음은 쉬는 법"), ["지금은 버티는 힘,", "다음은 쉬는 법"]);
  assert.deepEqual(splitHeadline("집에서 쉬기"), ["집에서 쉬기"]); // 뒤가 너무 짧으면 그대로
});

test("1쪽: 카드 줄·고민 틀 상자·카드별 미니·키워드", () => {
  const b = parseBlocks(page(1).body, O);
  assert.equal(b[0].type, "strip");
  assert.deepEqual(types(b).slice(1, 5), ["p", "p", "sum", "list"]);
  const minis = b.filter((x) => x.type === "mini");
  assert.equal(minis.length, 3);
  assert.deepEqual(minis[0], { type: "mini", position: "지나온 길", name: "고요한 균형", character: "백조", reversed: true });
  assert.equal(b.filter((x) => x.type === "kw").length, 3);
  const kw = b.find((x) => x.type === "kw");
  assert.deepEqual(kw && kw.type === "kw" && kw.tags, ["치우침", "자기 비난", "따지기", "결론 서두름"]);
});

test("5쪽(결제 후): 메인 문구·소제목·요약·읽기 지도·곱씹기 질문", () => {
  const b = parseBlocks(page(5).body, O);
  assert.deepEqual(types(b), ["headline", "p", "sub", "list", "sum", "sum", "sub", "map", "p", "p", "sec", "list"]);
  const m = b.find((x) => x.type === "map");
  assert.ok(m && m.type === "map");
  assert.deepEqual(m.cells.map((c) => [c.position, c.name, c.reversed, c.dir]), [
    ["지나온 길", "고요한 균형", true, "down"],
    ["지금의 흐름", "고요히 바라보기", false, "flat"],
    ["앞으로의 열쇠", "물과 뭍 사이", false, "flat"],
  ]);
});

test("7쪽: 방향 블록·결정 질문·계획 머리말이 소제목", () => {
  const b = parseBlocks(page(7).body, O);
  const subs = b.filter((x) => x.type === "sub").map((x) => (x as { text: string }).text);
  assert.deepEqual(subs, ["카드가 가리키는 방향", "이렇게 결정해 볼까요?", "남는 쪽으로 정했다면, 이번 주에 이것부터"]);
  assert.equal(b[0].type, "sum");
});

test("9·10쪽: 다리 문장 + 처방/실천 항목(제목 + 다음 줄)", () => {
  const b9 = parseBlocks(page(9).body, O);
  assert.deepEqual(types(b9), ["headline", "p", "p", "bridge", "item", "bridge", "item"]);
  const it = b9[4];
  assert.ok(it.type === "item" && it.title === "회사와 일을 나눠 적기" && it.body && it.body[0].bold);
  const b10 = parseBlocks(page(10).body, O);
  assert.deepEqual(types(b10), ["p", "item", "item", "item", "p"]);
});

test("11쪽: 버튼 줄", () => {
  const b = parseBlocks(page(11).body, O);
  assert.deepEqual(b[b.length - 1], { type: "button", text: "쏘웰라 3일 무료로 시작하기" });
});

test("관계형 계획 머리말(선택지 이름이 들어감)도 소제목", () => {
  const b = parseBlocks("‘다시 연락하기’ 쪽으로 정했다면, 이번 주에 이것부터\n◦ 언제: 오늘", O);
  assert.deepEqual(types(b), ["sub", "list"]);
});

test("※ 작은 글씨, 빈 값", () => {
  assert.deepEqual(parseBlocks("※ 점수 차이가 작아요", O), [{ type: "fine", text: "점수 차이가 작아요" }]);
  assert.deepEqual(parseBlocks(null, O), []);
});

test("잠긴 쪽 예고는 쉼표나 ' — ' 뒤에서 나눈다", () => {
  assert.deepEqual(splitTeaser("카드로 본 나의 성향과, 그동안의 고민을 실제 장면에 대어 본 분석"), ["카드로 본 나의 성향과,", "그동안의 고민을 실제 장면에 대어 본 분석"]);
  assert.deepEqual(splitTeaser("오늘 / 3일 안에 / 이번 주 — 처방을 옮긴 작은 실천 3장"), ["오늘 / 3일 안에 / 이번 주", "처방을 옮긴 작은 실천 3장"]);
  assert.deepEqual(splitTeaser("앞의 분석에서 바로 이어지는 웰니스 처방 두 가지"), ["앞의 분석에서 바로 이어지는 웰니스 처방 두 가지"]);
  assert.deepEqual(splitTeaser("오늘 바로, 3일 안에, 이번 주 안에 — 내가 해 볼 작은 실천 세 장"), ["오늘 바로, 3일 안에, 이번 주 안에", "내가 해 볼 작은 실천 세 장"]);
});
