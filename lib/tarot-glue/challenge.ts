// 9쪽 작심삼일 챌린지 · 10쪽 쏘웰라 대화 화면 (owner 2026-11-26 — 패키지 v3.13 위에 얹음).
// - 9쪽 '이번 주 실천 카드'(오늘·3일 안에·이번 주, 7쪽에서 옮겨 온 '이번 주에 이것부터' 계획 포함)를 작심삼일 챌린지가 통째로 가져간다.
//   활동 고르기·문장 DB는 패키지 lib/tarot/challenge.js(buildChallenge) 그대로. AI(E2)가 다섯 칸을 고민에 맞게 다시 쓰고,
//   칸마다 검사해서 떨어진 칸은 DB 문장을 쓴다(fail safe — 챌린지가 비지 않게).
// - 결과를 만들 때 tarot_sessions.report.challenge에 쏘웰라가 읽는 모양({day1:{title,description}, …})으로 저장한다(쏘웰라 요청 2026-11-26).
// - 10쪽: 맨 위 대화 그림(사용자 고민 한 줄 → 쏘웰라가 챌린지를 물음 → 사용자 답 1개 무작위) → 기존 안내 → 풍등 한 줄·배너 → [쏘웰라 3일 무료로 시작하기].
/* eslint-disable @typescript-eslint/no-explicit-any */
import cdbJson from "../../data/challenge_lines.json" with { type: "json" };
import { buildChallenge, challengePage9, domainOf, type Challenge, type ChallengeDay } from "../tarot/challenge.js";
import { forbiddenHitsV4 } from "../tarot/assembleReport.js";
import { deepOf } from "./reportLines.ts";
import type { ExpandedPick } from "../tarot/types";

