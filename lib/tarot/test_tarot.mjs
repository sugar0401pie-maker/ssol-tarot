// 실행: node test_tarot.mjs   (Node 18+, 외부 패키지 없음) — v3.0
// v4.1 변경: watch 다시 사용(CSO 2026-10-22) · 점수표 10개(express·boundary) · A2 v4.6(mode axis/rank) · retrieve·두 번째 의견 — 맨 아래 'v4.1' 묶음
// v4.0 변경: ① 주의(watch) 단계 삭제(S2)에 맞춰 안전 테스트 수정(데이터의 expected_keyword_level 'watch'는 none으로 읽음)
//   ② v3.3 '역방향이면 역방향 설명만'에 맞춰 카드 설명 테스트 수정 ③ 맨 아래 'v4.0' 묶음 새로(방향 계산·말투·11쪽·검증·안전)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { shortlist, displayOrder, assignPositions, validateClassification } from "./selectCards.js";
import { screenText, mergeSafety, filterPractices } from "./safety.js";
import { headlineLines, buildPages, composeTop, validateHeadline, validateLead, buildStoryUserBlock, buildLinkUserBlock, validateStory, validateApply, weekPlan,
  parseLinks, parseStoryApply, comboScore, comboReading, reasonLines, readingOf, readingSentence, overlap, OVERLAP_MAX, ASK_FORM } from "./assembleReport.js";
import { EURO_RO, EUL_REUL, I_GA } from "./josa.js";
import { validate } from "./validateReport.js";
import { shuffleDeck, createShuffle, pickSlot, picksFromSlots, loadingText, drawOrientation } from "./deck.js";
import { initialState, next } from "./flow.js";
import { lean, pickTable, reasonFallback, secondOpinion, applySecondOpinion, isDecisionFrame, optionPair } from "./decision.js";
import { buildIndex, nearest, voteTable, findSimilar, setRetriever, grams } from "./retrieve.js";
import { buildFrameUserBlock, prepareFrameCall, afterFrame } from "./frameInput.js";
import { nextScreenFor, watchNoteFor } from "./safety.js";
import { toFormal, toInformal, kind, splitSentences, balance, countKinds, boldFirstLines } from "./endings.js";
import { buildPagesV4, teaserFallback, planHead, PLAN_HEADS, PLAN_HEAD_RE, SUBHEADS } from "./pagesV4.js";
import { parseFrame, parseC, parseE, v10Hits } from "./validateV4.js";
import { buildSafetyNotice, FEAR_BOX_DEFAULT } from "./assembleReport.js";
import { runCase } from "./fixtures/runCase.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(here, "../../data/tarot_data.json"), "utf8"));
const seeded = (seed) => { let a = seed >>> 0; return (n) => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n); }; };
let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("PASS", name); };

t("카드 22장·번호·ID 고유", () => {
  assert.equal(data.cards.length, 22);
  assert.equal(new Set(data.cards.map((c) => c.id)).size, 22);
  assert.deepEqual(data.cards.map((c) => c.no), [...Array(22).keys()]);
});

t("카드마다 위치 해석 3개·실천 3개·이론 2개 이상·매칭 코드 유효", () => {
  const D = new Set(data.domains.map((x) => x.code)), E = new Set(data.emotions.map((x) => x.code)), N = new Set(data.needs.map((x) => x.code));
  for (const c of data.cards) {
    ["now", "hold", "step"].forEach((k) => assert.ok(c.positions[k].length > 20, `${c.name} ${k}`));
    assert.equal(c.practices.length, 3, c.name);
    assert.ok(c.theories.length >= 2, c.name);
    c.match.needs.forEach((x) => assert.ok(N.has(x), x));
    c.match.emotions.forEach((x) => assert.ok(E.has(x), x));
    c.match.domains.forEach((x) => assert.ok(D.has(x), x));
  }
});

t("필요 6개 각각 맞는 카드가 4장 이상", () => {
  for (const n of data.needs) assert.ok(data.cards.filter((c) => c.match.needs.includes(n.code)).length >= 4, n.code);
});

t("분류 검증: 잘못된 입력 거부", () => {
  assert.ok(validateClassification({ domain: "XXX", emotions: ["ANX"], need: "REST" }, data).length > 0);
  assert.ok(validateClassification({ domain: "CAR", emotions: [], need: "REST" }, data).length > 0);
  assert.ok(validateClassification({ domain: "CAR", emotions: ["ANX", "ANX"], need: "REST" }, data).length > 0);
  assert.equal(validateClassification({ domain: "CAR", emotions: ["ANX", "TIR"], need: "REST" }, data).length, 0);
});

// 가능한 모든 분류 조합: 영역 6 × 감정(단일 8 + 순서쌍 56) × 필요 6 = 2,304가지
const combos = [];
for (const d of data.domains) for (const n of data.needs) for (const e1 of data.emotions) {
  combos.push({ domain: d.code, emotions: [e1.code], need: n.code });
  for (const e2 of data.emotions) if (e2.code !== e1.code) combos.push({ domain: d.code, emotions: [e1.code, e2.code], need: n.code });
}
const freq = Object.fromEntries(data.cards.map((c) => [c.name, 0]));

t(`[보류 모드] 전 조합(${combos.length}가지) 후보 7장·정렬·결정론`, () => {
  for (const cls of combos) {
    const a = shortlist(cls, data), b = shortlist(cls, data);
    assert.equal(a.length, 7);
    assert.deepEqual(a, b);
    for (let i = 1; i < a.length; i++) assert.ok(a[i - 1].score > a[i].score || (a[i - 1].score === a[i].score && a[i - 1].no < a[i].no));
    assert.ok(a[0].score >= 3, "맨 앞 카드는 최소한 필요가 맞아야 함");
    a.forEach((x) => freq[data.cards[x.no].name]++);
  }
});

t("[보류 모드] 모든 카드가 어떤 조합에서든 후보에 등장", () => {
  Object.entries(freq).forEach(([k, v]) => assert.ok(v > 0, k));
});

t("화면 배치 순서: 같은 세션이면 같은 순서, 순열 유지", () => {
  const sl = shortlist({ domain: "LOV", emotions: ["HUR", "LON"], need: "CONNECT" }, data);
  const a = displayOrder(sl, "session-123"), b = displayOrder(sl, "session-123");
  assert.deepEqual(a, b);
  assert.deepEqual(a.map((x) => x.id).sort(), sl.map((x) => x.id).sort());
});

t("위치 배정: 3장·중복·후보 외 카드 거부", () => {
  const sl = shortlist({ domain: "CAR", emotions: ["TIR"], need: "REST" }, data).map((x) => x.id);
  const p = assignPositions(sl.slice(0, 3), sl, data);
  assert.deepEqual(p.map((x) => x.position), ["now", "hold", "step"]);
  assert.throws(() => assignPositions(sl.slice(0, 2), sl, data));
  assert.throws(() => assignPositions([sl[0], sl[0], sl[1]], sl, data));
  const outside = data.cards.find((c) => !sl.includes(c.id)).id;
  assert.throws(() => assignPositions([sl[0], sl[1], outside], sl, data));
});

t("안전 확인: 위기·폭력 신호 (v4.1: watch 다시 사용)", () => {
  assert.equal(screenText("요즘 그냥 죽고 싶 다는 생각이 들어요").level, "urgent");
  assert.equal(screenText("너무 힘들어서 아무것도 못하겠어요").level, "none", "v4.1: 넓은 '힘들다' 표현은 키워드로 잡지 않음(AI가 맡음)");
  assert.equal(screenText("이직할지 고민이에요").level, "none");
  assert.equal(screenText("자살 생각이 들어요").level, "urgent");
  assert.equal(screenText("혼자 살기 시작했어요").level, "none", "띄어쓰기 제거로 생기는 '자살' 오탐 방지");
  assert.equal(screenText("여자 해외여행 혼자 가도 될까요").level, "none", "'자해' 오탐 방지");
  assert.equal(screenText("남자친구가 휴대폰을 검사하고 못 만나게 해요").violence, true);
  const m = mergeSafety(screenText("이직 고민"), { crisis_level: "watch", violence: false });
  assert.equal(m.level, "watch", "v4.1: AI의 watch를 따름");
  assert.equal(mergeSafety(screenText("사라지고 싶어요"), { crisis_level: "none" }).level, "watch", "키워드 watch도 낮추지 않음");
  assert.equal(mergeSafety(screenText("사라지고 싶어요"), { crisis_level: "urgent" }).level, "urgent");
  const m2 = mergeSafety(screenText("죽고싶어요"), { crisis_level: "none", violence: false });
  assert.equal(m2.level, "urgent", "AI가 낮게 봐도 높은 쪽을 따름");
});

t("폭력 신호 시 다가가기 실천 제외", () => {
  const card = data.cards.find((c) => c.id === "swim_together");
  assert.equal(filterPractices(card, { violence: false }).length, 3);
  assert.equal(filterPractices(card, { violence: true }).length, 1);
});

t("조사 처리(ㄹ받침 '로' 포함)", () => {
  assert.equal("다시 빛나는 별" + EURO_RO("다시 빛나는 별"), "다시 빛나는 별로");
  assert.equal("나를 지키는 선" + EURO_RO("나를 지키는 선"), "나를 지키는 선으로");
  assert.equal("시작할 용기" + EURO_RO("시작할 용기"), "시작할 용기로");
  assert.equal("2.1" + EURO_RO("2.1"), "2.1로");
  assert.equal("첫 물장구" + EUL_REUL("첫 물장구"), "첫 물장구를");
  assert.equal("서운함" + I_GA("서운함"), "서운함이");
});


// ---- v1.1 카드 뽑기: 22장 무작위 셔플 + 직접 3장 ----

t("셔플: 22장 전부 한 번씩, 시드 주입 시 재현 가능", () => {
  const a = shuffleDeck(data, seeded(7)), b = shuffleDeck(data, seeded(7));
  assert.equal(a.length, 22);
  assert.deepEqual(a.slice().sort(), data.cards.map((c) => c.id).sort());
  assert.deepEqual(a, b);
});

t("다시 섞기: 매번 새 shuffleId와 새 순서(crypto)", () => {
  const s1 = createShuffle(data), s2 = createShuffle(data);
  assert.notEqual(s1.shuffleId, s2.shuffleId);
  assert.notDeepEqual(s1.order, s2.order);
});

t("셔플 고르기: 22,000회에서 첫 자리 카드 분포가 고르다(각 1,000±250)", () => {
  const cnt = {};
  for (let i = 0; i < 22000; i++) { const o = shuffleDeck(data); cnt[o[0]] = (cnt[o[0]] || 0) + 1; }
  Object.values(cnt).forEach((v) => assert.ok(v > 750 && v < 1250, String(v)));
  assert.equal(Object.keys(cnt).length, 22);
});

t("직접 뽑기: 뽑은 순서대로 위치 배정, 중복·범위 밖·4장째 거부", () => {
  const sh = createShuffle(data, { rng: seeded(3), idFn: () => "s1" });
  const p1 = pickSlot(sh, [], 5, data), p2 = pickSlot(sh, [5], 0, data), p3 = pickSlot(sh, [5, 0], 21, data);
  assert.deepEqual([p1.position, p2.position, p3.position], ["now", "hold", "step"]);
  assert.equal(p1.card.id, sh.order[5]);
  assert.equal(p3.isLast, true);
  assert.throws(() => pickSlot(sh, [5], 5, data));
  assert.throws(() => pickSlot(sh, [], 22, data));
  assert.throws(() => pickSlot(sh, [1, 2, 3], 4, data));
  assert.equal(picksFromSlots(sh, [5, 0, 21], data).length, 3);
  assert.throws(() => picksFromSlots(sh, [5, 0], data));
});

t("대기 문구", () => {
  assert.equal(loadingText(data, "지수", 3), "지수님의 타로 결과를 분석하고 있어요... (3초 경과)");
});


// ---- v1.2 시작 흐름: 환영(닉네임) → 경험 질문 → (처음 안내) → 고민 쓰기(건너뛰기 가능) ----
t("흐름: 경험자 + 고민 작성", () => {
  let s = initialState();
  s = next(s, { type: "START" }, data);
  assert.equal(next(s, { type: "SUBMIT_NICKNAME", nickname: "  " }, data).error, data.copy.welcome.empty_error);
  s = next(s, { type: "SUBMIT_NICKNAME", nickname: "지수" }, data);
  assert.equal(s.screen, "experience");
  s = next(s, { type: "CHOOSE_EXPERIENCE", value: "returning" }, data);
  assert.equal(s.screen, "worry");
  assert.ok(next(s, { type: "SUBMIT_WORRY", text: "짧음" }, data).error);
  s = next(s, { type: "SUBMIT_WORRY", text: "요즘 연락이 뜸해서 서운해요" }, data);
  assert.equal(s.screen, "shuffle");
  s = next(s, { type: "RESHUFFLE" }, data); assert.equal(s.screen, "shuffle");
  s = next(s, { type: "PICK_NOW" }, data);
  for (let i = 0; i < 3; i++) s = next(s, { type: "PICK" }, data);
  assert.equal(s.screen, "reveal");
  assert.throws(() => next(s, { type: "PICK" }, data));
  assert.equal(next(s, { type: "SEE_RESULT", ready: false }, data).screen, "loading");
  assert.equal(next(s, { type: "SEE_RESULT", ready: true }, data).screen, "result");
});

