// v4.0 결과 파이프라인의 순수 부분(네트워크 없음 → 단위 테스트 가능). 서버(lib/server/session.ts)가 이 함수들만 부른다.
//   ① 방향 계산(decision.js)  ② C 호출 입력 만들기  ③ 10쪽 조립(buildPages → buildPagesV4, v4.2)  ④ 결제 전 응답 거르기
// 원본 패키지 코드(lib/tarot/*.js)는 바꾸지 않는다.
import { applyCardGist } from "./cardGist.ts";
import { secretThird, type SecretCopy } from "./secretThird.ts";
import { bundleFor } from "../i18n/bundle.ts";
import type { Locale } from "../i18n/locale.ts";
import type { MidDb } from "./midResult.ts";
import { type Lean } from "../tarot/decision.js";
import { pkg } from "./pkg.ts";
import { afterFrame } from "../tarot/frameInput.js";
import { normalizeFrameV43, applyForecastOptions, midAreaKey, teaserLine, answerFirst } from "../tarot/v43.js";
import answerDbKo from "../../data/answer_first_db.json" with { type: "json" };
import type { ExpandedPick, Safety } from "../tarot/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Frame = any;
type Cls = any;
// 언어별 데이터(영문판 2026-11-05). locale을 안 주면 한국어 — 기존 호출은 그대로 같은 결과.
const bd = (locale?: Locale) => bundleFor(locale ?? "ko");

// v2.3.4(v4.3): 저장된 고민 틀(A2 v4.7)을 쓰기 전에 새 칸 검사 + 예측 질문이면 선택지를 '될 흐름 / 어려운 흐름'으로.
// 패키지 순서(v43.js 머리말) 그대로: normalizeFrameV43 → applyForecastOptions → lean. 예전 결과(새 칸 없음)는 그대로 지나간다.
// 영문판은 아직 v4.3 데이터가 없어 손대지 않는다.
export function prepareFrame(frame: Frame | null, cls: Cls | null, locale?: Locale): Frame | null {
  if (!frame || locale === "en") return frame;
  return applyForecastOptions(normalizeFrameV43(frame, cls), bd(locale).tables);
}

/** 7쪽 '답 먼저' 한 줄(v4.3 — 예측·시기·상대 마음, DB 문장). now = 테스트를 본 시각(시기 달 계산 — 다시 열어도 같은 달). 영문판·고민 없음이면 null. */
export function answerFirstFor({ frame, lean, picks, now, locale }: { frame: Frame | null; lean: Lean | null; picks: ExpandedPick[]; now: Date; locale?: Locale }): any | null {
  if (locale === "en" || !frame) return null;
  try {
    return answerFirst({ frame, lean, picks, db: answerDbKo, data: bd(locale).data, now });
  } catch (e) {
    console.warn("답 먼저 문장 고르기 실패 — 그 줄 없이:", e instanceof Error ? e.message : "unknown");
    return null;
  }
}

/** 결제 후 7쪽 맨 위에 '답 먼저'를 붙인다(패키지 buildPagesV43과 같은 규칙: 예측 답이면 같은 뜻의 방향 제목 줄을 빼고, 돈 고민이면 보장하지 않는다는 ※ 한 줄). */
export function withAnswerFirst(pages: any[], af: any | null, frame: Frame | null): any[] {
  if (!af) return pages;
  return pages.map((p) => {
    if (p.page !== 7 || !p.body) return p;
    const L7 = String(p.body).split("\n");
    if (af.kind === "forecast") {
      const i = L7.findIndex((x, k) => k < 8 && /^\*\*세 장은 .*쪽(이에요|입니다)\.\*\*$/.test(x));
      if (i >= 0) L7.splice(i, L7[i + 1] && L7[i + 1].startsWith("◦ ") ? 2 : 1);
    }
    const isMoney = !!(frame && (frame.money === true || frame.area === "FORT"));
    const mn = isMoney && (answerDbKo as any).money_note ? `\n※ ${(answerDbKo as any).money_note.text}` : "";
    return { ...p, body: `**${af.text}**${mn}\n\n${L7.join("\n")}` };
  });
}

