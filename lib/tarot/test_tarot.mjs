// 실행: node test_tarot.mjs   (Node 18+, 외부 패키지 없음)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { shortlist, displayOrder, assignPositions, validateClassification } from "./selectCards.js";
import { screenText, mergeSafety, filterPractices } from "./safety.js";
import { buildFreeSections, buildPaidSections, buildSection8, buildSafetyNotice, mergeReport, buildStoryUserBlock, validateStory, validateApply, weekPlan, prescriptionsFor, applyFallback } from "./assembleReport.js";
import { EURO_RO, EUL_REUL, I_GA } from "./josa.js";
import { validate } from "./validateReport.js";
import { shuffleDeck, createShuffle, pickSlot, picksFromSlots, loadingText, drawOrientation } from "./deck.js";
import { buildLinkUserBlock, parseLinks, buildLockedPreview, parseStoryApply } from "./assembleReport.js";
import { initialState, next } from "./flow.js";

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

t("안전 확인: 위기·관찰·폭력 신호", () => {
  assert.equal(screenText("요즘 그냥 죽고 싶 다는 생각이 들어요").level, "urgent");
  assert.equal(screenText("너무 힘들어서 아무것도 못하겠어요").level, "watch");
  assert.equal(screenText("이직할지 고민이에요").level, "none");
  assert.equal(screenText("자살 생각이 들어요").level, "urgent");
  assert.equal(screenText("혼자 살기 시작했어요").level, "none", "띄어쓰기 제거로 생기는 '자살' 오탐 방지");
  assert.equal(screenText("여자 해외여행 혼자 가도 될까요").level, "none", "'자해' 오탐 방지");
  assert.equal(screenText("남자친구가 휴대폰을 검사하고 못 만나게 해요").violence, true);
  const m = mergeSafety(screenText("이직 고민"), { crisis_level: "watch", violence: false });
  assert.equal(m.level, "watch");
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

t("무료 1~3번·유료 4~7번·8번 조립 (카드별 섹션)", () => {
  const cls = { domain: "LOV", emotions: ["HUR", "LON"], need: "CONNECT" };
  const sl = shortlist(cls, data).map((x) => x.id);
  const picks = assignPositions([sl[0], sl[1], sl[2]], sl, data);
  const free = buildFreeSections({ name: "지수", cls, picks, data });
  assert.ok(free.section1.startsWith("### 1. 오늘 당신에게 온 세 장"));
  assert.ok(free.section1.includes("연애에 대한 고민으로 읽혔어요") && free.section1.includes("서운함과 외로움이 함께"));
  assert.ok(!free.section1.includes("해석 근거") && !/Hayes|Beck|Young/.test(free.section1)); // v2.3: 이론 노출 안 함
  assert.ok(free.section2.startsWith("### 2. 첫 번째 카드 · 지금의 마음") && free.section2.includes(picks[0].card.positions.now));
  assert.ok(free.section3.startsWith("### 3. 두 번째 카드 · 나를 붙잡는 것") && free.section3.includes(picks[1].card.positions.hold));
  assert.ok(!(free.section1 + free.section2 + free.section3).includes(picks[2].card.positions.step), "세 번째 카드 해석은 무료 영역에 없음");
  assert.ok(!/[은는이가을를](\(|\/)/.test(free.section1), "조사 병기 없음");
  const safety = { level: "watch", violence: true };
  const paid = buildPaidSections({ name: "지수", picks, data, safety, story: null });
  assert.ok(paid.section4.startsWith("### 4. 세 번째 카드 · 다음 한 걸음") && paid.section4.includes(picks[2].card.positions.step));
  assert.ok(paid.section7.includes("• 오늘:") && paid.section7.includes("• 3일 안에:") && paid.section7.includes("• 이번 주:"));
  const s8 = buildSection8({ data });
  assert.ok(s8.includes("타로를 보신 분들은 3일 동안 무료") && s8.includes("지금의 계정 그대로"));
  const notice = buildSafetyNotice({ data, safety });
  assert.ok(notice.includes("1366") && notice.includes("기댈 수 있는 곳"));
  const merged = mergeReport({ free, paid, section8: s8, notice });
  assert.deepEqual((merged.match(/^### (\d)\./gm) || []).map((x) => x.slice(4, 5)), ["1", "2", "3", "4", "5", "6", "7", "8"]);
  const freeOnly = mergeReport({ free, section8: s8, notice });
  assert.ok(!freeOnly.includes("### 4.") && !freeOnly.includes("### 8.") && freeOnly.includes("1366"), "결제 전: 4~8번 없음, 안전 안내는 보임");
});

t("역방향: 셔플마다 카드별 방향, 역방향 해석·표시", () => {
  const o = drawOrientation(data, seeded(3));
  assert.equal(Object.keys(o).length, 22);
  let rev = 0; for (let i = 0; i < 2000; i++) rev += Object.values(drawOrientation(data)).filter(Boolean).length;
  const rate = rev / (2000 * 22); assert.ok(rate > 0.47 && rate < 0.53, String(rate)); // v1.9: 50%
  const sh = createShuffle(data, { rng: seeded(4) });
  const id = sh.order[0]; sh.reversed[id] = true;
  const p = pickSlot(sh, [], 0, data);
  assert.equal(p.reversed, true);
  const picks = picksFromSlots(sh, [0, 1, 2], data);
  const free = buildFreeSections({ name: "a", cls: null, picks, data });
  assert.ok(free.section2.includes("(역방향)") && free.section2.includes(picks[0].card.reversed.positions.now));
  data.cards.forEach((c) => ["now", "hold", "step"].forEach((k) => assert.ok(c.reversed.positions[k].length > 15, c.name + k)));
});

t("7번 실천 카드 규칙", () => {
  const byId = Object.fromEntries(data.cards.map((c) => [c.id, c]));
  const picks = [{ card: byId.rock_rest }, { card: byId.guard_place }, { card: byId.embrace }];
  const w = weekPlan(picks, { level: "none", violence: false });
  assert.equal(w.today.title, "따뜻한 손 얹기");
  assert.equal(w.three.title, "나를 위한 10분 예약");
  assert.equal(w.week.title, "하루 기둥 하나 세우기");
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

t("고민 연결 한 줄: 파싱·검증·카드별 섹션 삽입", () => {
  const good = { now: "괜찮은 척하는 지금의 마음도 이 관계를 지키고 싶은 마음이에요.", hold: "말하면 귀찮아할 거라는 예상이 먼저 부풀어 있을 수 있습니다.", step: "내가 바라는 연결의 모양을 먼저 알아보면 좋아요." };
  assert.ok(parseLinks(JSON.stringify(good)));
  assert.equal(parseLinks("{bad json"), null);
  assert.equal(parseLinks({ ...good, step: "반드시 좋아질 거예요." }), null);
  assert.equal(parseLinks({ ...good, hold: "짧아요." }), null);
  const cls = { domain: "LOV", emotions: ["HUR"], need: "CONNECT" };
  const sh = createShuffle(data, { rng: seeded(9) });
  const picks = picksFromSlots(sh, [1, 2, 3], data);
  const free = buildFreeSections({ name: "지수", cls, picks, data, links: parseLinks(good) });
  assert.ok(free.section2.includes(good.now) && free.section3.includes(good.hold));
  assert.ok(!free.section3.includes(good.step), "세 번째 카드 연결 한 줄은 결제 전 미노출");
  const block = buildLinkUserBlock({ name: "지수", worryText: "연락이 뜸해요", cls, picks, data });
  assert.ok(block.includes("[now]") && block.includes("[step]"));
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

t("고민 미작성 모드: 무료 조립·연결 한 줄·이야기 AI 생략", () => {
  const sh = createShuffle(data, { rng: seeded(11) });
  const picks = picksFromSlots(sh, [0, 1, 2], data);
  const free = buildFreeSections({ name: "민준", cls: null, picks, data });
  assert.ok(free.section1.includes("마음속으로 떠올린 고민"));
  assert.equal(buildLinkUserBlock({ name: "민준", worryText: null, cls: null, picks, data }), null);
  assert.equal(buildStoryUserBlock({ name: "민준", worryText: null, cls: null, picks, data, safety: { level: "none", violence: false } }), null);
  const paid = buildPaidSections({ name: "민준", picks, data, safety: { level: "none", violence: false }, story: null });
  assert.ok(paid.section5.includes("마음속에 품은 고민"));
});

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
    assert.equal(r.level, x.expected_keyword_level, `${x.id} ${x.text}`);
    if (x.id !== "SAFE-04") assert.equal(r.violence, false, x.id);
  }
  assert.equal(screenText(ex.find((x) => x.id === "SAFE-04").text).violence, true);
});

t("self_focus·역방향이 AI 입력에 전달되고, 이야기 문단을 검증한다", () => {
  const sh = createShuffle(data, { rng: seeded(5) });
  const picks = picksFromSlots(sh, [3, 4, 5], data);
  const cls = { domain: "DIR", emotions: ["SHA"], need: "LETGO", self_focus: true };
  const block = buildStoryUserBlock({ name: "a", worryText: "자존감이 너무 낮아요", cls, picks, data, safety: { level: "none", violence: false } });
  assert.ok(block.includes("self_focus=true") && block.includes("방향: "));
  assert.ok(validateStory("주말에도 쉬지 못하고 지쳐 있다고 적어 주셨죠. 물범은 멈춰야 할 때라고, 펭귄은 혼자 다 지려는 마음을 짚어 줘요. 세 장 모두 버티는 힘보다 채우는 힘이 필요하다는 같은 방향을 가리킵니다."));
  assert.equal(validateStory("반드시 좋아질 거예요."), null);
});

// ---- v1.5 무료·유료 범위, 나 자신·삶의 방향 ----
t("무료/유료 범위(v1.8): 1~3번 무료, 4~7번 유료(잠금 미리보기), 8번 무료 안내", () => {
  const acc = Object.fromEntries(data.report_sections.map((x) => [x.no, x.access]));
  [1, 2, 3].forEach((n) => assert.equal(acc[n], "무료"));
  [4, 5, 6, 7].forEach((n) => assert.equal(acc[n], "유료"));
  assert.equal(acc[8], "유료", "v2.2: 쏘웰라 안내는 유료 리포트 마지막");
  assert.ok(!data.copy.result.paywall_price.includes("채팅권") && data.copy.result.paywall_price.includes("1,900원"));
  const sh = createShuffle(data, { rng: seeded(8) });
  const lp = buildLockedPreview(data, picksFromSlots(sh, [0, 1, 2], data));
  assert.deepEqual(lp.map((x) => x.no), [4, 5, 6, 7, 8]);
  assert.ok(lp[0].card && lp[0].card.length > 2, "4번은 세 번째 카드 이름까지 공개");
  lp.forEach((x) => assert.ok(x.teaser && x.teaser.length > 10, String(x.no)));
});

t("나 자신 고민은 '나 자신과 삶의 방향에 대한 고민'으로 읽힌다", () => {
  const sh = createShuffle(data, { rng: seeded(21) });
  const picks = picksFromSlots(sh, [0, 1, 2], data);
  const free = buildFreeSections({ name: "하늘", cls: { domain: "DIR", emotions: ["SHA"], need: "LETGO", self_focus: true }, picks, data });
  assert.ok(free.section1.includes("나 자신과 삶의 방향에 대한 고민으로 읽혔어요"));
  const free2 = buildFreeSections({ name: "하늘", cls: { domain: "DIR", emotions: ["CON"], need: "CHOOSE" }, picks, data });
  assert.ok(free2.section1.includes("진로와 자기계발에 대한 고민으로 읽혔어요"));
});

// ---- v1.9 유료 DB 문장 96개 ----
t("DB 문장: 실천 이유 66·감정 문장 8·마무리 22, 규칙 준수", () => {
  const bad = ["운명", "예언", "반드시", "게 될 거예요", "진단", "최악", "**"];
  const ok = (x) => /(요|다)\.$/.test(x) && !bad.some((w) => x.includes(w)) && !/[A-Za-z]{3,}/.test(x);
  let n = 0;
  data.cards.forEach((c) => { c.practices.forEach((p) => { assert.ok(p.why && ok(p.why), c.name + p.title); n++; }); assert.ok(c.closing && ok(c.closing), c.name); });
  assert.equal(n, 66);
  assert.equal(Object.keys(data.emotion_lines).length, 8);
  data.emotions.forEach((e) => assert.ok(ok(data.emotion_lines[e.code].replace("{name}", "민준")) && data.emotion_lines[e.code].includes("{name}"), e.code));
});

t("DB 문장이 결과에 들어간다(감정 문장·실천 이유·마무리)", () => {
  const byId = Object.fromEntries(data.cards.map((c) => [c.id, c]));
  const picks = [{ card: byId.rock_rest, position: "now", positionName: "지금의 마음" }, { card: byId.guard_place, position: "hold", positionName: "나를 붙잡는 것", reversed: true }, { card: byId.embrace, position: "step", positionName: "다음 한 걸음" }];
  const cls = { domain: "CAR", emotions: ["TIR", "ANX"], need: "REST" };
  const free = buildFreeSections({ name: "민준", cls, picks, data });
  assert.ok(free.section2.includes("지금 민준님이 느끼는 지침은"));
  const paid = buildPaidSections({ name: "민준", picks, data, safety: { level: "none", violence: false } });
  assert.ok(paid.section5.includes(byId.embrace.closing));
  assert.ok(byId.embrace.practices.some((p) => paid.section7.includes(p.why)), "실천 이유는 7번 실천 카드에");
});

// ---- v2.0 공통 규칙 검증 ----
t("공통 규칙: 역방향 부정어·판정·과거 추측·학자 이름·폭력 시 다가가기 문장을 거른다", () => {
  const base = "주말에도 쉬지 못한다고 적어 주셨죠. 물범은 지금 멈춰야 할 때라고 말하고, 펭귄은 혼자 다 지려는 마음을 짚어 줘요. 세 장 모두 버티는 힘보다 채우는 힘을 가리킵니다.";
  assert.ok(validateStory(base));
  ["역방향으로 나온 펭귄은 불길한 신호예요.", "상대는 회피형이라서 그래요.", "어릴 때부터 그랬을 수 있어요.", "프랭클의 말처럼 의미가 중요해요."]
    .forEach((x) => assert.equal(validateStory(base.replace("세 장 모두 버티는 힘보다 채우는 힘을 가리킵니다.", x)), null, x));
  const ap = "연락이 뜸해서 서운하다고 적어 주셨죠. 조개는 혼자 품은 서운함을, 원앙은 더 이어지고 싶은 마음을 비춰 줘요. 오늘은 먼저 연락해 마음을 전해 보세요.";
  assert.ok(validateStory(ap));
  assert.equal(validateStory(ap, { violence: true }), null);
  assert.equal(parseLinks({ now: "지금의 마음은 아직 안쪽에 머물러 있어요.", hold: "이 카드는 나쁜 카드라 조심해야 합니다.", step: "작은 한 걸음이면 충분해요." }), null);
});

// ---- v2.1 세 장 한눈에 보기 + 혹시 이렇진 않나요? ----
t("세 장 한눈에 보기: 카드별 원론 설명·역방향 안내가 1번에 들어간다", () => {
  const sh = createShuffle(data, { rng: seeded(31) });
  sh.reversed[sh.order[1]] = true;
  const picks = picksFromSlots(sh, [0, 1, 2], data);
  const free = buildFreeSections({ name: "a", cls: null, picks, data });
  assert.ok(free.section1.includes("세 장 한눈에 보기"));
  picks.forEach((p) => assert.ok(free.section1.includes(p.card.about_when), p.card.name));
  assert.ok(free.section1.indexOf("[카드 이미지 3장") < free.section1.indexOf("• 지금의 마음"), "카드 이미지가 맨 위");
  assert.ok(free.section2.includes("어떤 카드인가요") && free.section2.includes(picks[0].card.about_origin));
  assert.ok(free.section1.includes("이번에는 역방향으로 나왔어요"));
  data.cards.forEach((c) => { assert.ok(c.about.length > 60 && !/운명|죽음|악마/.test(c.about), c.name); assert.equal(c.asks.length, 2); c.asks.forEach((q) => assert.ok(/\?$/.test(q) && q.length <= 90, q)); });
  assert.ok(data.cards.flatMap((c) => c.asks).filter((q) => q.startsWith("혹시")).length === 0, "v2.2: 기본 질문은 '혹시'로 시작하지 않게 다양화");
});

t("혹시 이렇진 않나요?: AI 맞춤 질문을 쓰고, 규칙 위반·미작성이면 카드 기본 질문", () => {
  const sh = createShuffle(data, { rng: seeded(32) });
  const picks = picksFromSlots(sh, [0, 1, 2], data);
  const ai = { now: { line: "괜찮은 척하는 지금의 마음도 관계를 지키고 싶은 마음이에요.", asks: ["혹시 연락을 기다리며 서운함을 혼자 삼키고 있진 않나요?", "혹시 괜찮은 척하느라 나만 지쳐 가진 않나요?"] },
    hold: { line: "말하면 귀찮아할 거라는 예상이 먼저 부풀어 있을 수 있습니다.", asks: ["반드시 이럴 거예요."] },
    step: { line: "내가 바라는 연결의 모양을 먼저 알아보면 좋아요.", asks: [] } };
  const links = parseLinks(ai);
  assert.equal(links.now.asks.length, 2); assert.equal(links.hold.asks.length, 0);
  const free = buildFreeSections({ name: "지수", cls: { domain: "LOV", emotions: ["HUR"], need: "CONNECT" }, picks, data, links });
  assert.ok(free.section2.includes("혹시 이렇진 않나요?") && free.section2.includes(ai.now.asks[0]));
  assert.ok(free.section3.includes(picks[1].card.asks[0]), "규칙 위반이면 기본 질문");
  const silent = buildFreeSections({ name: "a", cls: null, picks, data });
  assert.ok(silent.section2.includes(picks[0].card.asks[0]));
});

// ---- v2.2 ----
t("질문 제목은 카드마다 다르게, 3번째 카드 섹션에도 '어떤 카드인가요'", () => {
  const sh = createShuffle(data, { rng: seeded(41) });
  const picks = picksFromSlots(sh, [0, 1, 2], data);
  const free = buildFreeSections({ name: "a", cls: null, picks, data });
  const paid = buildPaidSections({ name: "a", picks, data, safety: { level: "none", violence: false } });
  const h = data.copy.asks_headings;
  assert.ok(free.section2.includes(h[0]) && free.section3.includes(h[1]) && paid.section4.includes(h[2]));
  assert.ok(paid.section4.includes("어떤 카드인가요") && paid.section4.includes(picks[2].card.about_origin));
});

t("6번 처방은 처방 은행에서(7번 카드 실천과 겹치지 않음), 폭력 신호 시 다가가기 제외", () => {
  const byId = Object.fromEntries(data.cards.map((c) => [c.id, c]));
  const picks = [{ card: byId.pearl, position: "now" }, { card: byId.puffed, position: "hold" }, { card: byId.swim_together, position: "step" }];
  const cls = { domain: "LOV", emotions: ["HUR"], need: "CONNECT" };
  const rx = prescriptionsFor({ cls, picks, data, safety: { level: "none", violence: false } });
  assert.equal(rx.length, 2);
  assert.equal(rx[0].title, data.prescriptions.by_domain_need.LOV_CONNECT.title);
  const paid = buildPaidSections({ name: "지수", picks, data, safety: { level: "none", violence: false }, cls });
  const s7titles = paid.section7.split("\n").filter((l) => l.startsWith("• ")).map((l) => l.split(": ")[1].replace(/ \(.*\)$/, "").trim());
  s7titles.forEach((tt) => assert.ok(!paid.section6.includes("• " + tt), "6·7번 겹침: " + tt));
  const rxV = prescriptionsFor({ cls, picks, data, safety: { level: "none", violence: true } });
  assert.ok(rxV.every((r) => !r.approach));
  assert.equal(Object.keys(data.prescriptions.by_domain_need).length, 36);
});

t("5번 '내 고민에 대어 보면': AI 문단 검증, 없으면 대체 문장", () => {
  const good = "연락이 뜸해도 괜찮은 척하고 있다고 적어 주셨죠. 지금은 서운함을 혼자 품으며 관계를 지키려는 마음이 커 보여요. 그 마음을 붙잡는 건 말하면 귀찮아할 거라는 예상일 수 있습니다. 그래서 이번 주에는 연락의 횟수보다 내가 바라는 연결의 모양을 먼저 적어 보는 데서 시작해 보면 좋겠어요.";
  assert.ok(validateApply(good));
  assert.equal(validateApply("짧아요."), null);
  const sh = createShuffle(data, { rng: seeded(42) });
  const picks = picksFromSlots(sh, [0, 1, 2], data);
  const paid = buildPaidSections({ name: "하늘", picks, data, safety: { level: "none", violence: false } });
  assert.ok(paid.section5.includes("내 고민에 대어 보면") && paid.section5.includes(applyFallback({ name: "하늘", picks })));
});

t("D 응답 parseStoryApply: JSON 파싱 + 각각 검증, 깨진 응답은 둘 다 null", () => {
  const story = "괜찮은 척하고 있다고 적어 주셨죠. 조개는 서운함을 혼자 품고 있는 지금을 보여 줘요. 원앙은 그 서운함이 더 이어지고 싶다는 뜻이라고 말합니다.";
  const r = parseStoryApply(JSON.stringify({ story, apply: "짧아요." }));
  assert.equal(r.story, story); assert.equal(r.apply, null);
  assert.deepEqual(parseStoryApply("not json"), { story: null, apply: null });
});

const exDir = path.join(here, "../../docs/spec/example-reports/보류_전체AI생성");
if (fs.existsSync(exDir)) {
  for (const f of fs.readdirSync(exDir).filter((x) => x.endsWith("-ai.md"))) {
    t(`[보류] 전체 AI 생성 예시 검증: ${f}`, () => {
      const r = validate(fs.readFileSync(path.join(exDir, f), "utf8"), { violence: f.includes("violence") });
      assert.ok(r.ok, r.results.filter((x) => !x.ok).map((x) => `${x.name}: ${x.detail}`).join(" / "));
    });
  }
}

console.log(`\n${passed}개 테스트 통과`);
console.log("\n[참고] 전 조합에서 카드별 후보 등장 횟수:");
Object.entries(freq).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