t("흐름: 처음 → 안내 → 고민 건너뛰기 → 셔플", () => {
  let s = next(next(initialState(), { type: "START" }, data), { type: "SUBMIT_NICKNAME", nickname: "민준" }, data);
  s = next(s, { type: "CHOOSE_EXPERIENCE", value: "first" }, data);
  assert.equal(s.screen, "first_time");
  s = next(s, { type: "FIRST_TIME_OK" }, data);
  assert.equal(s.screen, "worry");
  s = next(s, { type: "SKIP_WORRY" }, data);
  assert.equal(s.screen, "shuffle"); assert.equal(s.worrySkipped, true); assert.equal(s.worryText, null);
});

t("흐름: 위기 신호면 안전 안내로(제출 직후·셔플 도중)", () => {
  let s = next(next(next(initialState(), { type: "START" }, data), { type: "SUBMIT_NICKNAME", nickname: "a" }, data), { type: "CHOOSE_EXPERIENCE", value: "returning" }, data);
  assert.equal(next(s, { type: "SUBMIT_WORRY", text: "요즘 그냥 죽고 싶다는 생각이 들어요", localUrgent: true }, data).screen, "safety");
  s = next(s, { type: "SUBMIT_WORRY", text: "요즘 많이 지치고 힘들어요" }, data);
  assert.equal(next(s, { type: "AI_URGENT" }, data).screen, "safety");
});


const LV = (l) => l; // v4.1: watch 다시 사용 — 데이터의 기대값 그대로(v4.0에서는 watch를 none으로 읽었음)
// ---- v1.3 고민 예시 60개: 라벨 유효성 + 서버 키워드 기대값 ----
const ex = JSON.parse(fs.readFileSync(path.join(here, "../../data/worry_examples.json"), "utf8")).examples;
t("고민 예시: 60개, 영역 6개 각 8개 이상, 라벨 코드 유효", () => {
  assert.equal(ex.length, 60);
  for (const d of data.domains) assert.ok(ex.filter((x) => x.domain === d.code).length >= 8, d.code);
  for (const x of ex) assert.equal(validateClassification({ domain: x.domain, emotions: x.emotions, need: x.need }, data).length, 0, x.id);
  assert.equal(ex.filter((x) => x.fewshot).length, 10);
});

t("고민 예시: 서버 키워드 확인 결과가 기대값과 같다(오탐·미탐 사례 포함)", () => {
  for (const x of ex) {
    const r = screenText(x.text);
    assert.equal(r.level, LV(x.expected_keyword_level), `${x.id} ${x.text}`);
    if (x.id !== "SAFE-04") assert.equal(r.violence, false, x.id);
  }
  assert.equal(screenText(ex.find((x) => x.id === "SAFE-04").text).violence, true);
});


t("v2.5 안전 키워드 사전(data.safety_keywords)으로도 기존 판정·오탐 방지가 유지됨", () => {
  const kw = data.safety_keywords;
  assert.equal(screenText("요즘 그냥 죽고 싶 다는 생각이 들어요", kw).level, "urgent");
  assert.equal(screenText("혼자 살기 시작했어요", kw).level, "none");
  assert.equal(screenText("여자 해외여행 혼자 가도 될까요", kw).level, "none");
  assert.equal(screenText("남자친구가 휴대폰을 검사하고 못 만나게 해요", kw).violence, true);
  assert.equal(screenText("다 끝내고 싶다는 생각이 자꾸 들어요", kw).level, "watch", "v4.1: 소극적 표현은 watch");
  assert.equal(screenText("이직 고민이 있어요", { ...kw, exclude: ["이직"] }).level, "none");
  for (const x of ex) assert.equal(screenText(x.text, kw).level, LV(x.expected_keyword_level), `${x.id} ${x.text}`);
});


// ════ v3.0 과거–현재–미래 · 분석(2~7쪽)/제안(8~9쪽) 분리 ════
const byNo = Object.fromEntries(data.cards.map((c) => [c.no, c]));
const POS = data.positions.map((p) => [p.code, p.name]);
const mk = (spec) => spec.map(([no, r], i) => ({ card: byNo[no], reversed: !!r, position: POS[i][0], positionName: POS[i][1] }));
const BANNED = ["반드시", "분명히", "절대", "해결될 거예요", "안 될 거예요", "하게 될 거예요", "{", "}", "undefined", "머금", "데우", "데워"];
const SUGGEST = /(해 ?보세요|하세요|보세요|해 보면 좋|해 봐요|적어 ?보|정해 ?보|시작해 보|만들어 보|골라 ?보|나눠 ?보|도 좋아요|도 좋습니다|도 괜찮아요|도 괜찮습니다|도 돼요)/;
const sides = (c) => [["up", c], ["rev", c.reversed]];

t("v3.0 자리: 지나온 길 · 지금의 흐름 · 앞으로의 열쇠, 자리마다 답하는 질문", () => {
  assert.deepEqual(data.positions.map((p) => p.name), ["지나온 길", "지금의 흐름", "앞으로의 열쇠"]);
  data.positions.forEach((p) => assert.ok(p.question.endsWith("?"), p.code));
});

t("v3.0 자리 해석 132: 두 문장, 지나온 길=그동안 / 지금의 흐름=지금 / 앞으로의 열쇠=앞으로, 카드 정의 문장 없음", () => {
  for (const c of data.cards) for (const [o, s] of sides(c)) {
    const P = s.positions;
    ["now", "hold", "step"].forEach((k) => {
      const n = (P[k].match(/[.?!](?=\s|$)/g) || []).length;
      assert.equal(n, 2, `${c.no}${o}${k} ${P[k]}`);
      assert.ok(!/뜻하는 카드|상징하는 카드/.test(P[k]) && !BANNED.some((w) => P[k].includes(w)), `${c.no}${o}${k}`);
    });
    assert.ok(P.now.startsWith("그동안"), `${c.no}${o} now`);
    assert.ok(P.hold.startsWith("지금"), `${c.no}${o} hold`);
    assert.ok(P.step.startsWith("앞으로"), `${c.no}${o} step`);
    assert.ok(!SUGGEST.test(P.now + P.hold), `${c.no}${o} 과거·현재 해석에 제안 없음`);
  }
});

t("v3.0 곱씹어 볼 질문 132: 자리별 모양(ASK_FORM)", () => {
  for (const c of data.cards) for (const [o, s] of sides(c)) ["now", "hold", "step"].forEach((k) => assert.ok(ASK_FORM[k].test(s.asks_pos[k]), `${c.no}${o}${k} ${s.asks_pos[k]}`));
});

t("v3.0 1쪽 카드 뜻(개요 44)은 설명만 — 제안 문장 없음", () => {
  for (const c of data.cards) for (const [o, s] of sides(c)) {
    const second = s.basic.overview.split(/(?<=[요다]\.)\s/).slice(1).join(" ");
    assert.ok(second && !SUGGEST.test(second), `${c.no}${o} ${second}`);
  }
});

t("v3.0 조합 문장(분석)에는 제안이 없고 빈칸·금지어도 없음", () => {
  const C = data.combo;
  for (const k of ["story_p1", "key_vs_present", "key_vs_past"]) assert.equal(Object.keys(C[k]).length, 36, k);
  assert.equal(Object.keys(C.apply_fallback).length, 42);
  Object.values(C.apply_fallback).forEach((x) => assert.ok(x.includes("예를 들어") && x.length >= 220, "v3.1 6쪽 대체 문단은 예시 장면 포함"));
  Object.values(C.key_vs_present).forEach((x) => assert.ok(x.startsWith("앞으로의 열쇠는 지금의 흐름과"), x));
  Object.values(C.key_vs_past).forEach((x) => assert.ok(x.startsWith("지나온 길과 견주면"), x));
  const signs = data.cards.flatMap((c) => [...c.signs, ...c.reversed.signs]);
  assert.equal(signs.length, 132);
  const all = [...Object.values(C.story_p1), ...Object.values(C.key_vs_present), ...Object.values(C.key_vs_past), ...Object.values(C.apply_fallback), ...signs,
    ...Object.values(C.story_head), ...Object.values(C.apply_head), ...Object.values(C.tone), ...Object.values(C.pace).map((p) => p.body), ...Object.values(C.reasons)];
  all.forEach((x) => assert.ok(!SUGGEST.test(x) && !BANNED.filter((w) => !"{}".includes(w)).some((w) => x.includes(w)), x));
  for (const k of ["phase", "obstacle", "apply_by_phase", "pattern", "stage", "link12", "link23", "slowdown"]) assert.ok(!(k in C), `v3.0에서 뺀 ${k}`);
});

t("v3.0 처방·실천 88세트: 카드×방향마다 열쇠 처방(today·week)과 속도 처방(three)이 짝", () => {
  for (const c of data.cards) for (const [o, s] of sides(c)) {
    const d = s.direct;
    for (const k of ["key_rx", "slow_rx"]) assert.ok(d[k].title && d[k].how && d[k].why, `${c.no}${o}${k}`);
    assert.ok(/^[1-5]분$/.test(d.today.time) && d.week.time === "이번 주" && /^(10|15|20)분$/.test(d.three.time), `${c.no}${o} time`);
    assert.ok(d.slow_short.length >= 4 && !/[을를이가은는에로]$/.test(d.slow_short), `${c.no}${o} ${d.slow_short}`);
    const txt = JSON.stringify(d);
    assert.ok(!/연락|다가가|마음을 전해/.test(txt), `${c.no}${o} 혼자 하는 행동만`);
  }
});

t("v3.0 넘겨 보기 10쪽: 제목·무료 범위·카드 쪽 구성(정보 상자·질문·굵은 답)", () => {
  const picks = mk([[12], [4, 1], [3]]);
  const cls = { domain: "CAR", emotions: ["TIR", "ANX"], need: "REST" };
  const U = buildPages({ name: "민준", cls, picks, data }), P = buildPages({ name: "민준", cls, picks, data, paid: true });
  assert.deepEqual(P.map((p) => p.title), data.copy.result.pages.filter((p) => p.key !== "change").map((p) => p.title), "v4: 데이터는 11쪽 기준, buildPages(10쪽)는 key로 찾음");
  assert.equal(P[7].title, "지금 해볼 수 있는 것들을 알려드릴게요"); // 2026-10-21 owner 결정으로 제목 변경(옛: 그래서, 이렇게 해 보세요)
  assert.deepEqual(U.map((p) => p.access), ["무료", "무료", "무료", "무료", "일부 무료", "유료", "유료", "유료", "유료", "유료"]);
  U.slice(5).forEach((p) => assert.equal(p.body, null, `${p.page}쪽은 결제 전 내용 없음`));
  [1, 2, 3].forEach((i) => {
    const pg = P[i], p = picks[i - 1];
    assert.equal(pg.question, data.positions[i - 1].question);
    assert.deepEqual(pg.card.keywords, (p.reversed ? p.card.reversed : p.card).basic.keywords);
    assert.ok(pg.card.arcana && pg.body.startsWith("**"), "굵은 첫 문장 = 질문의 답");
    assert.ok(!pg.body.includes(p.card.core) && !pg.body.includes((p.reversed ? p.card.reversed : p.card).basic.overview), "카드 뜻은 1쪽에서만");
  });
  assert.ok(P[0].body.includes(data.copy.result.spread_intro));
  assert.ok(!U[4].free.includes("◦") && U[4].locked.includes(data.copy.result.reflect_title));
  assert.equal(P[3].next, data.copy.top.cta_button); assert.equal(P[9].next, null); assert.equal(P[0].back, null);
});

t("v3.0 분석 쪽(2~7)에는 제안 없음, 제안은 8·9쪽에만 — 전 조합 표본", () => {
  let n = 0;
  for (let a = 0; a < 22; a += 2) for (let b = 1; b < 22; b += 3) for (let c = 2; c < 22; c += 4) {
    if (a === b || b === c || a === c) continue;
    for (const rv of [[0, 0, 0], [1, 1, 0], [0, 1, 1]]) {
      const picks = mk([[a, rv[0]], [b, rv[1]], [c, rv[2]]]);
      for (const cls of [null, { domain: "LOV", emotions: ["ANX"], need: "CONNECT", qtype: "yesno" }]) {
        const P = buildPages({ name: "하늘", cls, picks, data, paid: true });
        P.slice(1, 7).forEach((pg) => {
          const body = (pg.body || "").replace(/\*\*/g, "");
          // 앞으로의 열쇠 해석의 '마음을 두세요'(관점)는 허용, 행동 지시는 금지
          assert.ok(!SUGGEST.test(body.replace(/마음을 두세요/g, "")), `${pg.page}쪽 ${a},${b},${c}: ${body.match(SUGGEST)}`);
          assert.ok(!/[{}]|undefined/.test(body), `${pg.page}쪽 빈칸`);
        });
        assert.ok(P[7].body.includes("▸ 앞으로의 열쇠") && P[7].body.includes("▸ 지금의 흐름에서 본"));
        assert.ok(P[4].body.includes("[[읽기 지도") && P[6].body.includes(data.copy.result.flow_titles.key), "v3.2 읽기 지도는 5쪽, 열쇠는 7쪽");
        n++;
      }
    }
  }
  assert.ok(n > 1000, String(n));
});