// 결정형 고민이면 카드 점수로 방향을 정한다(AI는 결론을 바꾸지 못함 — README_v4 R1·R2).
// frame이 없거나(미작성·A2 탈락) 점수표가 없으면 비결정형(null). 폭력 확인(violence)이면 방향을 끈다(v4.1 pickTable).
// v4.1: vote(A2를 부를 때 계산한 비슷한 정답 5개의 투표)가 있으면 두 번째 의견을 반영한다 — A2 표와 다르고 비율 ≥ 0.6이면
// 강도만 한 단계 낮춘다(쪽·선택지는 그대로). review_log는 검수 대기 기록(서버가 tarot_frame_reviews에 저장). 순서는 fixtures/runCase.mjs와 같다.
export type Vote = { table: string | null; share: number; top_score: number } | null;
export function decide({ frame, cls, picks, name, safety = null, vote = null, locale }: {
  frame: Frame | null; cls: Cls | null; picks: ExpandedPick[]; name: string; safety?: Partial<Safety> | null; vote?: Vote; locale?: Locale;
}): { decision: boolean; lean: Lean | null; review_log: Record<string, unknown> | null; lowered: boolean } {
  const { tables } = bd(locale);
  const table = frame ? pkg(locale).decision.pickTable({ frame, cls, tables, safety }) : null;
  const decision = Boolean(table && pkg(locale).decision.isDecisionFrame(frame));
  let lean = decision && table ? pkg(locale).decision.lean({ picks, type: table, tables, name, frame }) : null;
  let review_log: Record<string, unknown> | null = null;
  let lowered = false;
  if (vote) {
    const r = afterFrame({ frame, lean, vote, tables });
    lean = r.lean;
    review_log = r.review_log;
    lowered = Boolean(r.second_opinion?.lowered);
  }
  return { decision: Boolean(lean), lean, review_log, lowered };
}

// C 사용자 메시지. 패키지에는 v4용 입력 조립 코드가 없어서, 프롬프트의 [입력] 목록(worry_text·worry_frame·
// direction_lean·cards)에 맞춰 v3 입력(buildLinkUserBlock) 뒤에 고민 틀과 방향을 덧붙인다. 고민 미작성이면 null.
export function buildCUserBlock({ name, worryText, cls, picks, frame, lean, locale }: {
  name: string; worryText: string | null; cls: Cls | null; picks: ExpandedPick[]; frame: Frame | null; lean: Lean | null; locale?: Locale;
}): string | null {
  const { data } = bd(locale);
  const base = pkg(locale).assemble.buildLinkUserBlock({ name, worryText, cls, picks, data });
  if (!base) return null;
  return base.replace("</user_data>", `worry_frame=${JSON.stringify(frame ?? null)}\ndirection_lean=${JSON.stringify(leanInput(lean))}\n</user_data>`);
}

// 방향(direction_lean) 입력 칸 — C·D·E1·E2가 같은 모양을 받는다.
function leanInput(lean: Lean | null) {
  return lean
    ? {
        decision: true, side: lean.side, option: lean.option, other: lean.other, strength: lean.strength,
        with_condition: lean.with_condition, cards: lean.cards.map((c) => ({ position: c.position, score: c.score, weight: c.weight, meaning: c.meaning })),
      }
    : null;
}

// v4.2 ③ 카드별 이유 3줄(이유 문장 DB — 5쪽에 이미 보인 문장). D·E1·E2 입력 card_reasons. 결정형이 아니면 넣지 않는다.
function withReasons(block: string, lean: Lean | null): string {
  const reasons = lean ? lean.cards.map((c) => (c.reason ? `${c.position}: ${c.reason}` : null)).filter(Boolean) : [];
  return reasons.length ? block.replace("</user_data>", `card_reasons=${JSON.stringify(reasons)}\n</user_data>`) : block;
}

