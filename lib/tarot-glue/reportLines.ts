// v2.3.15~17 문장 DB(data/report_lines.json, 고르는 함수는 패키지 lib/tarot/reportLines.js)를 결과 쪽에 끼운다(owner 2026-11-14 "3번 전부").
// 쪽 번호는 화면 순서(reorderSecret 뒤): 1·2 카드 · 3 고민 풀어보기 · 4 세 번째 카드 · 5 세 장 이야기 · 7 방향 · 8 처방 · 9 실천.
// 끼우는 곳(패키지 문장DB_v2.3.15.md '끼울 자리'):
//   ① 1·2쪽 카드 문장의 셋째 문장 → 고민 영역 문장(areaVariant·scene) — 결제 전에도
//   ② 3쪽(고민 틀을 못 만든 경우) 고민 한 번 인용(fallbackQuote) — 결제 전에도
//   ③ 5쪽 머리 문장(page5Head — '생각보다 분명한 답' 대신), 카드별 한 줄(cardLine) — 결제 후
//   ④ 선택지 이름: DB 선택지(예측·암시)면 정식 이름은 3·7·10쪽 첫 번째만, 나머지는 별칭(aliasFor) — 결제 후. 사용자가 직접 쓴 선택지는 그대로
//   ⑤ 7쪽 조건문(page7Cond) — 결제 후
//   ⑥ 9쪽 '오늘'·'3일 안에' → 틀별 실천 + 장면 머리말(pickPractices·cueFor), AI 계획이 없으면 계획 대체 문장(planLine) — 결제 후
// 넣지 않은 것: 3쪽 끝 예고(page3Tail) — 결제율을 올린 3쪽 멈춤 문단(owner 문구)을 대신하고, 카드 모양이 세 번째 카드의 방향을 드러내서(결제 전 비공개) 보류.
// 원본 패키지 코드는 바꾸지 않는다. 어느 단계든 실패하면 그 쪽은 원래 글 그대로.
import { worryType, cardPattern, page5Head, aliasFor, cardLine, areaVariant, page7Cond, fallbackQuote, planLine, cueFor, pickPractices, type Practice } from "../tarot/reportLines.js";
import { hasBatchim, hasRieulBatchim } from "../tarot/josa.js";
import rlJson from "../../data/report_lines.json" with { type: "json" };
import subDb from "../../data/worry_subtopics.json" with { type: "json" };
import type { ExpandedPick } from "../tarot/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Page = any;
export type LinesCtx = {
  paid: boolean; frame: any | null; lean: any | null; picks: ExpandedPick[]; cls: any | null;
  safety: { level?: string | null; violence?: boolean } | null; worryText: string; tables: any; seed?: number;
};
const RL = rlJson as any;
export const REPORT_LINES = RL;
const SUBS = (subDb as any).subs as Record<string, any>;
const POS = ["now", "hold"] as const;

const cardKey = (p: ExpandedPick | undefined) => (p ? `${p.card.no}_${p.reversed ? "rev" : "up"}` : "");
const safetyLevel = (s: LinesCtx["safety"]) => (s?.violence ? "violence" : s?.level || "none");

/** 고민 유형(OUTCOME·CHOICE·SITUATION). 고민 틀이 없으면 상황형. */
export function typeOf(frame: any | null): "OUTCOME" | "CHOICE" | "SITUATION" {
  if (!frame) return "SITUATION";
  // 예전 고민 틀(A2 v4.6 이전 — decision_source 칸이 없음)에 선택지가 둘 있으면 사용자가 쓴 선택지로 본다.
  if (!("decision_source" in frame) && !frame.forecast && Array.isArray(frame.options) && frame.options.length === 2) return "CHOICE";
  return worryType(frame, frame.sub_id ? SUBS[frame.sub_id] ?? null : null, RL);
}