t("v3.1 분석→제안 직접 연결: 3쪽 지금의 흐름 → 8쪽 처방 ②, 4쪽 열쇠 → 처방 ①, 9쪽 실천 = 처방의 작은 판, 7쪽 신호 = 열쇠 카드", () => {
  const picks = mk([[12], [4, 1], [3]]);
  const P = buildPages({ name: "민준", cls: null, picks, data, paid: true });
  const h = picks[1].card.reversed, k = picks[2].card;
  assert.ok(P[7].body.includes(`지금의 흐름에서 본 ‘${h.direct.slow_short}’`) && P[7].body.includes(h.direct.slow_rx.title));
  assert.ok(P[7].body.includes(`앞으로의 열쇠 ‘${k.frag.step}’`) && P[7].body.includes(k.direct.key_rx.title));
  const w = weekPlan(picks);
  assert.deepEqual([w.today, w.three, w.week], [k.direct.today, h.direct.three, k.direct.week]);
  assert.ok(P[8].body.includes(`• 오늘: ${k.direct.today.title}`) && P[8].body.includes(`• 3일 안에: ${h.direct.three.title}`));
  assert.ok(k.signs.every((x) => P[6].body.includes(x)) && !P[6].body.includes("속도를 늦출 수 있는 것"));
  assert.ok(P[4].map && P[4].map.cards.length === 3 && P[4].body.includes("[[읽기 지도") && !P[6].body.includes("[[읽기 지도"));
  assert.deepEqual(P[4].map.cards.map((c) => c.force), ["down", "down", "up"]);
  assert.equal(new Set(P[4].map.cards.map((c) => c.label)).size, 3, "v3.2 힘 표현이 자리마다 다름");
  assert.ok(!P[4].body.includes("같은 성격"));
  assert.ok(P[5].body.includes(data.copy.result.tendency_title) && P[5].body.includes(picks[0].card.tendency.split(".")[0]));
  assert.ok(P[6].body.includes(data.combo.key_vs_present[`${picks[1].card.match.needs[0]}_${picks[2].card.match.needs[0]}`]));
  assert.deepEqual(P[2].says, [picks[1].card.reversed.basic.desc], "v3.3 역방향이면 역방향 설명만");
  assert.deepEqual(P[1].says, [picks[0].card.basic.desc]);
});

t("v3.0 해결의 흐름: 점수 근거 코드 → '이렇게 읽은 이유'(조사 맞춤), 질문형이면 _q (v4: watch여도 점수대로·이유 표시)", () => {
  assert.equal(comboScore({ picks: mk([[6], [15, 1], [0]]), data }).pace, "near");
  assert.equal(comboScore({ picks: mk([[18, 1], [13], [16, 1]]), data }).pace, "slow");
  const r = comboScore({ picks: mk([[12], [4, 1], [3]]), data, cls: { domain: "CAR", need: "REST", emotions: ["TIR"] }, worryText: "요즘 계속 야근이라 지쳐요" });
  assert.ok(!r.parts.some(([c]) => c === "chronic") && r.parts.every(([c]) => c in data.combo.reasons));
  const lines = reasonLines(r, data);
  assert.ok(lines.length <= 3 && lines.every((x) => !/[{}]/.test(x)));
  assert.ok(lines.some((x) => x.includes("‘바위 위의 쉼’은")) || lines.some((x) => x.includes("‘품어 주는 품’이")), lines.join(" / "));
  const picks = mk([[6], [15, 1], [0]]);
  const wch = comboReading({ picks, data, safety: { level: "watch", violence: false } }).parts.flow;
  assert.ok(!wch.includes(data.combo.pace.watch.title) && wch.includes(data.copy.result.flow_titles.reasons), "v4 S2 삭제");
  const q = comboReading({ picks, data, cls: { domain: "LOV", emotions: ["ANX"], need: "CONNECT", qtype: "yesno" } });
  assert.equal(q.paceKey, "near_q");
});

t("v3.0 AI 검증: C 질문 모양·제안형 거부, D 분석만, 동어반복 줄 생략", () => {
  const ok = { headline: "버텨 온 시간을 지나, 나를 채우는 쪽으로", lead: "민준님의 세 장은 버텨 온 시간이 지금의 지침으로 이어지고 있다고 말해요.",
    now: { line: "주말에도 회의 생각이 떠오를 만큼 쉬는 시간을 일에 내어 왔을 수 있어요.", ask: "그동안 쉬는 날에도 일을 손에서 놓지 못해 오지 않았나요?" },
    hold: { line: "맡긴 일까지 다시 손보느라 쉬어도 개운하지 않은 날이 이어지고 있어요.", ask: "혹시 지금 맡긴 일까지 다시 손보고 있지는 않나요?" },
    step: { line: "팀을 챙기던 손길이 나에게도 향하는지가 이 고민의 열쇠예요.", ask: "앞으로 팀을 먼저 챙기는 쪽과 나도 함께 챙기는 쪽 중 어느 쪽에 더 마음을 두고 싶나요?" } };
  const L = parseLinks(ok);
  assert.ok(L.headline && L.lead && L.now.ask && L.hold.ask && L.step.ask);
  assert.equal(parseLinks({ ...ok, step: { ...ok.step, line: "이번 주에는 나를 위한 10분을 정해 보세요." } }), null, "분석 쪽 한 줄에 제안 금지");
  assert.equal(parseLinks({ ...ok, now: { ...ok.now, ask: "지금, 쉬지 못하고 있진 않나요?" } }).now.ask, null, "예전 질문 모양은 거부");
  assert.equal(parseLinks(JSON.stringify(ok)).now.line, ok.now.line);
  const story = "그동안 팀을 지키느라 쉬는 시간까지 내어 주며 버텨 왔을 수 있어요. 그 방식이 쌓여, 지금은 맡긴 일까지 다시 손봐야 안심이 되는 마음이 쉼을 막고 있습니다.\n\n앞으로의 열쇠는 앞의 두 장과 돌봄이라는 점에서 겹쳐요. 다만 팀에게만 향하던 손길이 나에게도 향한다는 점이 달라서, 버티는 힘이 채우는 힘으로 바뀔 수 있어요.";
  assert.ok(validateStory(story));
  assert.equal(validateStory(story.replace("\n\n", " ")), null, "v3.1 한 문단이면 거부");
  assert.equal(validateStory(story.replace("있어요.", "있으니 오늘은 10분 쉬어 보세요.")), null);
  const apply = "주말에도 월요일 회의가 먼저 떠오른다고 적어 주셨죠. 예를 들어 일요일 저녁에 쉬려고 누워서도 월요일 회의 안건을 머릿속으로 다시 정리하는 순간이 있었을 수 있어요. 그동안은 쉬는 시간까지 일에 내어 주며 버텨 왔을 수 있어요. 지금은 그 방식이 굳어져, 팀원에게 맡긴 보고서도 밤에 다시 열어 고치게 됩니다. 앞으로의 열쇠는 일을 더 잘 해내는 것보다, 팀을 챙기는 만큼 내 끼니와 잠도 챙길 수 있는지에 있어요.";
  assert.ok(validateApply(apply));
  assert.equal(validateApply(apply.replace("예를 들어 ", "")), null, "v3.1 예시 장면 없으면 거부");
  assert.equal(parseStoryApply({ story, apply: apply.replace("있어요.", "있어요. 이번 주에는 할 일을 나눠 보면 좋겠어요.") }).apply, null);
  const picks = mk([[12], [4, 1], [3]]);
  const copy = { ...ok, now: { ...ok.now, line: readingOf(picks[0]).split(/(?<=[요다]\.)\s/)[0] } };
  assert.ok(overlap(copy.now.line, readingOf(picks[0])) > OVERLAP_MAX);
  const P = buildPages({ name: "민준", cls: { domain: "CAR", emotions: ["TIR"], need: "REST" }, picks, data, links: parseLinks(copy) || { now: copy.now, hold: ok.hold, step: ok.step } });
  assert.equal(P[1].body.split("\n").filter((x) => x.trim()).length, 1, "해석을 베낀 AI 줄은 생략");
  assert.ok(P[2].body.includes(ok.hold.line));
});

t("v3.0 AI 입력: 자리 이름·질문·카드 뜻·이 자리의 해석, self_focus·qsub 전달, 미작성이면 호출 안 함", () => {
  const picks = mk([[12], [4, 1], [3]]);
  const b = buildLinkUserBlock({ name: "a", worryText: "자존감이 너무 낮아요", cls: { domain: "DIR", emotions: ["SHA"], need: "LETGO", self_focus: true }, picks, data });
  assert.ok(b.includes("[now] 지나온 길(") && b.includes("[step] 앞으로의 열쇠(") && b.includes("이 자리의 해석:") && b.includes("self_focus=true") && b.includes("방향: 역방향"));
  assert.equal(buildLinkUserBlock({ name: "a", worryText: null, cls: null, picks, data }), null);
  assert.equal(buildStoryUserBlock({ name: "a", worryText: null, cls: null, picks, data, safety: { level: "none", violence: false } }), null);
  const P = buildPages({ name: "민준", cls: null, picks, data, paid: true });
  assert.ok(P[0].body.includes("마음속으로 떠올린 고민") && P[5].body.includes(data.combo.apply_fallback[`NONE_${picks[2].card.match.needs[0]}`]));
});

t("v3.0 메인 문구·첫 줄: 조각 조립(모든 표본 조합에서 자리표시자 없음), 줄바꿈", () => {
  for (let a = 0; a < 22; a += 3) for (let b = 1; b < 22; b += 4) for (let c = 2; c < 22; c += 5) {
    if (a === b || b === c || a === c) continue;
    const top = composeTop({ name: "하늘", picks: mk([[a], [b, 1], [c]]), data });
    assert.ok(!/[{}]|undefined/.test(top.headline + top.lead) && top.lead.includes("하늘"), top.headline);
  }
  assert.deepEqual(headlineLines("버텨 온 시간을 지나, 나를 채우는 쪽으로"), ["버텨 온 시간을 지나,", "나를 채우는 쪽으로"]);
  assert.equal(validateHeadline("반드시 좋아질 거예요."), null);
  assert.equal(validateLead("두 문장이에요. 안 돼요."), null);
});

t("나 자신 고민은 '나 자신과 삶의 방향에 대한 고민'으로 읽힌다", () => {
  assert.ok(readingSentence({ name: "하늘", cls: { domain: "DIR", emotions: ["SHA"], need: "LETGO", self_focus: true }, data }).includes("나 자신과 삶의 방향에 대한 고민으로 읽혔어요"));
  assert.ok(readingSentence({ name: "하늘", cls: { domain: "DIR", emotions: ["CON"], need: "CHOOSE" }, data }).includes("진로와 자기계발에 대한 고민으로 읽혔어요"));
});


t("v2.11 연애 세부 유형: 38개 코드·되묻기 문장 규칙, 분류 검증·AI 입력", () => {
  const Q = data.love_qsub;
  assert.equal(Q.length, 38);
  for (const q of Q) {
    assert.ok(q.reframe.includes("{name}") && !/반드시|분명히|절대|될 거예요|해결될|안 될/.test(q.reframe), q.code);
    assert.ok(["other_mind", "timing", "yesno", "fortune"].includes(q.qtype));
  }
  const cls = { domain: "LOV", emotions: ["ANX"], need: "CONNECT", qtype: "other_mind", qsub: "OM-REPLY" };
  assert.deepEqual(validateClassification({ ...cls }, data), []);
  const bad = { ...cls, qsub: "XX-NONE" }; validateClassification(bad, data); assert.equal(bad.qsub, null);
  const sh = createShuffle(data, seeded(5)), picks = picksFromSlots(sh, [0, 1, 2], data);
  const block = buildLinkUserBlock({ name: "하늘", worryText: "읽씹당했어요", cls, picks, data });
  assert.ok(block.includes("qsub=읽씹·답장 속도·단답의 의미") && block.includes("reframe_hint=") && block.includes("하늘님") && !block.includes("{name}"));
});