// D 사용자 메시지(결제 후 5·6쪽). 프롬프트 [입력]: worry_text, worry_frame, direction_lean, cards, crisis_level, violence_flag.
// v3 D 입력(buildStoryUserBlock = C 입력 + 안전 칸) 뒤에 고민 틀과 방향을 덧붙인다(C와 같은 방법). 고민 미작성이면 null.
export function buildDUserBlock({ name, worryText, cls, picks, frame, lean, safety, locale }: {
  name: string; worryText: string | null; cls: Cls | null; picks: ExpandedPick[]; frame: Frame | null; lean: Lean | null; safety: Safety; locale?: Locale;
}): string | null {
  const { data } = bd(locale);
  const base = pkg(locale).assemble.buildStoryUserBlock({ name, worryText, cls, picks, data, safety });
  if (!base) return null;
  return withReasons(base.replace("</user_data>", `worry_frame=${JSON.stringify(frame ?? null)}\ndirection_lean=${JSON.stringify(leanInput(lean))}\n</user_data>`), lean);
}

// v4.2: E를 둘로 나눠 D와 함께 동시에 부른다(속도). E1 = 7쪽(방향·흐름·이번 주 계획), E2 = 8쪽 처방 2 + 9쪽 '3일 안에'·'이번 주'.
// [입력] worry_text, worry_frame, direction_lean, card_reasons, cards, already_shown(5·6쪽 글 — D와 동시라 아직 없어서 넣지 않음),
// E2만 db_today(9쪽 '오늘' 실천 — 코드가 앞으로의 열쇠 카드로 DB에서 고른 것: title·how — 같은 행동을 쓰지 않게).
type EArgs = { name: string; worryText: string | null; cls: Cls | null; picks: ExpandedPick[]; frame: Frame | null; lean: Lean | null; locale?: Locale; now?: Date };
function eBase(args: EArgs): string | null {
  const { lean } = args;
  const base = buildCUserBlock(args);
  return base ? withReasons(base, lean) : null;
}
export function buildE1UserBlock(args: EArgs): string | null {
  const base = eBase(args);
  // v4.3: E1 입력 answer_first(7쪽 맨 위 코드 문장 — 반대되는 말을 쓰지 않게). 없으면 null.
  if (!base || args.locale === "en") return base;
  const af = answerFirstFor({ frame: args.frame, lean: args.lean, picks: args.picks, now: args.now ?? new Date(), locale: args.locale });
  return base.replace("</user_data>", `answer_first=${JSON.stringify(af ? af.text : null)}\n</user_data>`);
}
export function buildE2UserBlock(args: EArgs): string | null {
  const { data } = bd(args.locale);
  const base = eBase(args);
  if (!base) return null;
  const key = args.picks[2];
  const today = key ? pkg(args.locale).pages.todayFromDb(data, { no: key.card.no, reversed: Boolean(key.reversed) }, args.lean) : null;
  return today ? base.replace("</user_data>", `db_today=${JSON.stringify({ title: today.title, how: today.how })}\n</user_data>`) : base;
}

// 10쪽 조립(결제 후, v4.2 — 패키지가 처음부터 10쪽). sa = parseStoryApply 결과(D, 탈락 칸은 null → DB 문장), E = mergeE(E1, E2)(둘 다 탈락이면 null → 대체 경로).
// 순서·인자는 패키지 fixtures/runCase.mjs와 같다.
export function buildPaidPages({ name, cls, picks, safety, worryText, frame, lean, C, sa, E, locale, now }: {
  name: string; cls: Cls | null; picks: ExpandedPick[]; safety: Safety; worryText: string; frame: Frame | null; lean: Lean | null; C: any | null; sa: any | null; E: any | null; locale?: Locale; now?: Date;
}): any[] {
  const { data } = bd(locale);
  const base = pkg(locale).assemble.buildPages({
    name, cls, picks, data, links: C?.links ?? null, safety, worryText: worryText || "", paid: true,
    story: sa?.story ?? null, apply: sa?.apply ?? null, key: sa?.key ?? null, storyHead: sa?.storyHead ?? null, applyHead: sa?.applyHead ?? null,
  });
  const pages = pkg(locale).pages.buildPagesV4({ base, frame, lean, C, E: E ?? null, name, paid: true, data, safety });
  // 3쪽·5쪽 "카드 내용을 종합하면" 한 문장은 한국어 활용형을 바꾸는 코드라 영문판에는 쓰지 않는다.
  const gisted = locale === "en" ? pages : applyCardGist(pages, lean, summaryTitle(locale), { hideSummary: false });
  const af = answerFirstFor({ frame, lean, picks, now: now ?? new Date(), locale });
  return reorderSecret(withAnswerFirst(gisted, af, frame), { paid: true, name, cls, frame, lean, picks, locale });
}