// ① 문단 첫 덩어리(카드 고정 문장 세 개)의 셋째 문장만 바꾼다. 굵은 글씨 안이거나 문장이 셋이 안 되면 그대로.
export function replaceThirdSentence(chunk: string, line: string): string {
  const ends = [...chunk.matchAll(/[.!?](?:\*\*)?(?=\s|$)/g)].map((m) => m.index! + m[0].length);
  if (ends.length < 3) return chunk;
  const third = chunk.slice(ends[1], ends[2]);
  if (third.includes("**")) return chunk;
  return `${chunk.slice(0, ends[1])} ${line}${chunk.slice(ends[2])}`;
}
function applyScenes(pages: Page[], ctx: LinesCtx): Page[] {
  const f = ctx.frame;
  if (!f?.sub_id) return pages;
  const variant = areaVariant(f.sub_id, { confidence: f.confidence ?? "high", safety: safetyLevel(ctx.safety) }, RL);
  if (variant === "COMMON") return pages;
  return pages.map((p) => {
    if ((p.page !== 1 && p.page !== 2) || !p.body) return p;
    const line = RL.scene[cardKey(ctx.picks[p.page - 1])]?.[variant]?.[POS[p.page - 1]];
    if (!line) return p;
    const chunks = String(p.body).split(/\n\s*\n/);
    chunks[0] = replaceThirdSentence(chunks[0], line);
    return { ...p, body: chunks.join("\n\n") };
  });
}

// ② 고민을 썼는데 고민 틀이 없으면(A2 실패) 3쪽 고민 읽기 문단 뒤에 고민을 한 번 인용
function applyQuote(pages: Page[], ctx: LinesCtx): Page[] {
  if (ctx.frame || !ctx.worryText.trim()) return pages;
  const line = fallbackQuote(ctx.worryText, "SITUATION", RL, ctx.seed ?? 0);
  if (!line) return pages;
  return pages.map((p) => {
    if (p.page !== 3 || !p.body) return p;
    const chunks = String(p.body).split(/\n\s*\n/);
    const at = chunks.findIndex((c) => c.startsWith("!! "));
    if (at < 0) return p;
    chunks.splice(at + 1, 0, line);
    return { ...p, body: chunks.join("\n\n") };
  });
}

// ④ 선택지 이름 → 별칭(조사도 받침에 맞춤)
type Names = { full: string; alias: string };
export function namesFor(ctx: Pick<LinesCtx, "frame" | "lean">): Names[] {
  const { frame, lean } = ctx;
  if (!frame || !lean) return [];
  const type = typeOf(frame);
  if (frame.decision_source === "explicit" && !frame.forecast) return []; // 사용자가 직접 쓴 선택지는 별칭을 만들지 않는다(AI 별칭은 아직 없음)
  const out: Names[] = [];
  for (const side of [0, 1]) {
    const a = aliasFor({ type: type === "SITUATION" ? "OUTCOME" : type, table: lean.table, side }, RL);
    if (a && a.full && a.alias && [lean.option, lean.other].includes(a.full)) out.push({ full: a.full, alias: a.alias });
  }
  return out;
}
const PARTICLES: [string, string][] = [["으로", "로"], ["이에요", "예요"], ["이라", "라"], ["을", "를"], ["이", "가"], ["은", "는"], ["과", "와"]];
function fixParticle(word: string, rest: string): string {
  for (const [withB, without] of PARTICLES) {
    for (const cur of [withB, without]) {
      if (!rest.startsWith(cur)) continue;
      const want = withB === "으로" ? (hasBatchim(word) && !hasRieulBatchim(word) ? "으로" : "로") : hasBatchim(word) ? withB : without;
      return want + rest.slice(cur.length);
    }
  }
  return rest;
}
/** ‘word’ 바로 뒤 조사를 word의 받침에 맞춘다(문장 DB 틀은 별칭 기준이라 다른 이름이 들어가면 어긋날 수 있음). */
export function fixQuoted(text: string, word: string): string {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`‘${esc}’([가-힣]{0,3})`, "g"), (_m, rest: string) => `‘${word}’${fixParticle(word, rest)}`);
}
/** text 안의 정식 이름을 별칭으로(keepFirst면 첫 번째 것은 정식 이름 그대로). */
export function aliasText(text: string, n: Names, keepFirst: boolean): string {
  const esc = n.full.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let seen = false;
  const out = text.replace(new RegExp(`(‘)?${esc}(’)?([가-힣]{0,3})`, "g"), (m, q1: string | undefined, q2: string | undefined, rest: string) => {
    if (keepFirst && !seen) {
      seen = true;
      return m;
    }
    const word = n.alias;
    const fixed = q2 || !q1 ? fixParticle(word, rest) : rest;
    return `${q1 ?? ""}${word}${q2 ?? ""}${fixed}`;
  });
  // 별칭이 '…쪽'이면 "‘가까워지는 쪽’ 쪽"처럼 겹치지 않게
  return out.replace(/쪽(’?) 쪽/g, "쪽$1");
}
function applyAliases(pages: Page[], ctx: LinesCtx): Page[] {
  const names = namesFor(ctx);
  if (!names.length) return pages;
  return pages.map((p) => {
    if (p.page < 4 || !p.body) return p;
    let body = String(p.body);
    for (const n of names) body = aliasText(body, n, p.page === 7 || p.page === 10);
    return { ...p, body };
  });
}