// ── v2.10 판별 DB 회귀: 키워드가 위기 아닌 글에서 카드를 멈추지 않음 ──
const JDB = path.join(here, "../../judge-db");
if (fs.existsSync(JDB)) {
  const jl = (f) => fs.readFileSync(path.join(JDB, f), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  t("v2.10 판별 DB: 위기 아닌 고민·일상 문장에서 키워드가 카드를 멈추지 않음", () => {
    const rows = [...jl("eval/T1_worry_new.jsonl"), ...jl("data/ssol_need_examples.jsonl")].filter((x) => (x.crisis_level || "none") === "none");
    const stop = rows.filter((x) => screenText(x.text, data.safety_keywords).level === "urgent");
    assert.equal(stop.length, 0, stop.map((x) => x.text).join(" / "));
  });
  t("v2.11 판별 DB: 연애 세부 유형마다 예시 10개 이상", () => {
    const rows = jl("data/worry_examples_v2.jsonl"), cnt = {};
    rows.forEach((x) => { if (x.qsub) cnt[x.qsub] = (cnt[x.qsub] || 0) + 1; });
    for (const q of data.love_qsub) assert.ok((cnt[q.code] || 0) >= 10, `${q.code} ${cnt[q.code] || 0}`);
    assert.ok(rows.every((x) => !x.qsub || data.love_qsub.some((q) => q.code === x.qsub)));
  });
  t("v2.10 판별 DB: 대표 간접 위기·통제 표현은 키워드로도 잡힘(v4.1: 소극적 표현은 watch)", () => {
    for (const s of ["그냥 아침에 안 깨어났으면 좋겠어요", "저 같은 건 없는 게 다들 편할 거예요", "헤어지고 나니까 살아 있을 이유를 모르겠어"])
      assert.equal(screenText(s, data.safety_keywords).level, "watch", s);
    for (const s of ["헤어지자고 하니까 집 앞에 매일 와요", "카톡을 다 보여 달래요"])
      assert.ok(screenText(s, data.safety_keywords).violence, s);
    // 2026-10-22 CSO: 벽·책상 치기, 물건 던지기는 폭력 확인이 아니라 두려움(안내 박스 + 방향 계산)
    for (const s of ["남친이 화나면 벽을 쳐요", "팀장이 화나면 서류를 던지고 책상을 내리쳐요"]) {
      const r = screenText(s, data.safety_keywords); assert.ok(!r.violence && r.fear, s);
    }
    // 생활비·돈 관리 방식은 부부·연인 사이의 합의일 수 있어 안전 판정을 하지 않음(일반 고민)
    for (const s of ["남편이 생활비를 정해서 주고 영수증을 하나하나 확인해요", "월급을 남편이 다 관리하고 만 원 쓸 때도 허락받아요"]) {
      const r = screenText(s, data.safety_keywords); assert.ok(!r.violence && !r.fear, s);
    }
    assert.equal(screenText("발표 망쳐서 사라지고 싶을 만큼 창피했어요ㅋㅋ", data.safety_keywords).level, "none");
  });
}

const exDir = path.join(here, "../../docs/spec/example-reports/보류_전체AI생성");
if (fs.existsSync(exDir)) {
  for (const f of fs.readdirSync(exDir).filter((x) => x.endsWith("-ai.md"))) {
    t(`[보류] 전체 AI 생성 예시 검증: ${f}`, () => {
      const r = validate(fs.readFileSync(path.join(exDir, f), "utf8"), { violence: f.includes("violence") });
      assert.ok(r.ok, r.results.filter((x) => !x.ok).map((x) => `${x.name}: ${x.detail}`).join(" / "));
    });
  }
}


// ════════ v4.0 결정형 방향 제시 · 11쪽 · 말투 50:50 · 검증 · 안전(S2 삭제·S4 쪼갬) ════════
const tables = JSON.parse(fs.readFileSync(path.join(here, "../../data/decision_tables.json"), "utf8"));
const FX = path.join(here, "fixtures/도현");
const fxJ = (f) => (x => JSON.parse(x.slice(x.indexOf("{"), x.lastIndexOf("}") + 1)))(fs.readFileSync(path.join(FX, f), "utf8"));
const DH = runCase(FX, data, tables);
const dhFrame = parseFrame(fxJ("A2_out.json")).frame;
const pk = (spec) => spec.map(([no, r]) => ({ no, reversed: !!r }));

t("v4 lean: 도현(job, 고요한 균형 역 · 고요히 바라보기 · 물과 뭍 사이) → stay · strong · −4, 선택지 이름은 option_axis에서", () => {
  const L = lean({ picks: pk([[11, 1], [2], [14]]), type: "job", tables, name: "도현", frame: dhFrame });
  assert.equal(L.side, "stay"); assert.equal(L.strength, "strong"); assert.equal(L.score, -4);
  assert.equal(L.option, "현재 회사에 남기", "' (암시)' 지움"); assert.equal(L.with_condition, true, "물과 뭍 사이 = reshape");
  assert.deepEqual(L.cards.map((c) => [c.position, c.score, c.weight]), [["지나온 길", -1, 1], ["지금의 흐름", -1, 1], ["앞으로의 열쇠", -1, 2]]);
  assert.ok(L.cards.every((c) => c.meaning.length > 5)); assert.equal(L.small_note, undefined);
  assert.deepEqual(DH.lean.cards, L.cards, "buildPages picks 형태로도 같은 결과");
  assert.equal(lean({ picks: pk([[11, 1], [2], [14]]), type: "job", tables }).option, tables.types.job.stay, "frame 없으면 표의 기본 이름");
});

t("v4 lean: 합이 0이면 움직이는 쪽(slight), 강도 경계 3 · 1.5", () => {
  const T = tables.types.job.scores, keys = Object.keys(T);
  let zero = null, clear = null;
  for (const a of keys) for (const b of keys) for (const c of keys) {
    const [na, nb, nc] = [a, b, c].map((k) => +k.split("_")[0]);
    if (na === nb || nb === nc || na === nc) continue;
    const sum = T[a][0] + T[b][0] + 2 * T[c][0];
    const spec = [a, b, c].map((k) => [+k.split("_")[0], k.endsWith("rev")]);
    if (sum === 0 && !zero) zero = spec;
    if (sum === -2 && !clear) clear = spec;
  }
  const Z = lean({ picks: pk(zero), type: "job", tables });
  assert.equal(Z.score, 0); assert.equal(Z.side, "move"); assert.equal(Z.strength, "slight");
  const Cl = lean({ picks: pk(clear), type: "job", tables });
  assert.equal(Cl.side, "stay"); assert.equal(Cl.strength, "clear");
});

t("v4.1 점수표 10개(act 없음): 44칸, 0 없음, 표마다 + 카드 26개(R6), poles·implicit", () => {
  assert.deepEqual(Object.keys(tables.types), ["approach", "reunion", "progress", "continue", "newlove", "job", "start", "move", "express", "boundary"]);
  assert.ok(!("act" in tables.types) && tables.version.startsWith("v3") && tables.types.start.label === "시작·실행(한다/안 한다)");
  assert.deepEqual(tables.types.express.implicit, ["먼저 말을 꺼내기", "말을 아끼고 지켜보기"]);
  assert.deepEqual(tables.types.boundary.implicit, ["거절하고 선 긋기", "지금처럼 맞춰 주기"]);
  for (const tb of Object.values(tables.types)) assert.ok(tb.poles.plus && tb.poles.minus && tb.implicit.length === 2 && tb.label, tb.label);
  for (const [k, tb] of Object.entries(tables.types)) {
    const v = Object.values(tb.scores);
    assert.equal(v.length, 44, k);
    assert.ok(v.every(([s, m]) => [-2, -1, 1, 2].includes(s) && m), k);
    assert.equal(v.filter(([s]) => s > 0).length, 26, k);
    assert.ok(tb.move && tb.stay, k);
  }
  for (const c of data.cards) for (const o of ["up", "rev"]) assert.ok(tables.stance[`${c.no}_${o}`], `${c.no}_${o} stance`);
});

t("v4 pickTable: frame.table → qsub_map → 커리어 등은 frame.table만 → 없으면 null", () => {
  assert.equal(pickTable({ frame: dhFrame, cls: DH.cs.ai, tables }), "job");
  assert.equal(pickTable({ frame: { ...dhFrame, table: null }, cls: DH.cs.ai, tables }), null, "CAR는 영역만으로 짐작하지 않음");
  assert.equal(pickTable({ frame: { ...dhFrame, table: null }, cls: { domain: "LOV", qsub: "OM-REPLY" }, tables }), "approach");
  assert.equal(pickTable({ frame: null, cls: { domain: "LOV", qsub: "YN-REUNION" }, tables }), "reunion");
  // 2026-10-22 CSO: 연애 고민은 방향 없음 금지 — 지난 관계 돌아보기 → 재회, 이별 회복 → 새 인연, 내 감정 확인 → 지속
  assert.equal(pickTable({ frame: null, cls: { domain: "LOV", qsub: "OM-MYFEEL" }, tables }), "continue");
  assert.equal(pickTable({ frame: null, cls: { domain: "LOV", qsub: "OM-EXWHY" }, tables }), "reunion");
  assert.equal(pickTable({ frame: null, cls: { domain: "LOV", qsub: "TM-HEAL" }, tables }), "newlove");
  assert.equal(pickTable({ frame: { table: "nope" }, cls: { qsub: "YN-CONFESS" }, tables }), "progress", "틀린 table 이름은 무시");
  assert.equal(pickTable({ frame: null, cls: null, tables }), null);
});

t("v4 reasonFallback: 받침에 맞는 '이라/라', 쪽 이름", () => {
  assert.equal(reasonFallback("판단이 치우친 상태", "stay"), "판단이 치우친 상태라, 머무는 쪽을 가리켜요.");
  assert.equal(reasonFallback("한 걸음 내딛는 마음", "move"), "한 걸음 내딛는 마음이라, 움직이는 쪽을 가리켜요.");
});

t("v4 말투 변환(endings.js): 니다↔요, 권유·의문은 그대로", () => {
  assert.equal(toFormal("마음이 좋아요."), "마음이 좋습니다.");
  assert.equal(toFormal("그렇게 될 거예요."), "그렇게 될 겁니다.", "EXTRA_F가 먼저");
  assert.equal(toFormal("쪽을 가리켜요."), "쪽을 가리킵니다.");
  assert.equal(toFormal("길이 보여요."), "길이 보입니다.");
  assert.equal(toFormal("말이 길어요."), null, "ㄹ 받침 불규칙은 못 바꿈");
  assert.equal(toInformal("답을 미뤄 왔습니다."), "답을 미뤄 왔어요.");
  assert.equal(toInformal("조율의 카드입니다."), "조율의 카드예요.");
  assert.equal(toInformal("그 장면이 열쇠입니다."), "그 장면이 열쇠예요.");
  assert.equal(toInformal("작은 마음입니다."), "작은 마음이에요.");
  assert.equal(toInformal("다시 봅니다."), "다시 봐요.");
  assert.equal(toInformal("이렇게 바뀝니다."), "이렇게 바뀌어요.");
  assert.equal(kind("적어 보세요."), null); assert.equal(kind("해 볼까요."), null);
  assert.equal(kind("**합니다.**"), "f"); assert.equal(kind("해요."), "i");
  assert.deepEqual(splitSentences("첫 문장이에요. 둘째입니다! 셋째?"), ["첫 문장이에요. ", "둘째입니다! ", "셋째?"]);
  assert.deepEqual(splitSentences("**굵은 첫 문장이에요.** 다음이에요."), ["**굵은 첫 문장이에요.** ", "다음이에요."]);
  assert.deepEqual(boldFirstLines(["한 문장이에요. 두 문장입니다.", "◦ 목록이에요. 그대로예요.", "한 문장뿐이에요."]), ["**한 문장이에요.** 두 문장입니다.", "◦ 목록이에요. 그대로예요.", "한 문장뿐이에요."]);
});

t("v4 balance: 쪽마다 ~니다/~요 번갈아 50:50, seed 홀짝으로 시작이 바뀜, 제목·질문·권유는 그대로", () => {
  const L = ["## 제목이에요", "카드가 말해요. 마음이 보여요. 길이 있어요. 흐름이 달라요.", "이 질문을 곱씹어 볼까요?", "◦ 지금 해 보세요.", "끝이에요. 다음이 있어요."];
  const even = balance(L, 2), odd = balance(L, 3);
  assert.equal(even[0], L[0]); assert.equal(even[2], L[2]); assert.equal(even[3], L[3]);
  const ke = countKinds(even.join("\n")), ko = countKinds(odd.join("\n"));
  assert.deepEqual(ke, { f: 3, i: 3 }); assert.deepEqual(ko, { f: 3, i: 3 });
  assert.ok(even[1].startsWith("카드가 말합니다.") && odd[1].startsWith("카드가 말해요."));
  const all = DH.paid.map((p) => p.body || "").join("\n"), k = countKinds(all);
  assert.ok(Math.abs(k.f - k.i) / (k.f + k.i) < 0.1, `도현 전체 ${JSON.stringify(k)}`);
});

t("v4 buildPagesV4(도현) = 시안 pages_5차.json과 본문이 같음(결제 전·후 11쪽, 결제 전 8·10쪽 블러만 v4 데이터로 갱신)", () => {
  const exp = fxJ("expected_pages_5차.json");
  for (const key of ["paid", "unpaid"]) {
    assert.equal(DH[key].length, 11, key);
    exp[key].forEach((w, i) => { const g = DH[key][i];
      for (const f of ["page", "title", "access", "body", "free", "locked", "says", "teaser", "blur", "next", "back", "question"])
        assert.deepEqual(g[f] ?? null, w[f] ?? null, `${key} ${w.page}쪽 ${f}`);
    });
  }
  const p = DH.paid;
  assert.ok(p[0].body.includes("◦ 선택지: 이직 제안 수락 / 현재 회사에 남기") && !p[0].body.includes("(암시)") && p[0].body.includes("앞으로 약 6개월"));
  assert.ok(p[4].free.startsWith("## 회사일까 일일까") && !p[4].free.includes("현재 회사에 남기") && p[4].locked.startsWith("**세 장을 합치면 ‘현재 회사에 남기’ 쪽이 뚜렷해요.**"));
  assert.ok(p[8].body.startsWith("## 3년째 이어진 고민 끝에"), "결론 headline은 9쪽 맨 위");
  assert.ok(p[6].body.includes("남는 쪽으로 정했다면, 이번 주에 이것부터") && !p[6].body.includes("※"), "돈 고민 아님 → 작은 글씨 없음");
  DH.unpaid.slice(5).forEach((x) => assert.equal(x.body, null, `${x.page}쪽 결제 전 본문 없음`));
});

t("v4 5쪽 teaser 대체(R7): C teaser 없으면 강도별 두 틀(닉네임·duration·선택지 이름), reasons 없으면 카드 뜻으로", () => {
  assert.deepEqual(teaserFallback({ strength: "strong", name: "도현", frame: dhFrame }),
    { headline: "도현님의 질문에, 세 장이 답했어요", lead: "도현님이 3년째 붙들어 온 그 질문에, 세 장은 생각보다 분명한 답을 내놓았어요." });
  const s2 = teaserFallback({ strength: "slight", name: "도현", frame: dhFrame });
  assert.equal(s2.headline, "3년의 질문 끝에, 세 장은 한쪽을 골랐어요");
  assert.equal(s2.lead, "이직 제안 수락과 현재 회사에 남기 중 어느 쪽인지는, 세 장이 하나씩 들려주는 이야기 끝에 나와요.");
  assert.deepEqual(parseC({ ...fxJ("C_out.json"), teaser_headline: s2.headline, teaser_lead: s2.lead }, { decision: true, strength: "slight", frame: dhFrame, lean: DH.lean }).errors, [], "2안(선택지를 나란히)은 결론을 드러낸 것이 아님");
  const base = buildPages({ name: "도현", cls: DH.cs.ai, picks: DH.picks, data, paid: true });
  const P = buildPagesV4({ base, frame: dhFrame, lean: { ...DH.lean, strength: "slight" }, C: null, E: null, name: "도현", paid: true, data });
  assert.ok(P[4].free.startsWith("## 3년의 질문 끝에") && P[4].free.includes(`— ${DH.lean.cards[0].meaning}라, 머무는 쪽을`));
  assert.ok(P[4].locked.includes("쪽이 조금 더 커요.**"));
});

t("v4 계획 블록 머리말은 side별(R11), small_note는 돈 고민일 때만(R10)", () => {
  const base = buildPages({ name: "도현", cls: DH.cs.ai, picks: DH.picks, data, paid: true });
  const mv = buildPagesV4({ base, frame: dhFrame, lean: { ...DH.lean, side: "move", option: "이직 제안 수락" }, C: DH.C, E: DH.E.E, name: "도현", paid: true, data });
  assert.ok(mv[6].body.includes("옮기는 쪽으로 정했다면, 이번 주에 이것부터") && !mv[6].body.includes("남는 쪽으로 정했다면"));
  const money = lean({ picks: DH.picks, type: "start", tables, name: "도현", frame: { ...dhFrame, money: true } });
  assert.ok(money.small_note.startsWith("결정적인 판단은 도현님의 몫이에요.") && !money.small_note.includes("{name}"));
  assert.equal(lean({ picks: DH.picks, type: "start", tables, name: "도현", frame: dhFrame }).small_note, undefined);
  assert.ok(lean({ picks: DH.picks, type: "start", tables, name: "도현", money: true }).small_note);
  const P = buildPagesV4({ base, frame: { ...dhFrame, money: true }, lean: money, C: DH.C, E: DH.E.E, name: "도현", paid: true, data });
  const L = P[6].body.split("\n"); const i = L.findIndex((x) => x.startsWith("※ 결정적인 판단은 도현님의 몫"));
  assert.ok(i > L.findIndex((x) => x.startsWith("◦ 무엇을:")), "※ 작은 글씨는 7쪽 계획 아래");
});

// 비결정형 E 예시(검증 통과용 — 지수님 연애 고민)
const E_OTHER = { direction: null,
  plan: { when: "이번 주 수요일 저녁", where: "집에서, 휴대폰 메모 앱에", how: "남자친구와 나누고 싶은 연락의 모양을 세 줄로 적어 보세요." },
  change: { head: "앞으로의 열쇠 쪽으로 가면 연락 횟수보다 바라는 연결의 모양을 보게 될 거예요.",
    body: "세 번째 카드도 앞의 두 장처럼 이 관계를 지키고 싶은 마음에서 출발해요. 다만 서운함을 삼키던 자리에서 내가 바라는 연결을 말하는 쪽으로 방향이 바뀝니다. 그래서 연락이 뜸한 날에도 괜찮은 척 대신 바라는 것을 먼저 떠올리게 돼요.",
    signs: ["연락이 뜸한 날에도 서운함을 혼자 삼키지 않고 한 줄로 적게 될 거예요.", "남자친구에게 바라는 연결이 하루 한 번의 대화인지 알게 될 거예요.", "괜찮은 척하는 날이 줄고 하고 싶은 말을 먼저 고르게 될 거예요."] },
  rx: [{ bridge: "앞으로의 열쇠 ‘바라는 연결’을 생활로 옮기면", title: "바라는 연결 세 줄 적기", how: "남자친구와 어떤 연결을 바라는지 세 줄로 적어 보세요.", why: "바라는 모양을 알아야 서운함을 말로 꺼낼 수 있기 때문입니다." },
    { bridge: "지금의 흐름에서 본 ‘괜찮은 척’을 풀려면", title: "괜찮은 척한 순간 표시하기", how: "이번 주 괜찮은 척한 순간을 메모에 표시하세요.", why: "괜찮은 척하는 데 드는 힘을 알면 지치기 전에 멈출 수 있기 때문입니다." }],
  practices: { today: { title: "바라는 연결 한 줄", how: "남자친구와 바라는 연결을 한 줄 적어 보세요.", time: "2분", why: "작게 적어 두면 서운함을 말로 바꾸기 쉽기 때문입니다." },
    three: { title: "괜찮은 척 세어 보기", how: "사흘 동안 괜찮은 척한 횟수를 세어 보세요.", time: "15분", why: "횟수를 보면 지침의 크기를 알 수 있기 때문입니다." },
    week: { title: "매일 바라는 것 한 줄", how: "매일 저녁 바라는 연결을 한 줄씩 적어 보세요.", time: "이번 주", why: "모아 보면 말할 문장이 생기기 때문입니다." } } };

t("v4 비결정형 11쪽: 1쪽 틀 상자는 '결국 묻는 것'만, 5쪽 그대로, 7쪽 이유 + '이번 주에 이것부터'(열쇠는 8쪽 E.change), 8쪽 E.change", () => {
  const picks = mk([[8], [15, 1], [6]]), cls = { domain: "LOV", emotions: ["HUR", "LON"], need: "CONNECT" };
  const frame = parseFrame({ worry_type: "feeling", options: [], option_axis: null, core_question: "괜찮은 척을 계속해도 될까요?", hidden_question: null, deadline: null, duration: null, money: false, table: null, user_words: ["괜찮은 척하고 있어요"] }).frame;
  assert.ok(frame);
  const pE = parseE(E_OTHER, { lean: null, frame });
  assert.deepEqual(pE.errors, []);
  const base = buildPages({ name: "지수", cls, picks, data, paid: true });
  const P = buildPagesV4({ base, frame, lean: null, C: null, E: pE.E, name: "지수", paid: true, data });
  assert.equal(P.length, 11); assert.deepEqual(P.map((p) => p.page), [...Array(11).keys()].map((i) => i + 1));
  assert.ok(P[0].body.includes("◦ 결국 묻는 것: 괜찮은 척을 계속해도 될까요?") && !P[0].body.includes("◦ 선택지"));
  assert.equal(P[4].free.replace(/\*\*/g, "").split("\n")[0], base[4].free.split("\n")[0], "5쪽 headline 그대로");
  assert.ok(!P[4].free.includes("세 장을 종합하면") && !P[4].locked.includes("세 장을 합치면"));
  const F = data.copy.result.flow_titles;
  assert.ok(!P[6].body.includes(F.key) && P[6].body.includes(F.reasons) && !P[6].body.includes(F.signs) && !P[6].body.includes("카드가 가리키는 방향"));
  assert.equal(P[6].teaser, data.copy.result.v4.teaser7_plan);
  assert.ok(P[6].body.includes("이번 주에 이것부터\n◦ 언제: 이번 주 수요일 저녁"));
  assert.ok(P[7].title === "앞으로 이렇게 바뀔 거예요" && P[7].body.includes("이런 변화가 보일 거예요") && P[7].body.includes("바라는 연결이 하루 한 번"));
  assert.ok(P[8].body.includes("• 바라는 연결 세 줄 적기") && P[9].body.includes("• 오늘: 바라는 연결 한 줄 (2분)") && P[10].next === null);
});

t("v4 E 없는 11쪽(고민 미작성·AI 실패): 8쪽 = 기존 열쇠 문단 + DB 신호, 계획 블록 없음, 9·10쪽 = DB 처방·실천", () => {
  const picks = mk([[18, 1], [9], [0]]);
  const base = buildPages({ name: "하늘", cls: null, picks, data, paid: true });
  const P = buildPagesV4({ base, frame: null, lean: null, C: null, E: null, name: "하늘", paid: true, data });
  const U = buildPagesV4({ base: buildPages({ name: "하늘", cls: null, picks, data }), frame: null, lean: null, C: null, E: null, name: "하늘", paid: false, data });
  const F = data.copy.result.flow_titles;
  assert.equal(P.length, 11); assert.equal(U.length, 11);
  assert.ok(P[0].body.includes("앞으로 약 6개월") && !P[0].body.includes("이번 고민에서 끝까지"));
  assert.ok(!P[6].body.includes("이번 주에 이것부터") && !P[6].body.includes(F.key) && P[6].body.includes(F.reasons));
  assert.ok(P[7].body.includes(F.key) && picks[2].card.signs.every((x) => P[7].body.replace(/\*\*/g, "").includes(x.slice(0, 8))));
  assert.ok(P[8].body.includes("▸ 앞으로의 열쇠") && P[9].body.includes("9쪽 처방") && !P[9].body.includes("8쪽 처방"));
  assert.ok(P[10].body.includes(data.copy.cta_chat.button));
  U.slice(5).forEach((x) => assert.ok(x.body === null && x.blur, `${x.page}쪽 결제 전 블러만`));
  assert.equal(U[7].blur, data.copy.result.blur_samples.pages["8"], "v4 데이터: 8쪽 블러 = change 예시");
});

t("v4 parseFrame(A2): 통과 · 탈락(이유 돌려줌)", () => {
  assert.deepEqual(parseFrame(fxJ("A2_out.json")).errors, []);
  const old = parseFrame(fxJ("A2_out_원본_p34.json"));
  assert.equal(old.frame, null); assert.ok(old.errors.some((e) => e.includes("money")) && old.errors.some((e) => e.includes("table")));
  const ok = fxJ("A2_out.json");
  assert.ok(parseFrame({ ...ok, worry_type: "choice" }).errors[0].includes("worry_type"));
  assert.ok(parseFrame({ ...ok, options: ["하나"] }).errors.some((e) => e.includes("2~3")));
  assert.ok(parseFrame({ ...ok, option_axis: { move: "창업", stay: ok.option_axis.stay } }).errors.some((e) => e.includes("move")));
  assert.ok(parseFrame({ ...ok, core_question: "이직 제안을 수락해야 할지" }).errors.some((e) => e.includes("물음표")));
  assert.ok(parseFrame({ ...ok, table: "career" }).errors.some((e) => e.includes("10종")));
  assert.deepEqual(parseFrame({ ...ok, table: "express" }).errors, [], "옛 형식도 express·boundary 받음");
  assert.ok(parseFrame({ ...ok, money: "no" }).errors.some((e) => e.includes("money")));
  const nd = parseFrame({ worry_type: "situation", options: [], option_axis: null, core_question: "어떻게 해야 할까요?", money: false, table: null });
  assert.deepEqual(nd.errors, []); assert.equal(nd.frame.option_axis, null);
  assert.equal(parseFrame("JSON 아님").frame, null);
});

t("v4 parseC: 도현 통과 · teaser가 결론을 드러내면/reasons에 선택지 이름이면 그 칸만 탈락", () => {
  const raw = fxJ("C_out.json"), o = { decision: true, strength: "strong", frame: dhFrame, lean: DH.lean };
  const ok = parseC(raw, o);
  assert.deepEqual(ok.errors, []); assert.equal(ok.reasons.length, 3); assert.ok(ok.teaser_headline && ok.links.headline);
  const b1 = parseC({ ...raw, teaser_lead: "도현님의 세 장은 현재 회사에 남기 쪽에 분명한 답을 내놓았어요." }, o);
  assert.equal(b1.teaser_lead, null); assert.ok(b1.errors.some((e) => e.includes("결론 선택지 이름")) && b1.reasons);
  assert.ok(parseC({ ...raw, teaser_headline: "회사에 남는 쪽, 세 장이 답했어요" }, o).errors.some((e) => e.includes("결론 낱말 '남는'")));
  const b2 = parseC({ ...raw, reasons: [raw.reasons[0], raw.reasons[1], "앞으로의 열쇠는 현재 회사에 남기를 조건과 함께 가리키는 카드라 머무는 쪽이에요."] }, o);
  assert.equal(b2.reasons, null); assert.ok(b2.errors.some((e) => e.includes("선택지 이름")) && b2.teaser_lead);
  assert.ok(parseC({ ...raw, reasons: raw.reasons.slice(0, 2) }, o).errors.some((e) => e.includes("3개")));
  assert.ok(parseC(raw, { ...o, strength: "slight" }).errors.some((e) => e.includes("2안")));
  assert.ok(parseC({ ...raw, reasons: [raw.reasons[0], raw.reasons[1], "뭔가 정리되지 않은 마음을 조용히 지켜보는 카드라, 머무는 쪽을 가리켜요."] }, o).errors.some((e) => e.includes("모호한 말")));
  const nd = parseC(raw, { decision: false });
  assert.equal(nd.reasons, null); assert.equal(nd.teaser_headline, null); assert.deepEqual(nd.errors, []);
  assert.equal(parseC({ ...raw, now: { line: "짧아요." } }, o).links, null);
});

t("v4 parseE: 도현 통과 · 방향·R4·V1·V9·V10·직접 종료 권유·'결정은 당신에게' 탈락", () => {
  const raw = fxJ("E_out.json"), o = { lean: DH.lean, frame: dhFrame };
  assert.deepEqual(parseE(raw, o).errors, []);
  const D = (d) => ({ ...raw, direction: { ...raw.direction, ...d } });
  const err = (x) => parseE(x, o).errors.join(" | ");
  assert.match(err(D({ head: "세 장은 ‘이직 제안 수락’ 쪽이에요." })), /head가/);
  assert.match(err(D({ lean: "남는 쪽 — 단, 조건으로" })), /lean이 선택지 이름/);
  assert.match(err(D({ body: "짧은 근거예요." })), /body 180~420자/);
  assert.match(err(D({ timing: "결론은 초반에 드러날 수도 있어요." })), /R4/);
  assert.match(err(D({ body: raw.direction.body.replace("먼저 보여요.", "먼저 보여요. 결국 두 쪽의 좋은 점을 함께 가져가는 절충이 답이에요.") })), /R2 결론 문단에 제3안/);
  assert.match(err(D({ decide_by: "지금 맡은 일이 아쉬운가요" })), /decide_by/);
  assert.match(err(D({ if_then: ["하나뿐이에요."] })), /if_then/);
  assert.match(err(D({ plan: { when: "금요일", where: "집", how: "적기" } })), /how 20~70자/);
  assert.match(err(D({ body: raw.direction.body + " 결국 결정은 도현님에게 달려 있어요." })), /결정은/);
  assert.match(err({ ...raw, rx: [{ ...raw.rx[0], how: raw.rx[0].how + " 맞지 않으면 끝내세요." }, raw.rx[1]] }), /끝내세요/);
  assert.match(err({ ...raw, rx: [{ ...raw.rx[0], how: "하루씩 이직한 사람처럼 살아 보세요." }, raw.rx[1]] }), /가정 행동/);
  assert.match(err({ ...raw, change: { ...raw.change, body: raw.change.body + " 마음 한구석의 찜찜함이 줄어요." } }), /찜찜함/);
  assert.match(err({ ...raw, change: { ...raw.change, signs: raw.change.signs.slice(0, 2) } }), /signs 3개/);
  assert.match(err({ ...raw, practices: { today: { title: "숨 고르기", how: "오늘 3분 동안 숨을 고르세요.", time: "3분", why: "숨을 고르면 편해지기 때문입니다." },
    three: { title: "산책", how: "15분 걸으세요.", time: "15분", why: "걷기는 좋기 때문입니다." }, week: { title: "일기", how: "매일 한 줄 일기를 쓰세요.", time: "이번 주", why: "기록이 쌓이기 때문입니다." } } }), /V9 10쪽/);
  assert.match(err({ ...raw, change: { ...raw.change, body: raw.change.body + " 반드시 그렇게 됩니다." } }), /반드시/);
  assert.equal(parseE(raw, o).E.direction.head, raw.direction.head);
  assert.ok(!/헤어지|게 될 거예요/.test(err({ ...raw, change: { ...raw.change, signs: ["이직 제안을 볼 때 지금 맡은 일의 내용을 먼저 떠올리게 될 거예요.", ...raw.change.signs.slice(1)] } })), "v4 V1: '게 될 거예요'는 허용");
  assert.match(parseE(raw, { lean: null, frame: { ...dhFrame, worry_type: "feeling" } }).errors.join(), /direction이 null이 아님/);
  assert.match(parseE({ ...E_OTHER, plan: null }, { lean: null, frame: null }).errors.join(), /plan/);
  assert.ok(v10Hits("마음을 머금은 문장").length && !v10Hits("찜찜함(이직했을 때 아쉬울 것)을 적어요").length);
});

t("v4 안전(S2 삭제·S4 쪼갬): 폭력은 구체 행동만, '무서워서 말을 못 해요'는 두려움, 잃을까 봐·차단·관용 표현은 none", () => {
  for (const kw of [null, data.safety_keywords]) {
    const s = (x) => screenText(x, kw);
    assert.deepEqual([s("남친이 화나면 저를 때렸어요").violence, s("남친이 화나면 저를 때렸어요").fear], [true, false]);
    assert.deepEqual([s("남친이 무서워서 말을 못 해요").violence, s("남친이 무서워서 말을 못 해요").fear, s("남친이 무서워서 말을 못 해요").level], [false, true, "none"]);
    assert.deepEqual([s("무서워서 아무 말도 못 해요").violence, s("무서워서 아무 말도 못 해요").fear], [false, true]);
    assert.deepEqual([s("그가 떠날까 봐 무서워요").violence, s("그가 떠날까 봐 무서워요").fear, s("그가 떠날까 봐 무서워요").level], [false, false, "none"]);
    assert.deepEqual([s("전 애인 번호를 차단했어요").violence, s("전 애인 번호를 차단했어요").fear, s("전 애인 번호를 차단했어요").level], [false, false, "none"]);
    assert.deepEqual([s("연락하지 말라고 했어요").violence, s("연락하지 말라고 했어요").fear], [false, false]);
    assert.equal(s("배고파 죽겠어").level, "none");
    assert.equal(s("요즘 너무 힘들고 잠을 못 자요").level, "none", "기간 없는 '잠을 못 자요'는 none(한 달 이상일 때만 watch)");
    assert.ok(s("헤어지자고 하니까 사진을 뿌리겠다고 협박해요").violence, "S4-2 협박");
    assert.ok(s("남자친구가 제 휴대폰을 검사해요").violence, "S4-3 통제");
  }
  assert.ok(screenText("남자친구 눈치 봐요", data.safety_keywords).fear && !screenText("남자친구 눈치 봐요", data.safety_keywords).violence, "데이터의 '눈치봐요'는 v4에서 두려움");
  const m = mergeSafety(screenText("무서워서 말을 못 해요"), { crisis_level: "watch", violence: false });
  assert.deepEqual([m.level, m.violence, m.fear], ["watch", false, true]);
  assert.equal(buildSafetyNotice({ data, safety: m }), data.copy.safety.fear_box || FEAR_BOX_DEFAULT);
  assert.equal(buildSafetyNotice({ data, safety: { level: "none", violence: true, fear: false } }), data.copy.safety.violence_box);
  assert.equal(buildSafetyNotice({ data, safety: { level: "watch", violence: false } }), null, "watch 박스 없음(v4.1: 마지막 쪽 작은 글씨로)");
  assert.ok(buildStoryUserBlock({ name: "a", worryText: "무서워서 말을 못 해요", cls: { domain: "LOV", emotions: ["ANX"], need: "CONNECT" }, picks: mk([[1], [2], [3]]), data, safety: m }).includes("fear_flag=true"));
  assert.equal(filterPractices(data.cards.find((c) => c.id === "swim_together"), m).length, 3, "두려움만으로는 다가가기 실천을 빼지 않음");
});

t("v4 계획 머리말: 변화형 표는 side별, 관계형 표는 ‘선택지’ 쪽, 비결정형은 '이번 주에 이것부터'", () => {
  assert.equal(planHead({ table: "job", side: "stay", option: "x" }), "남는 쪽으로 정했다면, 이번 주에 이것부터");
  assert.equal(planHead({ table: "move", side: "move", option: "x" }), "옮기는 쪽으로 정했다면, 이번 주에 이것부터");
  assert.equal(planHead({ table: "approach", side: "move", option: "먼저 연락하기" }), "‘먼저 연락하기’ 쪽으로 정했다면, 이번 주에 이것부터");
  assert.equal(planHead({ table: "continue", side: "stay", option: "이 관계를 다시 생각해 볼 때" }), "‘이 관계를 다시 생각해 볼 때’ 쪽으로 정했다면, 이번 주에 이것부터");
  assert.equal(planHead(null), "이번 주에 이것부터");
  assert.ok(PLAN_HEADS.relation.includes("{option}") && SUBHEADS.includes("카드가 가리키는 방향"));
  const base = buildPages({ name: "도현", cls: DH.cs.ai, picks: DH.picks, data, paid: true });
  const rel = buildPagesV4({ base, frame: dhFrame, lean: { ...DH.lean, table: "approach" }, C: DH.C, E: DH.E.E, name: "도현", paid: true, data });
  assert.ok(rel[6].body.includes("‘현재 회사에 남기’ 쪽으로 정했다면, 이번 주에 이것부터") && PLAN_HEAD_RE.test("‘현재 회사에 남기’ 쪽으로 정했다면, 이번 주에 이것부터"));
});

t("v4 데이터: 11쪽 pages·v4 문구·fear_box·safety_keywords(watch·fear)·블러 11쪽 번호", () => {
  const R = data.copy.result;
  assert.deepEqual(R.pages.map((p) => p.page), [...Array(11).keys()].map((i) => i + 1));
  assert.deepEqual(R.pages.map((p) => p.key), ["cards", "now", "hold", "step", "story", "apply", "flow", "change", "rx", "practice", "sowella"]);
  assert.deepEqual(DH.paid.map((p) => p.title), R.pages.map((p) => p.title), "v4 11쪽 제목 = 데이터");
  assert.ok(R.v4 && R.v4.plan_head.relation && R.v4.frame_title);
  assert.ok(data.copy.safety.fear_box.includes("1366") && data.copy.safety.fear_box.includes("안전하다고 느낄 때"));
  const kw = data.safety_keywords;
  assert.ok(kw.watch.length > 10 && !("deprecated_watch" in kw) && kw.fear.includes("눈치봐요") && !kw.violence.includes("눈치봐요") && !kw.violence.includes("큰일나서"));
  assert.ok(!kw.urgent.some((w) => /사라지고싶|없어지고싶|살기싫|살고싶지않|다끝내고싶|안깼으면/.test(w)), "v4.1: 소극적 표현은 urgent에 없음");
  assert.equal(screenText("사라지고 싶어요", { ...kw, watch: undefined, deprecated_watch: kw.watch }).level, "watch", "옛 이름 deprecated_watch도 읽음");
  assert.ok(data.copy.safety.watch_note.includes("109"));
  assert.ok(Object.keys(R.blur_samples.pages).join() === "6,7,8,9,10,11" && R.blur_samples.pages["10"].startsWith("9쪽 처방") && R.blur_samples.pages["8"].includes("이런 변화가 보일 거예요"));
  const U = DH.unpaid;
  assert.equal(U[7].blur, R.blur_samples.pages["8"]); assert.equal(U[8].blur, R.blur_samples.pages["9"]); assert.equal(U[10].blur, R.blur_samples.pages["11"]);
  assert.equal(ex.find((x) => x.id === "SAFE-01").expected_keyword_level, "watch", "v4.1: '사라지고 싶다'는 watch");
  const base = buildPages({ name: "a", cls: null, picks: mk([[1], [2], [3]]), data });
  assert.equal(base[7].blur, R.blur_samples.pages["9"], "buildPages(10쪽) 처방 쪽 블러도 key로 찾음");
});


// ════════ v4.1 고민 틀 v4.6(mode axis/rank) · express·boundary · few-shot 유사도 · 두 번째 의견 · 안전 단계(watch) ════════
const sumOf = (type, spec) => spec.reduce((a, [no, r], i) => a + tables.rule.weights[i] * tables.types[type].scores[`${no}_${r ? "rev" : "up"}`][0], 0);
// 표에서 합이 +/−인 세 장 찾기(서로 다른 카드)
function findSpec(type, want) {
  const keys = Object.keys(tables.types[type].scores);
  for (const a of keys) for (const b of keys) for (const c of keys) {
    const sp = [a, b, c].map((k) => [+k.split("_")[0], k.endsWith("rev")]);
    if (new Set(sp.map((x) => x[0])).size < 3) continue;
    const v = sumOf(type, sp);
    if (want(v)) return sp;
  }
  return null;
}
const F46 = (o) => ({ table: "start", decision_source: "explicit", mode: "axis", rank_reason: null, worry_type: "decision", options_ranked: ["a", "b"],
  core_question: "어떻게 할까요?", hidden_question: null, deadline: null, duration: null, money: false, user_words: ["원문 구절"], confidence: "high", ...o });

t("v4.1 rank 결론: 카드 +면 1순위, −면 2순위, 3순위 이하는 결론이 되지 않음 · 계획 머리말은 ‘선택지’", () => {
  const fr = parseFrame(F46({ mode: "rank", rank_reason: "손에 쥔 실제 기회를 받아들이는 쪽이 앞이에요.", options_ranked: ["대기업 계약직 가기", "중소기업 정규직 가기", "공시 계속 준비하기"] }));
  assert.deepEqual(fr.errors, []);
  const pos = findSpec("start", (v) => v >= 3), neg = findSpec("start", (v) => v <= -3);
  const P = lean({ picks: pk(pos), type: "start", tables, frame: fr.frame }), N = lean({ picks: pk(neg), type: "start", tables, frame: fr.frame });
  assert.deepEqual([P.mode, P.side, P.pick, P.conclusion, P.option, P.other], ["rank", "move", 0, "대기업 계약직 가기", "대기업 계약직 가기", "중소기업 정규직 가기"]);
  assert.deepEqual([N.side, N.pick, N.conclusion, N.other], ["stay", 1, "중소기업 정규직 가기", "대기업 계약직 가기"]);
  assert.deepEqual(P.not_concluded, ["공시 계속 준비하기"]);
  for (const sp of [pos, neg]) assert.notEqual(lean({ picks: pk(sp), type: "start", tables, frame: fr.frame }).option, "공시 계속 준비하기");
  assert.equal(planHead(N), "‘중소기업 정규직 가기’ 쪽으로 정했다면, 이번 주에 이것부터", "rank면 변화형 표도 선택지 이름으로");
  const base = buildPages({ name: "도현", cls: DH.cs.ai, picks: DH.picks, data, paid: true });
  const pages = buildPagesV4({ base, frame: fr.frame, lean: N, C: null, E: null, name: "도현", paid: true, data });
  assert.ok(pages[0].body.includes("◦ 선택지: 대기업 계약직 가기 / 중소기업 정규직 가기 / 공시 계속 준비하기"));
  assert.ok(pages[4].locked.startsWith("**세 장을 합치면 ‘중소기업 정규직 가기’ 쪽이"));
  assert.ok(pages[6].body.includes("세 장은") && pages[6].body.includes("‘중소기업 정규직 가기’ 쪽이에요."));
  // axis: [+ 쪽, − 쪽]
  const ax = parseFrame(F46({ table: "continue", worry_type: "relationship_question", decision_source: "implicit", options_ranked: ["남자친구와 이어 가기 (암시)", "헤어지기"] })).frame;
  assert.equal(lean({ picks: pk(findSpec("continue", (v) => v < 0)), type: "continue", tables, frame: ax }).option, "헤어지기");
  assert.equal(lean({ picks: pk(findSpec("continue", (v) => v >= 0)), type: "continue", tables, frame: ax }).option, "남자친구와 이어 가기");
  assert.ok(isDecisionFrame(ax), "worry_type이 relationship_question이어도 표·선택지가 있으면 결정형 경로");
});

t("v4.1 express·boundary lean: 점수표 합대로 + 쪽/− 쪽, 기본 선택지(implicit)·planHead ‘선택지’", () => {
  for (const type of ["express", "boundary"]) {
    const tb = tables.types[type];
    const pos = findSpec(type, (v) => v >= 1.5 && v < 3), neg = findSpec(type, (v) => v < 0 && v > -1.5);
    const P = lean({ picks: pk(pos), type, tables }), N = lean({ picks: pk(neg), type, tables });
    assert.deepEqual([P.side, P.strength, P.score, P.option], ["move", "clear", sumOf(type, pos), tb.move]);
    assert.deepEqual([N.side, N.strength, N.score, N.option], ["stay", "slight", sumOf(type, neg), tb.stay]);
    const fr = parseFrame(F46({ table: type, decision_source: "implicit", worry_type: "situation", options_ranked: tb.implicit })).frame;
    const L = lean({ picks: pk(pos), type, tables, frame: fr });
    assert.deepEqual([L.option, L.other], tb.implicit);
    assert.equal(planHead(L), `‘${tb.implicit[0]}’ 쪽으로 정했다면, 이번 주에 이것부터`);
    assert.equal(pickTable({ frame: fr, cls: null, tables }), type);
  }
  assert.equal(tables.types.express.scores["2_up"][0], -2, "고요히 바라보기(정) = 말을 아끼는 쪽");
  assert.equal(tables.types.boundary.scores["3_rev"][0], 2, "품어 주는 품(역) = 나를 위해 멈추는 쪽");
});

t("v4.1 parseFrame(v4.6): 통과(axis·rank·table null·'null' 문자열) · 탈락(표·mode·선택지 수·중복·rank_reason·decision_source·confidence) · 옛 형식도 통과", () => {
  const ok = parseFrame(fxJ("A2_out_v46.json"));
  assert.deepEqual(ok.errors, []); assert.equal(ok.frame.mode, "axis");
  assert.deepEqual(ok.frame.option_axis, { move: "이직 제안 수락 (암시)", stay: "현재 회사에 남기 (암시)" }, "옛 코드와 맞도록 option_axis도 채움");
  assert.deepEqual(parseFrame(F46({ mode: "rank", rank_reason: "오래 지속할 수 있는 쪽이 앞이에요.", options_ranked: ["세종", "수원", "제주", "서울"] })).errors, []);
  const nul = parseFrame(F46({ table: "null", decision_source: "none", mode: "axis", options_ranked: [], worry_type: "feeling" }));
  assert.deepEqual(nul.errors, []); assert.equal(nul.frame.table, null); assert.equal(nul.frame.mode, null); assert.equal(isDecisionFrame(nul.frame), false);
  const err = (o) => parseFrame(F46(o)).errors.join(" | ");
  assert.match(err({ table: "act" }), /10종/, "act 없앰");
  assert.match(err({ mode: "zigzag" }), /mode/);
  assert.match(err({ options_ranked: ["하나"] }), /2~4개/);
  assert.match(err({ mode: "rank", rank_reason: "x", options_ranked: ["a", "b", "c", "d", "e"] }), /2~4개/);
  assert.match(err({ options_ranked: ["다시 연락하기", "다시 연락하기 (암시)"] }), /두 번/);
  assert.match(err({ mode: "rank", rank_reason: null, options_ranked: ["a", "b", "c"] }), /rank_reason/);
  assert.match(err({ mode: "axis", options_ranked: ["a", "b", "c"] }), /axis/);
  assert.match(err({ decision_source: "maybe" }), /decision_source/);
  assert.match(err({ decision_source: "none" }), /none/);
  assert.match(err({ confidence: 0.9 }), /confidence/);
  assert.match(err({ core_question: "할까요" }), /물음표/);
  assert.match(err({ money: "no" }), /money/);
  assert.deepEqual(parseFrame(fxJ("A2_out.json")).errors, [], "옛 형식(option_axis)도 통과");
});

t("v4.1 도현: 새 형식 A2(v4.6) fixture로도 시안과 같은 11쪽 · 옛 형식과 결과 같음", () => {
  const D2 = runCase(FX, data, tables, { a2File: "A2_out_v46.json" });
  assert.deepEqual(D2.frameErr, []); assert.deepEqual(D2.C.errors, []); assert.deepEqual(D2.E.errors, []);
  assert.deepEqual([D2.lean.option, D2.lean.other, D2.lean.mode, D2.lean.strength, D2.lean.score], ["현재 회사에 남기", "이직 제안 수락", "axis", "strong", -4]);
  for (const key of ["paid", "unpaid"]) DH[key].forEach((p, i) => assert.deepEqual(D2[key][i], p, `${key} ${p.page}쪽`));
});

const GOLD = path.join(here, "../../judge-db/data/frame_gold_v1.jsonl");
const goldRows = fs.existsSync(GOLD) ? fs.readFileSync(GOLD, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
t("v4.1 retrieve: 글자 2~4그램 TF-IDF — 자기 자신이 1등, excludeId면 자기 자신 빠짐, 5개·점수 내림차순", () => {
  assert.ok(goldRows.length >= 490);
  const ix = buildIndex(goldRows);
  assert.equal(ix.size, goldRows.length);
  const r = goldRows[3];
  const withSelf = ix.nearest(r.text, 5);
  assert.equal(withSelf[0].id, r.id); assert.ok(withSelf[0].score > 0.99);
  const loo = ix.nearest(r.text, 5, { excludeId: r.id });
  assert.equal(loo.length, 5); assert.ok(!loo.some((x) => x.id === r.id), "자기 자신 제외(leave-one-out)");
  for (let i = 1; i < loo.length; i++) assert.ok(loo[i - 1].score >= loo[i].score);
  assert.ok(loo.every((x) => "table" in x && Array.isArray(x.ranked) && x.text));
  assert.deepEqual(nearest(r.text, 5, { excludeId: r.id }).map((x) => x.id), loo.map((x) => x.id), "모듈 nearest = 마지막 색인");
  assert.deepEqual(findSimilar(r.text, { k: 5, excludeId: r.id }).map((x) => x.id), loo.map((x) => x.id));
  assert.ok(grams("다시 연락").has("연락") && grams("ab").size === 1);
  // 운영에서 임베딩 검색으로 바꾸기: setRetriever 하나만
  setRetriever(() => [{ id: "X", score: 1, text: "가짜", table: "job", tables: ["job"], mode: "axis", ranked: ["a", "b"] }]);
  assert.equal(findSimilar("아무 글").length, 1); setRetriever(null);
  assert.equal(findSimilar(r.text, { k: 5, excludeId: r.id })[0].id, loo[0].id);
});

t("v4.1 voteTable: 점수 가중 투표 1순위 표와 비율, null 표도 한 표", () => {
  const v = voteTable([{ table: "approach", score: 0.5 }, { table: "reunion", score: 0.3 }, { table: "reunion", score: 0.3 }, { table: null, score: 0.1 }]);
  assert.equal(v.table, "reunion"); assert.ok(Math.abs(v.share - 0.6 / 1.2) < 1e-9); assert.ok(Math.abs(v.votes.null - 0.1) < 1e-9);
  assert.equal(voteTable([{ table: null, score: 0.9 }, { table: "job", score: 0.2 }]).table, null);
  assert.equal(voteTable([]).table, undefined);
});

t("v4.1 두 번째 의견: 유사도 표 ≠ A2 표(투표 비율 ≥ 0.6)면 강도 한 단계 낮춤(strong→clear→slight, slight 그대로) + review_log, 같으면 그대로", () => {
  assert.deepEqual(secondOpinion({ frameTable: "job", simTable: "job", strength: "strong" }), { strength: "strong", lowered: false, disagree: false, review_log: null });
  const a = secondOpinion({ frameTable: "job", simTable: "start", strength: "strong", worryId: "W-1", simShare: 0.6, score: -4 });
  assert.deepEqual([a.strength, a.lowered, a.disagree], ["clear", true, true]);
  assert.deepEqual([a.review_log.worry_id, a.review_log.frame_table, a.review_log.sim_table, a.review_log.sim_share, a.review_log.lean_score], ["W-1", "job", "start", 0.6, -4]);
  assert.equal(secondOpinion({ frameTable: "job", simTable: "start", strength: "clear", simShare: 0.8 }).strength, "slight");
  const s = secondOpinion({ frameTable: "job", simTable: null, strength: "slight", simShare: 0.8 });
  assert.deepEqual([s.strength, s.lowered, s.disagree], ["slight", false, true]); assert.ok(s.review_log, "slight도 로그는 남김");
  const L = applySecondOpinion(DH.lean, a);
  assert.deepEqual([L.strength, L.strength_before, L.side, L.option], ["clear", "strong", DH.lean.side, DH.lean.option], "쪽·선택지는 그대로, 강도만");
  assert.equal(applySecondOpinion(DH.lean, secondOpinion({ frameTable: "job", simTable: "job", strength: "strong" })), DH.lean);
  // 사용자 화면에는 결론 하나만(낮아진 강도로)
  const base = buildPages({ name: "도현", cls: DH.cs.ai, picks: DH.picks, data, paid: true });
  const P = buildPagesV4({ base, frame: dhFrame, lean: L, C: DH.C, E: null, name: "도현", paid: true, data });
  assert.ok(P[4].locked.startsWith("**세 장을 합치면 ‘현재 회사에 남기’ 쪽이 분명해요.**") && !P[4].locked.includes("뚜렷"));
  // afterFrame(파이프라인): 투표 결과로
  const af = afterFrame({ frame: dhFrame, lean: DH.lean, vote: { table: "start", share: 0.7, top_score: 0.3 }, worryId: "04", tables });
  assert.equal(af.lean.strength, "clear"); assert.equal(af.review_log.sim_table, "start");
  // v4.1 CSO 2차: 기본 min_share 0.6(decision_tables.json second_opinion) — 투표 비율이 낮으면 강도 그대로, 로그만
  assert.deepEqual(tables.second_opinion, { min_share: 0.6, note: "글자 유사도 기준. 임베딩으로 바꾸면 다시 재서 조정" });
  const low = afterFrame({ frame: dhFrame, lean: DH.lean, vote: { table: "start", share: 0.59, top_score: 0.3 }, worryId: "04", tables });
  assert.equal(low.lean, DH.lean); assert.ok(low.review_log.below_min_share);
  assert.equal(secondOpinion({ frameTable: "job", simTable: "start", strength: "strong" }).strength, "strong", "비율 모르면(기본 0.6 미달) 낮추지 않음");
  assert.equal(secondOpinion({ frameTable: "job", simTable: "start", strength: "strong", simShare: 0.6 }).strength, "clear", "0.6 이상이면 낮춤");
  assert.equal(afterFrame({ frame: dhFrame, lean: DH.lean, vote: { table: "job" } }).lean, DH.lean);
  const ms = secondOpinion({ frameTable: "job", simTable: "start", strength: "strong", simShare: 0.4, minShare: 0.6 });
  assert.deepEqual([ms.strength, ms.lowered, ms.disagree, ms.review_log.below_min_share], ["strong", false, true, true], "minShare(선택): 투표 비율이 낮으면 로그만");
});

t("v4.1 A2 사용자 입력: 비슷한 정답 5개(고민 글 + table·mode·options_ranked) + 이번 고민, 평가 땐 자기 자신 빼기", () => {
  const ix = buildIndex(goldRows);
  const r = goldRows.find((x) => x.tables[0] === "reunion");
  const prep = prepareFrameCall({ worryText: r.text, excludeId: r.id, index: ix });
  assert.equal(prep.neighbors.length, 5); assert.ok(!prep.neighbors.some((x) => x.id === r.id));
  const ans = [...prep.user.matchAll(/<answer>(.+?)<\/answer>/g)].map((m) => JSON.parse(m[1]));
  assert.equal(ans.length, 5);
  ans.forEach((a, i) => { assert.deepEqual(Object.keys(a), ["table", "mode", "options_ranked"]); assert.equal(a.table, prep.neighbors[i].table); });
  assert.ok(prep.user.trim().endsWith(`<worry>${r.text.trim()}</worry>`), "이번 고민은 맨 끝");
  assert.ok(prep.user.includes("아래 예시는 점수표·줄 세우기 방식을 보여 주는 것입니다. 선택지 문구는 따라 쓰지 말고 이번 고민 원문의 말로 쓰세요.\n<example n=\"1\">"), "예시 위 안내 한 줄");
  assert.equal((prep.user.match(/<worry>/g) || []).length, 6);
  assert.ok(prep.vote.table !== undefined && prep.vote.share > 0 && prep.vote.share <= 1);
  assert.equal(buildFrameUserBlock({ worryText: "고민", examples: [] }), "<worry>고민</worry>", "예시가 없으면 예전 입력과 같음");
  assert.ok(buildFrameUserBlock({ worryText: "고민", examples: [{ text: "예", tables: [null], mode: null, ranked: [] }] }).includes('<answer>{"table":null,"mode":null,"options_ranked":[]}</answer>'));
});

t("v4.1 pickTable: 새 형식에서 table null이면 방향 없음(qsub로 넘어가지 않음) · 폭력 확인이면 방향 끔 · 옛 형식은 qsub_map", () => {
  const nul = parseFrame(F46({ table: null, decision_source: "none", options_ranked: [], worry_type: "relationship_question" })).frame;
  assert.equal(pickTable({ frame: nul, cls: { domain: "LOV", qsub: "OM-REPLY" }, tables }), null);
  assert.equal(pickTable({ frame: { ...dhFrame, table: null }, cls: { domain: "LOV", qsub: "OM-REPLY" }, tables }), "approach", "옛 형식은 그대로");
  assert.equal(pickTable({ frame: dhFrame, cls: DH.cs.ai, tables, safety: { level: "none", violence: true } }), null);
  assert.equal(pickTable({ frame: dhFrame, cls: DH.cs.ai, tables, safety: { level: "none", violence: false, fear: true } }), "job", "두려움(fear)은 방향 계산");
  assert.deepEqual(optionPair(null), null);
});

t("v4.1 parseE(rank 새 형식): head는 결론 선택지, 다른 선택지를 결론으로 쓰면 탈락", () => {
  const fr = parseFrame(F46({ table: "job", mode: "rank", rank_reason: "손에 쥔 실제 기회가 앞이에요.", options_ranked: ["이직 제안 수락", "현재 회사에 남기", "다른 회사 더 알아보기"],
    deadline: "다음 달 말까지", duration: "3년째", user_words: dhFrame.user_words })).frame;
  const L = lean({ picks: DH.picks, type: "job", tables, frame: fr });
  assert.equal(L.option, "현재 회사에 남기");
  const raw = fxJ("E_out.json");
  assert.deepEqual(parseE(raw, { lean: L, frame: fr }).errors, []);
  assert.match(parseE({ ...raw, direction: { ...raw.direction, head: "세 장은 ‘이직 제안 수락’ 쪽이에요." } }, { lean: L, frame: fr }).errors.join(), /head/);
});

t("v4.1 안전 단계(CSO 2026-10-22): urgent = 직접 표현·자해·작별 준비 / watch = 소극적 표현 / none / violence / fear", () => {
  for (const kw of [data.safety_keywords, null]) {
    const s = (x) => screenText(x, kw);
    assert.equal(s("언제쯤 연락 올까요… 이번에도 연락 안 오면 진짜 그만 살려구요").level, "urgent");
    assert.equal(s("이번에도 연락 안 오면 진짜 그만 살려구요").level, "urgent");
    const end = s("재회운 봐주세요. 이번에도 안 되면 진짜 다 끝낼 거예요");
    assert.ok(["watch", "none"].includes(end.level) && end.level !== "urgent", "관계를 끝낸다는 뜻일 수 있어 urgent 아님(키워드 한계로 watch)");
    assert.equal(s("아침에 눈 안 떴으면 좋겠다").level, "watch");
    assert.equal(s("헤어지고 나흘째 거의 못 먹었어요").level, "none", "한 달 안 되게 못 먹음은 none");
    assert.equal(s("헤어지고 두 달째 밥을 거의 못 먹어요").level, "watch", "한 달 이상 못 먹음은 watch");
    const th = s("헤어지자고 하면 죽어버리겠대요");
    assert.deepEqual([th.level, th.violence], ["none", true], "CSO 2차: 남이 말한 협박 = violence, urgent 아님");
    assert.deepEqual([s("헤어지면 죽겠다고 해요").level, s("헤어지면 죽겠다고 해요").violence], ["none", true]);
    assert.equal(s("그냥 죽어버리고 싶어요").level, "urgent", "내 죽음에 대한 직접 표현은 urgent");
    assert.equal(s("배고파 죽겠대요").violence, false);
    assert.equal(buildSafetyNotice({ data, safety: mergeSafety(th, { crisis_level: "none", violence: true }) }), data.copy.safety.violence_box, "카드 멈춤 아님 — violence_box");
    const lv = s("남편이 생활비를 정해서 줘요");
    assert.deepEqual([lv.level, lv.violence, lv.fear], ["none", false, false]);
    for (const x of ["아빠 돌아가시고 나도 따라가고 싶다는 생각이 계속 들어", "할머니 곁으로 가고 싶어요", "요즘 죽는 방법을 검색해 본 적이 있어요", "가족들한테 편지를 써 뒀어요", "늘 제가 먼저 죽으면 좋겠다는 생각을 해요", "저를 다치게 한 적이 몇 번 있어요"])
      assert.equal(s(x).level, "urgent", x);
    for (const x of ["그냥 사라지고 싶어요", "살 자신이 없어요", "살 이유를 모르겠어요", "안 사는 게 낫겠다는 생각", "제가 없는 게 낫겠죠", "다 끝내고 싶어요", "술 없이는 잠을 못 자", "1년째 방에서만 지내요", "잠들면 그냥 안 깼으면 좋겠어요"])
      assert.equal(s(x).level, "watch", x);
    for (const x of ["시험 또 떨어졌어요. 이제 진짜 끝내도 될 것 같아요", "다 끝내고 싶은 건 이 연애예요", "배고파 죽겠어요", "발표 망쳐서 사라지고 싶을 만큼 창피했어요ㅋㅋ", "헤어지고 일주일째 입맛이 없어요"])
      assert.equal(s(x).level, "none", x);
    assert.ok(s("남친이 화나면 물건을 던져요").fear && !s("남친이 화나면 물건을 던져요").violence, "물건 던지기 = fear");
  }
  // 판별 DB 정답(worry_examples_v2): 위험 놓침 0 · 위기 아닌데 멈춤 0
  if (fs.existsSync(JDB)) {
    const rows = fs.readFileSync(path.join(JDB, "data/worry_examples_v2.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const r = rows.map((x) => [x, screenText(x.text, data.safety_keywords)]);
    assert.deepEqual(r.filter(([x, y]) => x.crisis_level === "urgent" && y.level !== "urgent").map(([x]) => x.id), [], "위험 놓침 0");
    assert.deepEqual(r.filter(([x, y]) => x.crisis_level !== "urgent" && y.level === "urgent").map(([x]) => x.id), [], "위기 아닌데 멈춤 0");
    assert.deepEqual(r.filter(([x, y]) => (x.crisis_level || "none") === "none" && y.level === "watch").map(([x]) => x.id), [], "위기 아닌데 watch 0");
  }
});

t("v4.1 watch: 흐름은 그대로(urgent만 안전 화면), 결과·방향 그대로 + 마지막 쪽 맨 아래 ※ 작은 글씨(굵게·말투 변환 제외)", () => {
  const watch = mergeSafety(screenText("헤어지고 나서 그냥 사라지고 싶어요", data.safety_keywords), { crisis_level: "none" });
  assert.equal(watch.level, "watch");
  assert.equal(nextScreenFor(watch), "confirm"); assert.equal(nextScreenFor({ level: "urgent" }), "safety");
  let st = next(next(next(initialState(), { type: "START" }, data), { type: "SUBMIT_NICKNAME", nickname: "a" }, data), { type: "CHOOSE_EXPERIENCE", value: "returning" }, data);
  assert.equal(next(st, { type: "SUBMIT_WORRY", text: "헤어지고 나서 그냥 사라지고 싶어요", localUrgent: watch.level === "urgent" }, data).screen, "shuffle");
  const note = data.copy.safety.watch_note;
  assert.equal(watchNoteFor({ data, safety: watch }), note); assert.equal(watchNoteFor({ data, safety: { level: "none" } }), null);
  const base = (paid) => buildPages({ name: "도현", cls: DH.cs.ai, picks: DH.picks, data, paid });
  const P = buildPagesV4({ base: base(true), frame: dhFrame, lean: DH.lean, C: DH.C, E: DH.E.E, name: "도현", paid: true, data, safety: watch });
  const U = buildPagesV4({ base: base(false), frame: dhFrame, lean: DH.lean, C: DH.C, E: DH.E.E, name: "도현", paid: false, data, safety: watch });
  const L = P[10].body.split("\n");
  assert.equal(L[L.length - 1], `※ ${note}`, "마지막 쪽 맨 아래 한 줄 — 굵게·말투 변환 없음");
  assert.equal(P[10].fineprint, `※ ${note}`); assert.equal(U[10].fineprint, `※ ${note}`, "결제 전에도 마지막 쪽 작은 글씨 칸");
  assert.equal((P.map((p) => p.body || "").join("\n").match(/※ 마음이 많이/g) || []).length, 1, "한 번만");
  const Pn = buildPagesV4({ base: base(true), frame: dhFrame, lean: DH.lean, C: DH.C, E: DH.E.E, name: "도현", paid: true, data, safety: { level: "none", violence: false } });
  P.slice(0, 10).forEach((p, i) => assert.deepEqual(p, Pn[i], `${p.page}쪽은 watch여도 같음`));
  assert.equal(P[10].body.replace(`\n\n※ ${note}`, ""), Pn[10].body);
  assert.ok(!("fineprint" in Pn[10]) && !("fineprint" in DH.paid[10]), "none이면 작은 글씨 없음");
  assert.equal(buildSafetyNotice({ data, safety: watch }), null, "watch는 안내 박스 없음");
});

console.log(`\n${passed}개 테스트 통과`);
console.log("\n[참고] 전 조합에서 카드별 후보 등장 횟수:");
Object.entries(freq).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