// 결과 쪽 순서 바꾸기 + 세 번째 카드 시크릿(owner 2026-11-02) — lib/tarot-glue/secretThird.ts
export function reorderSecret(pages: any[], { paid, name, cls, frame, lean, picks, locale }: { paid: boolean; name: string; cls: Cls | null; frame: Frame | null; lean: Lean | null; picks: ExpandedPick[]; locale?: Locale }): any[] {
  const { data, midDb } = bd(locale);
  const CR = data.copy.result as any;
  return secretThird(pages, {
    paid, name, frame: frame as any, lean: lean as any, picks,
    reading: pkg(locale).assemble.readingSentence({ name, cls, data }),
    copy: CR.secret3 as SecretCopy,
    frameTitle: String(CR.v4?.frame_title ?? "**이번 고민에서 끝까지 함께 볼 것**"),
    teaser5: (CR.pages as { key: string; teaser?: string }[]).find((x) => x.key === "story")?.teaser ?? null,
    mid: midDb as unknown as MidDb,
    // v4.3: 중간 결과 묶음은 세부 영역·연애 단계로(v43.midAreaKey — 취업·시험·솔로·짝사랑/썸·이별 뒤)
    domain: locale === "en" ? cls?.domain ?? null : midAreaKey(frame, cls, midDb),
    // v4.3: '답은 아직…' 문단 뒤 듣고 싶은 답에 맞춘 예고(v43.teaserLine). 영문판은 문구가 없어 빼둔다.
    teaser: locale === "en" || !CR.v43 ? null : teaserLine({ frame, lean, name, data }),
    areaPhrase: locale === "en" ? null : (frame?.area && CR.v43?.area_phrases?.[frame.area]) || null,
  });
}
const summaryTitle = (locale?: Locale) => String((bd(locale).data.copy.result as any).v4?.summary_title ?? "세 장을 종합하면 이렇습니다");