// ③ 5쪽 머리 문장 + 카드별 한 줄
const pickSignOf = (lean: any) => (lean?.side === "move" ? 1 : -1);
function applyPage5(pages: Page[], ctx: LinesCtx): Page[] {
  const { lean, frame, picks, tables } = ctx;
  if (!lean) return pages;
  const type = typeOf(frame);
  const sign = pickSignOf(lean);
  const scores = (lean.cards ?? []).map((c: any) => Number(c.score) || 0);
  const pattern = cardPattern(scores, sign);
  const names = namesFor(ctx);
  const pick = names.find((n) => n.full === lean.option)?.alias ?? lean.option;
  const head0 = page5Head({ type, pickSign: sign, pattern, pick, gap: Math.abs(Number(lean.score) || 0), seed: ctx.seed ?? 0 }, RL);
  const head = head0 ? fixQuoted(head0, pick) : head0;
  const reasons = tables?.types?.[lean.table]?.reasons ?? {};
  return pages.map((p) => {
    if (p.page !== 5 || !p.body) return p;
    const chunks = String(p.body).split(/\n\s*\n/);
    // 맨 위 "## 제목" 다음 문단의 첫 문장(C의 teaser_lead — '생각보다 분명한 답…')을 머리 문장으로
    const li = chunks.findIndex((c, i) => i > 0 && !c.startsWith("#") && !c.startsWith("**") && !c.startsWith("◦"));
    if (li > 0 && head) {
      const m = chunks[li].match(/^(.+?[.?!])(\s+[\s\S]*)?$/);
      chunks[li] = m ? `${head}${m[2] ?? ""}` : head;
    }
    // 카드별 한 줄: "◦ 지나온 길 ‘…’ — {이유}, ‘…’ 쪽을 가리켜요." → "◦ 지나온 길 ‘…’ — {카드별 한 줄}"
    let k = 0;
    const lines = chunks.map((c) =>
      c.split("\n").map((l) => {
        if (!l.startsWith("◦ ") || !l.includes(" — ") || k >= 3) return l;
        const i = k++;
        const key = cardKey(picks[i]);
        const line = cardLine({ cardKey: key, score: scores[i] ?? 0, pickSign: sign, stance: tables?.stance?.[key], tableReason: reasons[key] ?? "" }, RL);
        return line ? `${l.slice(0, l.indexOf(" — "))} — ${line}` : l;
      }).join("\n"),
    );
    return { ...p, body: lines.join("\n\n") };
  });
}

// ⑤ 7쪽 조건문
function applyPage7(pages: Page[], ctx: LinesCtx): Page[] {
  const { lean } = ctx;
  if (!lean) return pages;
  const c = page7Cond(lean.table, pickSignOf(lean), RL);
  if (!c) return pages;
  return pages.map((p) => {
    if (p.page !== 7 || !p.body) return p;
    const chunks = String(p.body).split(/\n\s*\n/);
    // 결론 목록(◦ 카드 세 줄)이 있는 문단 바로 뒤에
    const at = chunks.findIndex((x) => x.includes("\n◦ "));
    chunks.splice(at >= 0 ? at + 1 : chunks.length, 0, `${c.win} ${c.flip}`);
    return { ...p, body: chunks.join("\n\n") };
  });
}

