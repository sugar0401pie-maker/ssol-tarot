// v4.0 결과 파이프라인의 순수 부분(네트워크 없음 → 단위 테스트 가능). 서버(lib/server/session.ts)가 이 함수들만 부른다.
//   ① 방향 계산(decision.js)  ② C 호출 입력 만들기  ③ 10쪽 조립(buildPages → buildPagesV4, v4.2)  ④ 결제 전 응답 거르기
// 원본 패키지 코드(lib/tarot/*.js)는 바꾸지 않는다.
import data from "../../data/tarot_data.json" with { type: "json" };
import tables from "../../data/decision_tables.json" with { type: "json" };
import { pickTable, isDecisionFrame, lean as leanOf, type Lean } from "../tarot/decision.js";
import { afterFrame } from "../tarot/frameInput.js";
import { buildPages, buildLinkUserBlock, buildStoryUserBlock, comboScore } from "../tarot/assembleReport.js";
import { buildPagesV4, SUBHEADS, todayFromDb } from "../tarot/pagesV4.js";
import type { ExpandedPick, Safety } from "../tarot/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Frame = any;
type Cls = any;

// 결정형 고민이면 카드 점수로 방향을 정한다(AI는 결론을 바꾸지 못함 — README_v4 R1·R2).
// frame이 없거나(미작성·A2 탈락) 점수표가 없으면 비결정형(null). 폭력 확인(violence)이면 방향을 끈다(v4.1 pickTable).
// v4.1: vote(A2를 부를 때 계산한 비슷한 정답 5개의 투표)가 있으면 두 번째 의견을 반영한다 — A2 표와 다르고 비율 ≥ 0.6이면
// 강도만 한 단계 낮춘다(쪽·선택지는 그대로). review_log는 검수 대기 기록(서버가 tarot_frame_reviews에 저장). 순서는 fixtures/runCase.mjs와 같다.
export type Vote = { table: string | null; share: number; top_score: number } | null;
export function decide({ frame, cls, picks, name, safety = null, vote = null }: {
  frame: Frame | null; cls: Cls | null; picks: ExpandedPick[]; name: string; safety?: Partial<Safety> | null; vote?: Vote;
}): { decision: boolean; lean: Lean | null; review_log: Record<string, unknown> | null; lowered: boolean } {
  const table = frame ? pickTable({ frame, cls, tables, safety }) : null;
  const decision = Boolean(table && isDecisionFrame(frame));
  let lean = decision && table ? leanOf({ picks, type: table, tables, name, frame }) : null;
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
export function buildCUserBlock({ name, worryText, cls, picks, frame, lean }: {
  name: string; worryText: string | null; cls: Cls | null; picks: ExpandedPick[]; frame: Frame | null; lean: Lean | null;
}): string | null {
  const base = buildLinkUserBlock({ name, worryText, cls, picks, data });
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
export function buildDUserBlock({ name, worryText, cls, picks, frame, lean, safety }: {
  name: string; worryText: string | null; cls: Cls | null; picks: ExpandedPick[]; frame: Frame | null; lean: Lean | null; safety: Safety;
}): string | null {
  const base = buildStoryUserBlock({ name, worryText, cls, picks, data, safety });
  if (!base) return null;
  return withReasons(base.replace("</user_data>", `worry_frame=${JSON.stringify(frame ?? null)}\ndirection_lean=${JSON.stringify(leanInput(lean))}\n</user_data>`), lean);
}

// v4.2: E를 둘로 나눠 D와 함께 동시에 부른다(속도). E1 = 7쪽(방향·흐름·이번 주 계획), E2 = 8쪽 처방 2 + 9쪽 '3일 안에'·'이번 주'.
// [입력] worry_text, worry_frame, direction_lean, card_reasons, cards, already_shown(5·6쪽 글 — D와 동시라 아직 없어서 넣지 않음),
// E2만 db_today(9쪽 '오늘' 실천 — 코드가 앞으로의 열쇠 카드로 DB에서 고른 것: title·how — 같은 행동을 쓰지 않게).
function eBase({ name, worryText, cls, picks, frame, lean }: {
  name: string; worryText: string | null; cls: Cls | null; picks: ExpandedPick[]; frame: Frame | null; lean: Lean | null;
}): string | null {
  const base = buildCUserBlock({ name, worryText, cls, picks, frame, lean });
  return base ? withReasons(base, lean) : null;
}
export function buildE1UserBlock(args: { name: string; worryText: string | null; cls: Cls | null; picks: ExpandedPick[]; frame: Frame | null; lean: Lean | null }): string | null {
  return eBase(args);
}
export function buildE2UserBlock(args: { name: string; worryText: string | null; cls: Cls | null; picks: ExpandedPick[]; frame: Frame | null; lean: Lean | null }): string | null {
  const base = eBase(args);
  if (!base) return null;
  const key = args.picks[2];
  const today = key ? todayFromDb(data, { no: key.card.no, reversed: Boolean(key.reversed) }, args.lean) : null;
  return today ? base.replace("</user_data>", `db_today=${JSON.stringify({ title: today.title, how: today.how })}\n</user_data>`) : base;
}

// 10쪽 조립(결제 후, v4.2 — 패키지가 처음부터 10쪽). sa = parseStoryApply 결과(D, 탈락 칸은 null → DB 문장), E = mergeE(E1, E2)(둘 다 탈락이면 null → 대체 경로).
// 순서·인자는 패키지 fixtures/runCase.mjs와 같다.
export function buildPaidPages({ name, cls, picks, safety, worryText, frame, lean, C, sa, E }: {
  name: string; cls: Cls | null; picks: ExpandedPick[]; safety: Safety; worryText: string; frame: Frame | null; lean: Lean | null; C: any | null; sa: any | null; E: any | null;
}): any[] {
  const base = buildPages({
    name, cls, picks, data, links: C?.links ?? null, safety, worryText: worryText || "", paid: true,
    story: sa?.story ?? null, apply: sa?.apply ?? null, key: sa?.key ?? null, storyHead: sa?.storyHead ?? null, applyHead: sa?.applyHead ?? null,
  });
  return buildPagesV4({ base, frame, lean, C, E: E ?? null, name, paid: true, data, safety });
}

// 10쪽 조립(결제 전). C는 parseC 결과(통과한 칸만), D·E는 결제 뒤에만 생기므로 지금은 없음.
export function buildUnpaidPages({ name, cls, picks, safety, worryText, frame, lean, C }: {
  name: string; cls: Cls | null; picks: ExpandedPick[]; safety: Safety; worryText: string; frame: Frame | null; lean: Lean | null; C: any | null;
}): any[] {
  const base = buildPages({ name, cls, picks, data, links: C?.links ?? null, safety, worryText: worryText || "", paid: false });
  const pages = buildPagesV4({ base, frame, lean, C, E: null, name, paid: false, data, safety });
  // 7쪽(잠긴 쪽) 예고를 카드 결과의 풀리는 속도에 맞춰(owner 2026-10-21 "카드는 앞으로 {해결된다}고 말해요, 이유는 다음과 같아요").
  // 속도는 7쪽 흐름 판정과 같은 점수(comboScore) — 결정형의 '어느 쪽'은 드러내지 않는다.
  const teaser = paceTeaser(comboScore({ picks, data, cls, worryText: worryText || "" }).pace);
  return teaser ? pages.map((p) => (p.page === 7 ? { ...p, teaser } : p)) : pages;
}

/** 7쪽 예고 문장(데이터 copy.result.v4.teaser7_pace + pace_phrases). 문구가 없으면 null(패키지 기본 예고 그대로). */
export function paceTeaser(pace: "near" | "step" | "slow"): string | null {
  const v4 = (data.copy.result as any).v4 ?? {};
  const tpl: string | undefined = v4.teaser7_pace;
  const phrase: string | undefined = v4.pace_phrases?.[pace];
  return tpl && phrase ? tpl.replace("{pace}", phrase) : null;
}

// 결제 전 응답에 실을 칸만 고른다(허용 목록). 특히 5쪽 locked(결론 "세 장을 합치면 ‘○○’ 쪽이…"부터)와
// combo·map(점수·읽기 지도 — 결론을 짐작할 수 있음)은 빼고, 6~10쪽은 본문 없이 제목·예고·고정 예시(blur)만.
// 블러는 CSS로 가리는 게 아니라 데이터가 없는 상태여야 한다(스펙 11장 5번).
// fineprint = v4.1 watch(주의) 안내 한 줄 — 마지막 쪽 맨 아래 작은 글씨, 결제 전에도 보인다(README_v4).
const PAGE_KEYS = ["page", "title", "access", "question", "saysTitle", "says", "card", "body", "free", "teaser", "blur", "fineprint", "next", "back"] as const;
// 고민 틀의 선택지에는 원문에 없던 쪽이라는 표시 "(암시)"가 붙는데, AI가 그 이름을 그대로 옮겨 쓰면 본문에
// "소송을 하지 않는 것 (암시)보다"처럼 보인다(owner 2026-10-22 실제 결제 리포트). 화면으로 보내는 글에서만 뗀다.
const IMPLIED = /\s*\(암시\)/g;
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
export type TidyCtx = { other?: string | null };
export function tidyPages(pages: any[], ctx: TidyCtx = {}): any[] {
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
  const title = String((data.copy.result as any).v4?.summary_title ?? "세 장을 종합하면 이렇습니다");
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

export function sanitizeUnpaid(pages: any[]): any[] {
  return tidyPages(stripImplied(pages)).map((p) => {
    const out: Record<string, unknown> = {};
    for (const k of PAGE_KEYS) if (p[k] !== undefined) out[k] = p[k];
    // 5쪽은 무료 부분(free)만 — 결제 전 원본 body가 비어 있어도 혹시 결론이 섞여 들어오지 않게 비운다.
    if (p.page >= 5) out.body = null;
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
export function resultParseOpts() {
  const r = data.copy.result as any;
  const v4 = r.v4 ?? {};
  const fromData = [v4.summary_title, v4.direction_title, v4.decide_title, v4.plan_head?.stay, v4.plan_head?.move, v4.plan_head?.none,
    ...Object.values(r.flow_titles ?? {}), r.tendency_title].filter((x): x is string => typeof x === "string");
  const sec = [r.reflect_title].filter((x): x is string => typeof x === "string");
  return {
    subheads: [...new Set([...SUBHEADS, ...fromData, PLAN_MOVED_HEAD])].filter((x) => !sec.includes(x)),
    secHeads: sec,
    planHeadSuffix: "이번 주에 이것부터",
    positions: data.positions.map((p) => p.name),
    forceLabels: r.force_labels as { up: string[]; flat: string[]; down: string[] },
  };
}