// 10쪽 조립(결제 전). C는 parseC 결과(통과한 칸만), D·E는 결제 뒤에만 생기므로 지금은 없음.
export function buildUnpaidPages({ name, cls, picks, safety, worryText, frame, lean, C, locale }: {
  name: string; cls: Cls | null; picks: ExpandedPick[]; safety: Safety; worryText: string; frame: Frame | null; lean: Lean | null; C: any | null; locale?: Locale;
}): any[] {
  const { data } = bd(locale);
  const base = pkg(locale).assemble.buildPages({ name, cls, picks, data, links: C?.links ?? null, safety, worryText: worryText || "", paid: false });
  // 5쪽 카드별 이유 목록은 결제 후에만(owner 2026-10-27) — 대신 첫 줄 뒤에 "카드 내용을 종합하면 …" 한 문장.
  const v4pages = pkg(locale).pages.buildPagesV4({ base, frame, lean, C, E: null, name, paid: false, data, safety });
  // 5쪽 카드별 이유 목록은 결제 후에만 — 영문판도 목록은 숨기되, 한국어 활용형 한 문장(applyCardGist)은 쓰지 않는다.
  const pages = applyCardGist(v4pages, lean, summaryTitle(locale), { hideSummary: true, noGist: locale === "en" });
  // 7쪽(잠긴 쪽) 예고를 카드 결과의 풀리는 속도에 맞춰(owner 2026-10-21 "카드는 앞으로 {해결된다}고 말해요, 이유는 다음과 같아요").
  // 속도는 7쪽 흐름 판정과 같은 점수(comboScore) — 결정형의 '어느 쪽'은 드러내지 않는다.
  const teaser = paceTeaser(pkg(locale).assemble.comboScore({ picks, data, cls, worryText: worryText || "" }).pace, locale);
  const withTeaser = teaser ? pages.map((p) => (p.page === 7 ? { ...p, teaser } : p)) : pages;
  // 블러 아래 고정 예시(민준님 예시)를 이 사람의 이름·카드 이름으로 바꿔 보낸다(owner 2026-10-30: 다른 고객 리포트로 오해).
  // 내용(해석 문장)은 여전히 고정 예시라 이 사람의 결제 본문은 보내지 않는다.
  // 세 번째 카드 이름은 결제 전에는 보내지 않는다(owner 2026-11-02 시크릿) — 예시 속 세 번째 카드 자리는 "세 번째 카드"로.
  const names = picks.map((p, i) => (i === 2 ? (locale === "en" ? "the third card" : "세 번째 카드") : String(p.card?.name ?? "")));
  // v2.3.2부터 locked5는 {note, text}(가상 인물·카드 이름 없음). 예전 문자열 형식도 받는다.
  const l5 = (data.copy.result as any).blur_samples?.locked5;
  const locked5 = String((l5 && typeof l5 === "object" ? l5.text : l5) ?? "");
  const personalized = withTeaser.map((p) =>
    p.page === 5 ? { ...p, blur: personalizeBlur(locked5, name, names, locale) || null } : p.blur ? { ...p, blur: personalizeBlur(String(p.blur), name, names, locale) } : p,
  );
  return reorderSecret(personalized, { paid: false, name, cls, frame, lean, picks, locale });
}

/** 블러 고정 예시 속 이름(민준님)과 예시 카드 이름 세 장(자리 순서)을 이 사람의 것으로. */
export const BLUR_SAMPLE_NAME = "민준";
export const BLUR_SAMPLE_CARDS = ["바위 위의 쉼", "지키는 자리", "품어 주는 품"] as const;
// 영문 고정 예시의 이름·카드(data/en copy.result.blur_samples — 영어 예시가 같은 민준 예시를 옮긴 것).
export const BLUR_SAMPLE_NAME_EN = "Minjun";
export const BLUR_SAMPLE_CARDS_EN = ["Rest on the Rock", "The Guardian's Post", "The Embrace"] as const;
export function personalizeBlur(text: string, name: string, cardNames: string[], locale?: Locale): string {
  const en = locale === "en";
  let out = en ? text.replaceAll(BLUR_SAMPLE_NAME_EN, name || "you") : text.replaceAll(`${BLUR_SAMPLE_NAME}님`, name ? `${name}님` : "당신");
  (en ? BLUR_SAMPLE_CARDS_EN : BLUR_SAMPLE_CARDS).forEach((c, i) => {
    if (cardNames[i]) out = out.replaceAll(c, `\u0000${i}\u0000`);
  });
  (en ? BLUR_SAMPLE_CARDS_EN : BLUR_SAMPLE_CARDS).forEach((_c, i) => {
    if (cardNames[i]) out = out.replaceAll(`\u0000${i}\u0000`, cardNames[i]);
  });
  return out;
}

/** 7쪽 예고 문장(데이터 copy.result.v4.teaser7_pace + pace_phrases). 문구가 없으면 null(패키지 기본 예고 그대로). */
export function paceTeaser(pace: "near" | "step" | "slow", locale?: Locale): string | null {
  const v4 = (bd(locale).data.copy.result as any).v4 ?? {};
  const tpl: string | undefined = v4.teaser7_pace;
  const phrase: string | undefined = v4.pace_phrases?.[pace];
  return tpl && phrase ? tpl.replace("{pace}", phrase) : null;
}

