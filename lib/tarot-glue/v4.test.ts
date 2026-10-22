import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { paceTeaser, CHAT_HEAD, PLAN_MOVED_HEAD, changeParts, tidyDirection, decide, buildCUserBlock, buildDUserBlock, buildEUserBlock, buildUnpaidPages, buildPaidPages, sanitizeUnpaid, sanitizePaid } from "./v4.ts";
import { parseStoryApply } from "../tarot/assembleReport.js";
import { parseE } from "../tarot/validateV4.js";
import { runCase } from "../tarot/fixtures/runCase.mjs";
import { picksFromSlots, createShuffle } from "../tarot/deck.js";
import { parseFrame, parseC } from "../tarot/validateV4.js";
import { screenText, mergeSafety } from "../tarot/safety.js";

const data = JSON.parse(fs.readFileSync(new URL("../../data/tarot_data.json", import.meta.url), "utf8"));
const FX = new URL("../tarot/fixtures/도현/", import.meta.url);
const readJ = (f: string) => JSON.parse(fs.readFileSync(new URL(f, FX), "utf8"));
const cs = readJ("case.json");
const sh = createShuffle(data);
cs.picks.forEach((p: { id: string; reversed: boolean }) => (sh.reversed[p.id] = p.reversed));
const picks = picksFromSlots(sh, cs.picks.map((p: { id: string }) => sh.order.indexOf(p.id)), data);
const { frame } = parseFrame(readJ("A2_out.json"));
const safety = mergeSafety(screenText(cs.worry, data.safety_keywords), cs.ai);

test("도현님(이직 결정형): 방향이 '현재 회사에 남기'로 계산된다", () => {
  const d = decide({ frame, cls: cs.ai, picks, name: cs.name });
  assert.equal(d.decision, true);
  assert.equal(d.lean?.option, "현재 회사에 남기");
  assert.equal(d.lean?.side, "stay");
});

test("고민 틀이 없으면 비결정형", () => {
  assert.deepEqual(decide({ frame: null, cls: cs.ai, picks, name: cs.name }), { decision: false, lean: null, review_log: null, lowered: false });
});

test("v4.1: 고민 틀 v4.6(options_ranked·mode)도 같은 방향, 폭력 확인이면 방향을 끈다", () => {
  const f46 = parseFrame(readJ("A2_out_v46.json")).frame;
  const d = decide({ frame: f46, cls: cs.ai, picks, name: cs.name });
  assert.equal(d.decision, true);
  assert.equal(d.lean?.side, "stay");
  assert.equal(d.lean?.mode, "axis");
  assert.equal(decide({ frame: f46, cls: cs.ai, picks, name: cs.name, safety: { violence: true } }).decision, false);
});

test("v4.1 두 번째 의견: 비슷한 정답들의 표가 다르고 비율 ≥ 0.6이면 강도만 한 단계 낮추고 검수 기록을 남긴다", () => {
  const base = decide({ frame, cls: cs.ai, picks, name: cs.name });
  const same = decide({ frame, cls: cs.ai, picks, name: cs.name, vote: { table: frame.table, share: 1, top_score: 0.5 } });
  assert.equal(same.lean?.strength, base.lean?.strength);
  assert.equal(same.review_log, null);
  const other = decide({ frame, cls: cs.ai, picks, name: cs.name, vote: { table: "start", share: 0.8, top_score: 0.5 } });
  assert.equal(other.lean?.side, base.lean?.side); // 쪽·선택지는 그대로
  assert.equal(other.lean?.option, base.lean?.option);
  const LOWER: Record<string, string> = { strong: "clear", clear: "slight", slight: "slight" };
  assert.equal(other.lean?.strength, LOWER[base.lean!.strength]);
  assert.equal(other.review_log?.sim_table, "start");
  // 비율이 낮으면 강도는 그대로, 기록만
  const weak = decide({ frame, cls: cs.ai, picks, name: cs.name, vote: { table: "start", share: 0.4, top_score: 0.5 } });
  assert.equal(weak.lean?.strength, base.lean?.strength);
  assert.equal(weak.lowered, false);
  assert.equal(weak.review_log?.below_min_share, true);
});