export const CDB = cdbJson as any;
export const CHALLENGE_PAGE = 9;
export const SOWELLA_PAGE = 10;
export const DAY_KEYS = ["day1", "day2", "day3", "week", "month"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

const cardKey = (p: ExpandedPick | undefined) => (p ? `${p.card.no}_${p.reversed ? "rev" : "up"}` : null);

/** 이 결과의 기본 챌린지(DB 문장) — 세부 고민·첫 기저 생각(갈래)·2·3번 카드로 고른다(결정론적). */
export function challengeFor(ctx: { frame: any | null; picks: ExpandedPick[]; safety: { level?: string | null; violence?: boolean } | null; worryText: string; freeLines?: { p1?: string; p2?: string } | null }): Challenge {
  let first: { code?: string; kind?: string } | null = null;
  try {
    const d = deepOf(ctx) as any;
    first = d?.thought_branches?.[0] ?? null;
  } catch {
    first = null;
  }
  return buildChallenge({ subId: ctx.frame?.sub_id ?? null, branchKind: first?.kind ?? null, branchCode: first?.code ?? null, card2: cardKey(ctx.picks[1]), card3: cardKey(ctx.picks[2]) }, CDB);
}

/** E2 입력 db_challenge — 활동과 칸마다 기본 문장(AI가 고민에 맞게 다시 쓸 재료). */
export function dbChallengeInput(ch: Challenge) {
  const out: Record<string, unknown> = { activity: ch.family_name };
  for (const d of ch.days) out[d.key] = d.title ? { title: d.title, text: d.text, ...(d.tie ? { tie: d.tie } : {}) } : { text: d.text };
  return out;
}

// AI 한 칸 검사: 제목 4~32자, 설명 20~140자, 한 줄, 별표·영문 낱말·중괄호 없음, 금지어 없음, 요(다)로 끝남
const okSlot = (x: any): x is { title: string; text: string } => {
  if (!x || typeof x.title !== "string" || typeof x.text !== "string") return false;
  const t = x.title.trim(), b = x.text.trim();
  if (t.length < 4 || t.length > 32 || b.length < 20 || b.length > 140) return false;
  if (/[\n*{}]|[A-Za-z]{3,}/.test(t + b)) return false;
  if (!/(요|다)\.$/.test(b)) return false;
  return !forbiddenHitsV4(`${t}\n${b}`).length;
};

/** AI(E2 challenge)를 칸마다 DB 문장 위에 덮는다. 떨어진 칸은 DB 그대로(ai: false). */
export function mergeAiChallenge(ch: Challenge, ai: any): { ch: Challenge; ai: Record<DayKey, boolean> } {
  const flags = {} as Record<DayKey, boolean>;
  const days = ch.days.map((d) => {
    const s = ai && typeof ai === "object" ? ai[d.key] : null;
    const ok = okSlot(s);
    flags[d.key as DayKey] = ok;
    // AI가 쓴 칸은 고민과 이미 이어 썼으므로 DB의 고민 줄(tie)은 붙이지 않는다
    return ok ? { ...d, title: s.title.trim(), text: s.text.trim(), tie: undefined } : d;
  });
  return { ch: { ...ch, days }, ai: flags };
}

const firstSentence = (t: string) => {
  const m = t.trim().match(/^(.+?[.?!])(\s+[\s\S]*)?$/);
  return m ? { head: m[1].trim(), rest: (m[2] ?? "").trim() } : { head: t.trim(), rest: "" };
};

/** tarot_sessions.report.challenge(쏘웰라가 읽는 모양) — day1~month마다 title·description(+ 화면·인증에 쓰는 칸). */
// 쏘웰라 요청(2026-11-26): 1주일·1달 title은 고정 "1주일 이어 가기"·"1달 이어 가기", 할 일은 description에(활동 제목 — 설명).
export const LATER_TITLE: Partial<Record<DayKey, string>> = { week: "1주일 이어 가기", month: "1달 이어 가기" };
export function toReportChallenge(ch: Challenge, ai: Partial<Record<DayKey, boolean>> = {}) {
  const out: Record<string, unknown> = {};
  for (const d of ch.days) {
    // 1·3일차 DB 문장은 제목이 따로 없어 스토리 한 줄("1일차, 내 기운 체크" → "내 기운 체크")을 제목으로, 문장 전체를 설명으로
    const fixed = LATER_TITLE[d.key as DayKey];
    const short = String(d.story || "").replace(/^(작심삼일\s*)?(1일차|3일 완주|작심삼일 완주)\s*,\s*/, "").trim();
    out[d.key] = {
      title: fixed ?? d.title ?? (short || firstSentence(d.text).head),
      description: fixed ? (d.title ? `${d.title} — ${d.text}` : d.text) : d.text,
      // 화면을 다시 만들 때 쓰는 원래 칸(활동 제목·설명)
      activity_title: d.title ?? null, text: d.text,
      label: d.label, proof: d.proof, story: d.story, practice_id: d.practice_id ?? null, ai: !!ai[d.key as DayKey],
    };
  }
  return { ...out, activity: { family: ch.family, name: ch.family_name }, domain: ch.domain, pair: ch.pair, source: "tarot", schema: "tarot.challenge.v1" } as Record<string, any>;
}

/** 저장된 report.challenge 중 AI가 쓴 칸을 기본 챌린지 위에 다시 덮는다(화면을 열 때마다 같은 결과). */
export function applyStored(ch: Challenge, stored: any): Challenge {
  if (!stored || typeof stored !== "object") return ch;
  const days = ch.days.map((d) => {
    const s = stored[d.key];
    if (!s || !s.ai) return d;
    const title = typeof s.activity_title === "string" ? s.activity_title : s.title, text = typeof s.text === "string" ? s.text : s.description;
    if (typeof title !== "string" || typeof text !== "string") return d;
    return { ...d, title, text, tie: undefined } as ChallengeDay;
  });
  return { ...ch, days };
}

// 결과 번호(또는 고민 글)로 고정 무작위 — 다시 열어도 같은 답
const hashOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export type SowellaChat = { from: "user" | "sowella"; text: string }[];
/** 10쪽 대화 그림(owner 2026-11-26): 쏘웰라가 2일차 챌린지를 권함 → 사용자 답. 사용자 고민 말풍선은 없음(owner 결정). */
export function sowellaChat(a: { name: string; worryText: string; ch: Challenge; ui: any; seed: string }): SowellaChat {
  const day2 = a.ch.days.find((d) => d.key === "day2");
  const ask = String(a.ui.sowella_ask).replaceAll("{name}", a.name || "").replace("{day2}", day2?.title ?? day2?.text ?? "");
  const replies: string[] = a.ui.user_replies ?? [];
  const reply = replies.length ? replies[hashOf(a.seed || a.name) % replies.length] : "";
  return [{ from: "sowella", text: ask }, ...(reply ? [{ from: "user" as const, text: reply }] : [])];
}

/** 결제 후 9·10쪽을 챌린지·쏘웰라 대화 화면으로 바꾼다(한국어판만). 쪽 제목은 데이터(pages) 그대로. */
export function applyChallengePages(pages: any[], a: { ch: Challenge; name: string; worryText: string; ui: any; seed: string }): any[] {
  return pages.map((p) => {
    if (p.page === CHALLENGE_PAGE) {
      const c = challengePage9(a.ch, CDB);
      return { ...p, body: c.body, challenge: { ...c.challenge, heading: CDB.page9.title } };
    }
    if (p.page === SOWELLA_PAGE) {
      return { ...p, chat: sowellaChat(a), lantern: { line: a.ui.lantern_line, alt: a.ui.lantern_alt } };
    }
    return p;
  });
}

export { domainOf };