// 결제 전 응답에 실을 칸만 고른다(허용 목록). 특히 5쪽 locked(결론 "세 장을 합치면 ‘○○’ 쪽이…"부터)와
// combo·map(점수·읽기 지도 — 결론을 짐작할 수 있음)은 빼고, 6~10쪽은 본문 없이 제목·예고·고정 예시(blur)만.
// 블러는 CSS로 가리는 게 아니라 데이터가 없는 상태여야 한다(스펙 11장 5번).
// fineprint = v4.1 watch(주의) 안내 한 줄 — 마지막 쪽 맨 아래 작은 글씨, 결제 전에도 보인다(README_v4).
const PAGE_KEYS = ["page", "title", "access", "question", "saysTitle", "says", "card", "body", "free", "teaser", "blur", "fineprint", "next", "back", "intro", "secret", "note"] as const;
// 고민 틀의 선택지에는 원문에 없던 쪽이라는 표시 "(암시)"가 붙는데, AI가 그 이름을 그대로 옮겨 쓰면 본문에
// "소송을 하지 않는 것 (암시)보다"처럼 보인다(owner 2026-10-22 실제 결제 리포트). 화면으로 보내는 글에서만 뗀다.
const IMPLIED = /\s*\((?:암시|implied)\)/g;
function stripImplied<T>(v: T): T {
  if (typeof v === "string") return v.replace(IMPLIED, "") as T;
  if (Array.isArray(v)) return v.map(stripImplied) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stripImplied(x)])) as T;
  return v;
}

// 화면으로 보내기 전 owner 다듬기(2026-10-22). v4.2부터 패키지가 처음부터 10쪽을 만든다(옛 8쪽 '앞으로 이렇게 바뀔 거예요'는
// 패키지·프롬프트 모두에서 없어짐 — 예전처럼 화면에서 쪽을 빼거나 번호를 당기지 않는다). 쪽 번호: 7 방향 · 8 처방 · 9 실천 · 10 쏘웰라.
const PRACTICE_PAGE = 9;
const DIRECTION_PAGE = 7;
export type TidyCtx = { other?: string | null; locale?: Locale };
export function tidyPages(pages: any[], ctx: TidyCtx = {}): any[] {
  // 아래 다듬기는 모두 한국어 문장 규칙(owner 2026-10-22) — 영문판은 그대로 보낸다.
  if (ctx.locale === "en") return pages;
  return pages
    .map((p, _i, all) => movePlan(p, all))
    .map((p) => (p.page === 5 && p.body ? { ...p, body: conclusionFirst(String(p.body)) } : p))
    .map((p) => (p.page === 6 && p.body ? { ...p, body: tidyApply(String(p.body), ctx.other ?? null) } : p))
    .map((p) => (p.page === DIRECTION_PAGE && p.body ? { ...p, body: tidyDirection(String(p.body)) } : p))
    .map((p) => (p.page === PRACTICE_PAGE && p.body ? { ...p, body: closingFirst(String(p.body)) } : p));
}

// 5쪽(결제 후): "**세 장을 합치면 ‘…’ 쪽이 ….**" 결론 줄을 "세 장을 종합하면 이렇습니다" 바로 위로(owner 2026-10-22).
export function conclusionFirst(body: string): string {
  const chunks = body.split(/\n\s*\n/);
  const ci = chunks.findIndex((c) => /^\*\*세 장을 합치면 .+\*\*$/.test(c.trim()));
  const title = summaryTitle();
  const si = chunks.findIndex((c) => c.trim().startsWith(title));
  if (ci < 0 || si < 0 || ci < si) return body;
  const [line] = chunks.splice(ci, 1);
  chunks.splice(si, 0, line);
  return chunks.join("\n\n");
}