// ⑥ 9쪽 실천: '오늘'·'3일 안에'를 틀별 실천으로, 앞 안내 문단은 첫 문장만(처방과 이어진다는 둘째 문장이 맞지 않게 되므로)
export const PLAN_HEAD = "이번 주에 이것부터 해보는게 어떨까요?";
function practiceItem(slot: string, p: Practice, cue: string): string {
  const how = /때$/.test(cue) ? `\n다음에 ${cue} 해 보세요.` : "";
  return `• ${slot}: ${p.title} (${p.min}분)${how}`;
}
function cueOf(frame: any): string {
  const sid = frame?.sub_id;
  const scene = sid ? Object.values((RL.cue.scene ?? {}) as Record<string, { cue: string; subs: string[] }>).find((s) => s.subs.includes(sid)) : null;
  return cueFor({ subId: sid, frameId: frame?.frame_id, sceneCue: scene?.cue ?? null }, RL);
}
function applyPage9(pages: Page[], ctx: LinesCtx): Page[] {
  const { frame, lean } = ctx;
  if (!frame?.frame_id || !RL.practice_link[frame.frame_id]) return pages;
  const variant = areaVariant(frame.sub_id, { confidence: frame.confidence ?? "high", safety: safetyLevel(ctx.safety) }, RL);
  const p8 = pages.find((p) => p.page === 8);
  const exclude = p8?.body ? [...String(p8.body).matchAll(/^• (.+)$/gm)].map((m) => m[1].trim()) : [];
  const emotion = (ctx.cls?.emotions ?? []).includes("TIR") ? "TIR" : null;
  const { today, three } = pickPractices({ frameId: frame.frame_id, variant, emotion, safety: safetyLevel(ctx.safety), pickSign: lean ? pickSignOf(lean) : 1, exclude }, RL);
  const cue = cueOf(frame);
  const plan = planLine(frame.frame_id, lean ? pickSignOf(lean) : 1, RL);
  return pages.map((p) => {
    if (p.page !== 9 || !p.body) return p;
    let chunks = String(p.body).split(/\n\s*\n/);
    let cueUsed = false; // 장면 머리말("다음에 … 때 해 보세요.")은 첫 칸에만
    const swap = (slot: string, pr: Practice | null) => {
      if (!pr) return;
      const i = chunks.findIndex((c) => c.startsWith(`• ${slot}:`));
      if (i < 0) return;
      chunks[i] = practiceItem(slot, pr, cueUsed ? "" : cue);
      cueUsed = true;
    };
    swap("오늘", today);
    swap("3일 안에", three);
    if (today || three) chunks = chunks.map((c) => (/^\*\*[^*]*처방[^*]*\*\*/.test(c) ? c.replace(/^(\*\*[^*]+\*\*)[\s\S]*$/, "$1") : c));
    // AI 계획(7쪽 '이번 주에 이것부터' — 화면으로 보낼 때 9쪽으로 옮김)이 없으면 계획 대체 문장
    const page7 = pages.find((x) => x.page === 7)?.body ?? "";
    if (plan && !/이번 주에 이것부터/.test(String(page7)) && !chunks.some((c) => c.startsWith(PLAN_HEAD))) {
      const at = chunks.findIndex((c) => c.startsWith("• "));
      chunks.splice(at >= 0 ? at : chunks.length, 0, [PLAN_HEAD, `◦ ${plan.first}`, ...(plan.look ? [`◦ ${plan.look}`] : [])].join("\n"));
    }
    return { ...p, body: chunks.join("\n\n") };
  });
}

/** 화면 순서로 정리된 쪽들에 문장 DB를 끼운다. 한국어판만(영문판은 문장 DB가 없음). */
export function applyReportLines(pages: Page[], ctx: LinesCtx): Page[] {
  const steps: ((p: Page[], c: LinesCtx) => Page[])[] = [applyScenes, applyQuote];
  if (ctx.paid) steps.push(applyPage5, applyPage7, applyPage9, applyAliases);
  let out = pages;
  for (const step of steps) {
    try {
      out = step(out, ctx);
    } catch (e) {
      console.warn("문장 DB 끼우기 실패 — 그 단계는 원래 글로:", step.name, e instanceof Error ? e.message : "unknown");
    }
  }
  return out;
}