test("v4.1 주의(watch): 결제 전 응답에도 마지막 쪽 109 안내 한 줄(fineprint)이 실린다", () => {
  const watch = { level: "watch" as const, violence: false, fear: false };
  const { lean } = decide({ frame, cls: cs.ai, picks, name: cs.name });
  const pages = sanitizeUnpaid(buildUnpaidPages({ name: cs.name, cls: cs.ai, picks, safety: watch, worryText: cs.worry, frame, lean, C: null }));
  const last = pages[pages.length - 1];
  assert.match(String(last.fineprint), /109/);
  assert.equal(pages.filter((p) => p.fineprint).length, 1);
  const none = sanitizeUnpaid(buildUnpaidPages({ name: cs.name, cls: cs.ai, picks, safety, worryText: cs.worry, frame, lean, C: null }));
  assert.equal(none.some((p) => p.fineprint), false);
});

test("C 입력에 고민 틀과 방향이 들어가고, 미작성이면 null", () => {
  const { lean } = decide({ frame, cls: cs.ai, picks, name: cs.name });
  const block = buildCUserBlock({ name: cs.name, worryText: cs.worry, cls: cs.ai, picks, frame, lean })!;
  assert.match(block, /worry_frame=\{/);
  assert.match(block, /direction_lean=\{"decision":true,"side":"stay","option":"현재 회사에 남기"/);
  assert.ok(block.trim().endsWith("</user_data>"));
  assert.equal(buildCUserBlock({ name: cs.name, worryText: null, cls: null, picks, frame: null, lean: null }), null);
});

test("결제 전 응답에는 결론과 유료 본문이 없다", () => {
  const { decision, lean } = decide({ frame, cls: cs.ai, picks, name: cs.name });
  const C = parseC(readJ("C_out.json"), { decision, strength: lean?.strength, frame, lean, violence: safety.violence });
  const raw = buildUnpaidPages({ name: cs.name, cls: cs.ai, picks, safety, worryText: cs.worry, frame, lean, C });
  assert.equal(raw.length, 11);
  assert.ok(raw[4].locked, "원본 5쪽에는 locked(결론)가 들어 있음 — 그래서 거르는 함수가 필요");
  const out = sanitizeUnpaid(raw);
  const text = JSON.stringify(out);
  assert.ok(!("locked" in out[4]) && !("combo" in out[4]) && !("map" in out[4]));
  assert.ok(!text.includes("세 장을 합치면"), "결론 문장이 새면 안 됨");
  assert.ok(!text.includes("C_out") && !text.includes("[[읽기 지도"), "읽기 지도(점수)는 결제 전에 안 보냄");
  assert.equal(out[4].body, null);
  for (const p of out.slice(5)) assert.equal(p.body, null);
  assert.ok(out[4].free.startsWith("## "), "5쪽 무료 부분(teaser)은 남음");
  assert.ok(out[1].body && out[1].card.name);
});

test("고민 미작성(분류·틀·C 없음)도 9쪽이 끊기지 않는다(8쪽 숨김·실천/쏘웰라 합침 뒤)", () => {
  const out = sanitizeUnpaid(buildUnpaidPages({ name: "지수", cls: null, picks, safety: { level: "none", violence: false, fear: false }, worryText: "", frame: null, lean: null, C: null }));
  assert.equal(out.length, 9);
  assert.ok(out[0].body && out[4].free);
});


// ---------- 결제 후(D·E) ----------
test("결제 후 11쪽 = 패키지 예시 흐름(runCase)과 같은 결과 — 도현님 D·E 출력으로", () => {
  const tables = JSON.parse(fs.readFileSync(new URL("../../data/decision_tables.json", import.meta.url), "utf8"));
  const ref = runCase(fileURLToPath(new URL(".", FX)), data, tables);
  const { lean } = decide({ frame, cls: cs.ai, picks, name: cs.name });
  const C = parseC(readJ("C_out.json"), { decision: true, strength: lean?.strength ?? null, frame, lean, violence: safety.violence });
  const sa = parseStoryApply(readJ("D_out.json"), { violence: safety.violence });
  const E = parseE(readJ("E_out.json"), { lean, frame, violence: safety.violence }).E;
  const P = buildPaidPages({ name: cs.name, cls: cs.ai, picks, safety, worryText: cs.worry, frame, lean, C, sa, E });
  assert.equal(P.length, 11);
  assert.deepEqual(P.map((p: { body?: string }) => p.body), ref.paid.map((p: { body?: string }) => p.body));
  // 응답에는 본문이 실리고(결론 포함) 내부 칸(combo·map·locked)은 빠진다
  const out = sanitizePaid(P);
  assert.ok(out[4].body && /세 장을 합치면 ‘현재 회사에 남기’ 쪽/.test(String(out[4].body)));
  for (const p of out) for (const k of ["combo", "map", "locked"]) assert.equal(k in p, false);
});

test("D·E가 없거나 탈락해도(대체 경로) 결제 후 9쪽이 모두 본문을 가진다(8쪽 숨김·합침 뒤)", () => {
  const P = sanitizePaid(buildPaidPages({ name: cs.name, cls: cs.ai, picks, safety, worryText: cs.worry, frame, lean: null, C: null, sa: null, E: null }));
  assert.equal(P.length, 9);
  for (const p of P) assert.ok(p.body, `${p.page}쪽 본문 있음`);
});

test("D 입력: 안전 칸·고민 틀·방향 포함 / E 입력: 5·6쪽 글(already_shown) 포함 / 미작성이면 null", () => {
  const { lean } = decide({ frame, cls: cs.ai, picks, name: cs.name });
  const d = buildDUserBlock({ name: cs.name, worryText: cs.worry, cls: cs.ai, picks, frame, lean, safety })!;
  assert.match(d, /crisis_level=/);
  assert.match(d, /violence_flag=false/);
  assert.match(d, /worry_frame=\{/);
  assert.match(d, /"option":"현재 회사에 남기"/);
  const e = buildEUserBlock({ name: cs.name, worryText: cs.worry, cls: cs.ai, picks, frame, lean, alreadyShown: "5쪽 글\n\n6쪽 글" })!;
  assert.match(e, /already_shown="""5쪽 글\n\n6쪽 글"""/);
  assert.match(e, /direction_lean=\{/);
  assert.equal(buildDUserBlock({ name: cs.name, worryText: null, cls: cs.ai, picks, frame, lean, safety }), null);
  assert.equal(buildEUserBlock({ name: cs.name, worryText: "", cls: cs.ai, picks, frame, lean, alreadyShown: "" }), null);
});

test("7쪽 예고는 풀리는 속도에 따라 바뀌고, 방향(선택지 이름)은 드러내지 않는다", () => {
  assert.equal(paceTeaser("near"), "카드는 앞으로 이 고민이 해결된다고 말해요, 이유는 다음과 같아요");
  assert.equal(paceTeaser("step"), "카드는 앞으로 충분히 승산이 있다고 말해요, 이유는 다음과 같아요");
  assert.equal(paceTeaser("slow"), "카드는 앞으로 시간은 걸려도 가능하다고 말해요, 이유는 다음과 같아요");
  const { lean } = decide({ frame, cls: cs.ai, picks, name: cs.name });
  const P = sanitizeUnpaid(buildUnpaidPages({ name: cs.name, cls: cs.ai, picks, safety, worryText: cs.worry, frame, lean, C: null }));
  const t7 = String(P[6].teaser);
  assert.match(t7, /^카드는 앞으로 .+고 말해요, 이유는 다음과 같아요$/);
  assert.doesNotMatch(t7, /현재 회사에 남기|이직 제안 수락/);
});

test("화면으로 보내는 글에서 선택지 표시 '(암시)'를 뗀다", () => {
  const pages = [{ page: 6, title: "내 고민에 대어 보면", body: "소송을 하지 않는 것 (암시)보다 회사에 소송을 하는 것 쪽을 가리켜요." }];
  assert.equal(sanitizePaid(pages)[0].body, "소송을 하지 않는 것보다 회사에 소송을 하는 것 쪽을 가리켜요.");
  const un = sanitizeUnpaid([{ page: 1, title: "t", body: "선택지: 이직하기 / 남기 (암시)" }]);
  assert.equal(un[0].body, "선택지: 이직하기 / 남기");
});

test("8쪽은 숨기고 실천 카드·쏘웰라 쪽을 합쳐 9쪽으로 보낸다(owner 2026-10-22)", () => {
  const { lean } = decide({ frame, cls: cs.ai, picks, name: cs.name });
  const paid = sanitizePaid(buildPaidPages({ name: cs.name, cls: cs.ai, picks, safety, worryText: cs.worry, frame, lean, C: null, sa: null, E: readJ("E_out.json") }));
  assert.equal(paid.length, 9);
  assert.deepEqual(paid.map((p) => p.page), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(!paid.some((p) => p.title === "앞으로 이렇게 바뀔 거예요"));
  assert.equal(paid[7].title, "변화를 위해 지금 할 수 있는 것");
  assert.equal(paid[8].title, "이번 주 실천 카드");
  assert.ok(!JSON.stringify(paid[8]).includes("9쪽 처방"));
  const unpaid = sanitizeUnpaid(buildUnpaidPages({ name: cs.name, cls: cs.ai, picks, safety, worryText: cs.worry, frame, lean, C: null }));
  assert.equal(unpaid.length, 9);
  assert.equal(unpaid[8].title, "이번 주 실천 카드");
  const last = String(paid[8].body);
  assert.ok(last.includes("[쏘웰라 3일 무료로 시작하기]") && last.indexOf(CHAT_HEAD) > last.indexOf("• 오늘"), "실천 카드 뒤에 쏘웰라 안내·버튼");
  assert.ok(!/해 보면서[^\n]*쏘웰라와 이어서 이야기해 볼 수 있/.test(last), "겹치는 문장 뺌");
});

test("예전 8쪽의 변화(한 줄 요약·신호 3개)는 처방 쪽 맨 위로 옮긴다(owner 2026-10-22)", () => {
  const { lean } = decide({ frame, cls: cs.ai, picks, name: cs.name });
  const raw = buildPaidPages({ name: cs.name, cls: cs.ai, picks, safety, worryText: cs.worry, frame, lean, C: null, sa: null, E: readJ("E_out.json") });
  const parts = changeParts(raw.find((p) => p.page === 8).body);
  assert.ok(parts.head && parts.signs.length === 3);
  const P = sanitizePaid(raw);
  assert.equal(P[7].title, "변화를 위해 지금 할 수 있는 것");
  const rx = String(P[7].body);
  assert.ok(rx.startsWith(`**${parts.head}**`), "맨 위에 한 줄 요약");
  assert.ok(parts.signs.every((x) => rx.includes(x)) && rx.includes("이런 변화가 보일 거예요"));
  assert.ok(!String(P[6].body).includes(parts.head!) && !String(P[8].body).includes(parts.signs[0]), "7쪽·실천 카드 쪽에는 없음");
});

test("7쪽 다듬기: 자리 이름 + 카드 이름 → 'N 번째 카드인 ‘이름’', 조금 더 앞에 '다만'", () => {
  const name = data.cards[0].name;
  assert.equal(tidyDirection(`앞으로의 열쇠인 ${name}은 뜻입니다.`), `세 번째 카드인 ‘${name}’은 뜻입니다.`);
  assert.equal(tidyDirection(`지나온 길 ‘${name}’이 보여 줘요.`), `첫 번째 카드인 ‘${name}’이 보여 줘요.`);
  assert.equal(tidyDirection("**세 장은 ‘회사에 소송을 하는 것’ 쪽입니다.** 조금 더 신중히 준비해야 해요."), "**세 장은 ‘회사에 소송을 하는 것’ 쪽입니다.** 다만 조금 더 신중히 준비해야 해요.");
  assert.equal(tidyDirection("가장 큰 근거는 앞으로의 열쇠입니다."), "가장 큰 근거는 앞으로의 열쇠입니다.");
});

test("7쪽 '이번 주에 이것부터' 계획은 실천 카드 쪽 맨 위로 옮기고 머리말을 바꾼다(owner 2026-10-22)", () => {
  const { lean } = decide({ frame, cls: cs.ai, picks, name: cs.name });
  const P = sanitizePaid(buildPaidPages({ name: cs.name, cls: cs.ai, picks, safety, worryText: cs.worry, frame, lean, C: null, sa: null, E: readJ("E_out.json") }));
  assert.ok(!/이번 주에 이것부터/.test(String(P[6].body)), "7쪽에 계획 없음");
  const p9 = String(P[8].body);
  const at = p9.indexOf(PLAN_MOVED_HEAD);
  assert.ok(at > 0 && at < p9.indexOf("• 오늘"), "실천 카드 위");
  assert.ok(p9.includes("◦ 언제: 이번 주 금요일 퇴근 후"));
});