// 6쪽 장면 문단 다듬기(owner 2026-10-22, 이미 만든 리포트에도): "예를 들어" → "카드를 종합하면", "장면이 열립니다" → "장면이 그려집니다"(10-26 owner: '이런' 없이),
// "(카드의) 앞으로의 열쇠는" → "세 번째 카드는"(뒤가 "~데 있고"면 "제일 먼저"도), 반대쪽 선택지를 되새기는 "{다른 쪽}보다 " 빼기, "~것 쪽을 가리켜요" → "~방향을 가리켜요".
// (패키지 검증기가 apply에 '예를 들어'를 요구해서 AI 지시는 그대로 두고 화면으로 보낼 때만 바꾼다.)
export function tidyApply(body: string, other: string | null): string {
  let out = body
    .replace(/(^|\n|\*\*)예를 들어\s+/g, "$1카드를 종합하면 ")
    .replace(/장면이 열립니다\./g, "장면이 그려집니다.")
    .replace(/이런 장면이 그려집니다/g, "장면이 그려집니다") // owner 2026-10-26: '이런' 빼기(이미 만든 리포트에도)
    .replace(/(?:카드의 )?앞으로의 열쇠는 (?=[^.]*?데 있고)/g, "세 번째 카드는 제일 먼저 ")
    .replace(/(?:카드의 )?앞으로의 열쇠는 /g, "세 번째 카드는 ")
    .replace(/것 쪽을 가리(켜요|킵니다)/g, "방향을 가리$1");
  const o = (other ?? "").replace(/\s*\(암시\)/g, "").trim();
  if (o) out = out.split(`${o}보다 `).join("");
  return out;
}

// 실천 카드 쪽: 마무리 문단의 첫 문장("**이 실천은 정답이 아니라 …**")을 맨 위(그림 바로 아래)로(owner 2026-10-22). 나머지 문장은 그 자리에.
export function closingFirst(body: string): string {
  const chunks = body.split(/\n\s*\n/);
  const at = chunks.findIndex((c) => /^\*\*이 실천은/.test(c.trim()));
  if (at <= 0) return body;
  const m = chunks[at].trim().match(/^(\*\*이 실천은[^*]*\*\*)\s*([\s\S]*)$/);
  if (!m) return body;
  if (m[2].trim()) chunks[at] = m[2].trim();
  else chunks.splice(at, 1);
  chunks.unshift(m[1]);
  return chunks.join("\n\n");
}

// 7쪽 글 다듬기(owner 2026-10-22) — E 프롬프트에도 같은 규칙을 넣었지만, 이미 만든 리포트와 규칙을 놓친 글을 위해 화면으로 보낼 때 한 번 더:
// ① "앞으로의 열쇠인 품어 주는 품은" → "세 번째 카드인 ‘품어 주는 품’은"(자리 이름 + 카드 이름 → 순서 + 작은따옴표 카드 이름)
// ② "‘…’ 쪽입니다. 조금 더 신중히…" → "… 쪽입니다. 다만 조금 더 신중히…"
const ORDINAL = ["첫 번째", "두 번째", "세 번째"];
export function tidyDirection(body: string): string {
  const { data } = bd();
  let out = body;
  const names = (data.cards as { name: string }[]).map((c) => c.name).sort((a, b) => b.length - a.length);
  data.positions.forEach((pos: { name: string }, i: number) => {
    for (const name of names) {
      const re = new RegExp(`${pos.name}(?:인|이자|의)?\\s*[‘'"]?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[’'"]?`, "g");
      out = out.replace(re, `${ORDINAL[i]} 카드인 ‘${name}’`);
    }
  });
  return out.replace(/(쪽(?:이에요|입니다|예요)\.(?:\*\*)?)\s+(조금 더|좀 더)/g, "$1 다만 $2");
}

// 7쪽 "…이번 주에 이것부터" 계획(언제·어디서·무엇을)은 실천 카드와 겹쳐서, 실천 카드 쪽 맨 위(안내 문단 다음)로 옮기고
// 머리말을 PLAN_MOVED_HEAD로 바꾼다(owner 2026-10-22). 7쪽에는 남기지 않는다.
export const PLAN_MOVED_HEAD = "이번 주에 이것부터 해보는게 어떨까요?";
const PLAN_HEAD_END = /이번 주에 이것부터$/;
function splitPlan(body: string): { rest: string; plan: string[] | null } {
  const chunks = body.split(/\n\s*\n/);
  const at = chunks.findIndex((c) => {
    const ls = c.split("\n").map((l) => l.trim());
    return PLAN_HEAD_END.test(ls[0]) && ls.length > 1 && ls.slice(1).every((l) => l.startsWith("◦ "));
  });
  if (at < 0) return { rest: body, plan: null };
  const plan = chunks[at].split("\n").slice(1).map((l) => l.trim());
  chunks.splice(at, 1);
  return { rest: chunks.join("\n\n"), plan };
}
function movePlan(p: any, all: any[]): any {
  const src = all.find((x) => x.page === DIRECTION_PAGE);
  const found = src?.body ? splitPlan(String(src.body)) : null;
  if (!found?.plan) return p;
  if (p.page === DIRECTION_PAGE) return { ...p, body: found.rest };
  if (p.page === PRACTICE_PAGE && p.body) {
    const chunks = String(p.body).split(/\n\s*\n/);
    chunks.splice(Math.min(1, chunks.length), 0, [PLAN_MOVED_HEAD, ...found.plan].join("\n"));
    return { ...p, body: chunks.join("\n\n") };
  }
  return p;
}

export function sanitizeUnpaid(pages: any[], locale?: Locale): any[] {
  return tidyPages(stripImplied(pages), { locale }).map((p) => {
    const out: Record<string, unknown> = {};
    for (const k of PAGE_KEYS) if (p[k] !== undefined) out[k] = p[k];
    // 5쪽은 무료 부분(free)만 — 결제 전 원본 body가 비어 있어도 혹시 결론이 섞여 들어오지 않게 비운다.
    // 4쪽(세 번째 카드, owner 2026-11-02 시크릿)부터는 본문을 싣지 않는다.
    if (p.page >= 4) out.body = null;
    if (p.page >= 4) for (const k of ["card", "free", "says", "question", "saysTitle"]) delete out[k];
    if (out.card && typeof out.card === "object") {
      const c = out.card as Record<string, unknown>;
      // arcana(원래 타로 카드 이름)는 2~4쪽 카드 정보에 보이는 공개 정보(시안 "원래 타로 카드 · 정의(Justice)").
      out.card = { position: c.position, name: c.name, character: c.character, reversed: c.reversed, keywords: c.keywords, arcana: c.arcana, image: c.image };
    }
    return out;
  });
}

// 결제 후 응답: 같은 허용 목록이지만 본문(body)을 그대로 싣는다(결론·6~10쪽 포함). 화면에 안 쓰는 내부 칸(combo·map·locked)은 뺀다.
export function sanitizePaid(pages: any[], ctx: TidyCtx = {}): any[] {
  return tidyPages(stripImplied(pages), ctx).map((p) => {
    const out: Record<string, unknown> = {};
    for (const k of PAGE_KEYS) if (p[k] !== undefined) out[k] = p[k];
    return out;
  });
}

// 결과 화면 줄 해석기(lib/client/pageBlocks.ts)에 넘길 설정. 소제목 목록은 패키지(pagesV4.js의 SUBHEADS)와
// 데이터 문구(copy.result.v4·flow_titles)를 합친다 — 데이터 쪽 문구가 바뀌어도 소제목으로 그려지게.
export function resultParseOpts(locale?: Locale) {
  const { data } = bd(locale);
  const r = data.copy.result as any;
  const v4 = r.v4 ?? {};
  const fromData = [v4.summary_title, v4.direction_title, v4.decide_title, v4.plan_head?.stay, v4.plan_head?.move, v4.plan_head?.none,
    ...Object.values(r.flow_titles ?? {}), r.tendency_title].filter((x): x is string => typeof x === "string");
  const sec = [r.reflect_title].filter((x): x is string => typeof x === "string");
  return {
    subheads: [...new Set([...pkg(locale).pages.SUBHEADS, ...fromData, PLAN_MOVED_HEAD])].filter((x) => !sec.includes(x)),
    secHeads: sec,
    subMaxLen: locale === "en" ? 110 : 40,
    planHeadSuffix: locale === "en" ? "where to start this week" : "이번 주에 이것부터",
    positions: data.positions.map((p) => p.name),
    forceLabels: r.force_labels as { up: string[]; flat: string[]; down: string[] },
  };
}
