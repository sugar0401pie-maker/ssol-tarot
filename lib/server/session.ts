import "server-only";
import { createHash, randomBytes } from "node:crypto";
import data from "@/data/tarot_data.json";
import { createShuffle, pickSlot } from "@/lib/tarot/deck.js";
import { mergeSafety } from "@/lib/tarot/safety.js";
import { screenWorry } from "@/lib/tarot-glue/screenWorry";
import { buildSafetyNotice } from "@/lib/tarot/assembleReport.js";
import { parseFrame, parseC } from "@/lib/tarot/validateV4.js";
import { parseClassification, classificationForReport, type Classification } from "@/lib/tarot-glue/classification";
import { decide, buildCUserBlock, buildDUserBlock, buildE1UserBlock, buildE2UserBlock, buildUnpaidPages, buildPaidPages, sanitizeUnpaid, sanitizePaid } from "@/lib/tarot-glue/v4";
import { parseStoryApply } from "@/lib/tarot/assembleReport.js";
import { buildChatSummary } from "@/lib/tarot-glue/chatSummary";
import { parseE, mergeE, overlapWarnings, actionsOf } from "@/lib/tarot/validateV4.js";
import { todayFromDb } from "@/lib/tarot/pagesV4.js";
import { REPORT_ORDER_NAME, currentReportPrice, WITHDRAWAL_NOTICE_VERSION } from "@/lib/billing/pricing";
import { decideAfterConfirmFailure } from "@/lib/billing/confirmDecision";
import { cancelTossPayment, confirmTossPayment, getTossPayment } from "./toss";
import { createAdminClient } from "./supabaseAdmin";
import { aiConfigured, generateText } from "./ai";
import { frameCall, type FrameVote } from "./frameExamples";
import { GuestLimitError, checkGuestStart } from "./guestLimit";
import { MERGED_CLASSIFY_SYSTEM, mergedClassifyEnabled, splitMerged } from "./mergedClassify";
import { CLASSIFY_SYSTEM, FRAME_SYSTEM, C_SYSTEM, D_SYSTEM, E1_SYSTEM, E2_SYSTEM, worryUserMessage } from "./prompts";

// 쏠 타로 세션의 모든 서버 동작(마스터 스펙 7.7의 API 순서). DB는 service_role로만 다룬다.
// v4.0(2026-10-20): 결과 11쪽. 고민 제출 → A 분류 + A2 고민 틀 / 3장째 → 방향 계산(코드) + C / 결제 후 → D·E(결제 연동 때).
// 원칙: 카드 순서는 응답에 넣지 않는다 / 결제 전 유료 본문(5쪽 결론부터, 6~11쪽)은 응답에 넣지 않는다 /
//      고민 원문은 로그에 남기지 않는다 / 실패하면 더 조심스러운 쪽으로.

type Pick = { id: string; reversed: boolean; position: string };
type SessionRow = {
  id: string;
  access_key_hash: string;
  user_id: string | null;
  nickname: string;
  experience: string | null;
  worry_text: string | null;
  worry_skipped: boolean;
  classification_status: string;
  classification: Classification | null;
  safety_level: "none" | "watch" | "urgent";
  violence: boolean;
  // v4 관계 속 두려움(S4-5) — 안내 박스만. 마이그레이션 20261020000000 전에는 없을 수 있음.
  fear?: boolean;
  // v4 A2 고민 틀(사용자 원문 구절 포함 — 원문과 같은 수준으로 다룸)
  frame?: unknown;
  // v4.1 비슷한 정답 5개의 투표(두 번째 의견용). 마이그레이션 20261022000000 전에는 없을 수 있음.
  frame_vote?: FrameVote | null;
  current_shuffle_id: string | null;
  reshuffle_count: number;
  picked_slots: number[];
  picks: Pick[];
  // v4: C 출력(parseC 결과에서 errors를 뺀 것 — links·teaser·reasons)
  links: Record<string, unknown> | null;
  result_status: string;
  created_at: string;
  updated_at: string;
  // 유료 리포트(마이그레이션 20261021000000 전에는 없을 수 있음)
  paid_at?: string | null;
  report?: { sa: unknown; E: unknown } | null;
  report_status?: "none" | "generating" | "ready" | "failed";
  report_started_at?: string | null;
};

export class TarotError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
const db = () => createAdminClient();
const copy = data.copy;

// ---------- 접근 확인 ----------

export async function loadSession(id: string, auth: { key: string | null; userId: string | null }): Promise<SessionRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new TarotError(404, "세션을 찾을 수 없어요.");
  const { data: row, error } = await db().from("tarot_sessions").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("tarot_sessions 조회 실패:", error.message);
    throw new TarotError(500, "잠시 후 다시 시도해 주세요.");
  }
  if (!row) throw new TarotError(404, "세션을 찾을 수 없어요.");
  const s = row as SessionRow;
  const keyOk = auth.key ? hashKey(auth.key) === s.access_key_hash : false;
  const userOk = Boolean(auth.userId && s.user_id && auth.userId === s.user_id);
  if (!keyOk && !userOk) throw new TarotError(403, "이 결과를 볼 수 있는 권한이 없어요.");
  return s;
}

async function update(id: string, patch: Partial<SessionRow>) {
  const write = (p: Partial<SessionRow>) => db().from("tarot_sessions").update({ ...p, updated_at: new Date().toISOString() }).eq("id", id);
  let { error } = await write(patch);
  // v4.1 칸(frame_vote) 마이그레이션 전이면 그 칸만 빼고 다시 쓴다(두 번째 의견만 빠짐).
  if (error && /frame_vote/.test(error.message) && "frame_vote" in patch) {
    console.warn("tarot_sessions.frame_vote 칸 없음(마이그레이션 20261022000000 실행 필요) — 그 칸 없이 저장");
    const rest: Partial<SessionRow> = { ...patch };
    delete rest.frame_vote;
    patch = rest;
    ({ error } = await write(rest));
  }
  // v4 칸(frame·fear) 마이그레이션 전이면 그 칸만 빼고 다시 쓴다 — 결과가 멈추지 않게(이때는 비결정형 경로로 동작).
  if (error && /frame|fear/.test(error.message) && ("frame" in patch || "fear" in patch)) {
    console.warn("tarot_sessions v4 칸 없음(마이그레이션 20261020000000 실행 필요) — 그 칸 없이 저장");
    const rest: Partial<SessionRow> = { ...patch };
    delete rest.frame;
    delete rest.fear;
    delete rest.frame_vote;
    ({ error } = await write(rest));
  }
  if (error) {
    console.error("tarot_sessions 갱신 실패:", error.message);
    throw new TarotError(500, "잠시 후 다시 시도해 주세요.");
  }
}

function assertNotSafety(s: SessionRow) {
  // urgent면 카드로 넘어가지 않는다(스펙 6장, 11장 3번).
  if (s.safety_level === "urgent" || s.result_status === "safety") throw new TarotError(409, "safety");
}

// ---------- 1. 세션 시작 ----------

export async function createSession(input: { nickname: unknown; experience: unknown; userId: string | null; headers: { get(name: string): string | null } }) {
  // 2026-10-26 owner 결정: 로그인 없이도 타로를 볼 수 있다(10-21 '로그인 필수'를 대체). 로그인은 결제·저장·쏘웰라로 갈 때 권한다.
  // 대신 로그인 없는 시작은 같은 기기 24시간 3번·같은 IP 20번까지(고민 분류·연결 한 줄 AI 비용 — lib/tarot-glue/guestLimit.ts).
  const nickname = String(input.nickname ?? "").trim();
  if (nickname.length < copy.welcome.min_len) throw new TarotError(400, copy.welcome.empty_error);
  const experience = input.experience === "first" || input.experience === "returning" ? input.experience : null;
  if (!input.userId) {
    try {
      await checkGuestStart(input.headers);
    } catch (e) {
      if (e instanceof GuestLimitError) throw Object.assign(new TarotError(429, copy.welcome.guest_limit), { needLogin: true });
      throw e;
    }
  }
  const key = randomBytes(24).toString("hex");
  const { data: row, error } = await db()
    .from("tarot_sessions")
    .insert({
      access_key_hash: hashKey(key),
      user_id: input.userId,
      nickname: nickname.slice(0, copy.welcome.max_len),
      experience,
    })
    .select("id")
    .single();
  if (error || !row) {
    console.error("tarot_sessions 생성 실패:", error?.message);
    throw new TarotError(500, "잠시 후 다시 시도해 주세요.");
  }
  return { id: row.id as string, key };
}

// ---------- 2. 고민 제출 / 건너뛰기 ----------

// 반환값 urgent=true면 화면은 안전 안내로. AI 분류는 호출한 라우트가 after()로 백그라운드 실행한다.
export async function submitWorry(s: SessionRow, body: { text?: unknown; skip?: unknown }) {
  if (s.picks.length > 0 || s.current_shuffle_id) throw new TarotError(409, "이미 카드를 섞기 시작했어요.");
  if (body.skip === true) {
    await update(s.id, {
      worry_text: null,
      worry_skipped: true,
      classification_status: "none",
      classification: null,
      safety_level: "none",
      violence: false,
      fear: false,
      frame: null,
      result_status: "drawing",
    });
    return { urgent: false, needsClassification: false };
  }
  const text = String(body.text ?? "").trim();
  if (text.length < copy.worry.min_len) throw new TarotError(400, copy.worry.too_short);
  const worry = text.slice(0, copy.worry.max_len);
  const local = screenWorry(worry);
  const urgent = local.level === "urgent";
  await update(s.id, {
    worry_text: worry,
    worry_skipped: false,
    safety_level: local.level,
    violence: local.violence,
    fear: local.fear,
    frame: null,
    // urgent면 카드 진행 자체가 없으므로 분류도 하지 않는다.
    classification_status: urgent || !aiConfigured() ? "failed" : "pending",
    classification: null,
    result_status: urgent ? "safety" : "drawing",
  });
  return { urgent, needsClassification: !urgent && aiConfigured() };
}

// 백그라운드: 고민 분류(A)와 고민 틀(A2)을 함께. 각각 실패 → 1회 재시도 → 그래도 실패면
//   A 실패: 분류 없이(미작성 모드처럼) 해석 / A2 실패: 비결정형 경로(방향 계산 안 함) — README_v4 대체 경로.
async function tryTwice<T>(label: string, fn: () => Promise<T | null>): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fn();
      if (r) return r;
    } catch (e) {
      console.warn(`${label} 호출 실패:`, e instanceof Error ? e.message : "unknown");
    }
  }
  return null;
}

export async function runClassification(sessionId: string) {
  const { data: row } = await db().from("tarot_sessions").select("worry_text").eq("id", sessionId).maybeSingle();
  const worry = row?.worry_text as string | null;
  if (!worry) return;
  const msg = worryUserMessage(worry);
  // v4.1: A2 사용자 입력에 비슷한 고민의 정답 5개를 붙이고(few-shot), 같은 5개의 투표를 두 번째 의견용으로 저장한다.
  const fc = frameCall(worry);
  const callA = () => tryTwice("고민 분류(A)", async () => parseClassification(await generateText(CLASSIFY_SYSTEM, msg, { timeoutMs: 15000, maxOutputTokens: 800, label: "A" }), data));
  const callA2 = () =>
    tryTwice("고민 틀(A2)", async () => {
      const r = parseFrame(await generateText(FRAME_SYSTEM, fc.user, { timeoutMs: 15000, maxOutputTokens: 800, label: "A2" }));
      // 탈락 이유는 운영 로그에만(내용 없이 규칙 이름만)
      if (!r.frame && r.errors.length) console.warn("고민 틀(A2) 검증 탈락:", r.errors.length, "건");
      return r.frame;
    });
  let cls: Classification | null = null;
  let frame: unknown = null;
  if (mergedClassifyEnabled()) {
    // A+A2 한 번 호출(owner 2026-10-26). 어느 절반이든 검증을 못 넘으면 그 절반만 예전처럼 따로 다시 부른다 —
    // 특히 안전 판단(A)이 빠진 채로 넘어가지 않게.
    try {
      const parts = splitMerged(await generateText(MERGED_CLASSIFY_SYSTEM, fc.user, { timeoutMs: 20000, maxOutputTokens: 2400, label: "A+A2" }));
      cls = parts.classification ? parseClassification(parts.classification, data) : null;
      frame = parts.frame ? parseFrame(parts.frame).frame : null;
    } catch (e) {
      console.warn("A+A2 호출 실패:", e instanceof Error ? e.message : "unknown");
    }
    if (!cls || !frame) {
      const [c2, f2] = await Promise.all([cls ? Promise.resolve(cls) : callA(), frame ? Promise.resolve(frame) : callA2()]);
      cls = c2;
      frame = f2;
    }
  } else {
    [cls, frame] = await Promise.all([callA(), callA2()]);
  }
  // 안전 단계는 서버 키워드와 AI 중 항상 높은 쪽(mergeSafety — v4.1: none < watch < urgent, CSO 2026-10-22).
  // urgent만 카드를 멈추고, watch는 결과 그대로 + 마지막 쪽 맨 아래 109 안내 한 줄. 분류에 실패해도 키워드 결과는 유지.
  const merged = mergeSafety(screenWorry(worry), cls);
  const patch: Partial<SessionRow> = {
    classification: cls,
    classification_status: cls ? "done" : "failed",
    safety_level: merged.level,
    violence: merged.violence,
    fear: merged.fear,
    frame,
    frame_vote: fc.vote,
  };
  if (merged.level === "urgent") patch.result_status = "safety";
  await update(sessionId, patch);
}

// v4.1 두 번째 의견이 A2와 다를 때의 검수 대기 기록(README_v4 '운영 로그'). owner 결정(2026-10-22): 고민 원문도 함께 저장.
// 서버 전용 표(tarot_frame_reviews) — 로그에는 남기지 않는다. 저장 실패해도 결과는 그대로 진행(검수 기록만 빠짐).
async function saveFrameReview(s: SessionRow, reviewLog: Record<string, unknown>, lowered: boolean) {
  if (!s.worry_text) return;
  const { error } = await db().from("tarot_frame_reviews").upsert(
    { session_id: s.id, user_id: s.user_id, worry_text: s.worry_text, frame: s.frame ?? null, vote: s.frame_vote ?? null, review_log: { ...reviewLog, worry_id: s.id }, lowered },
    { onConflict: "session_id", ignoreDuplicates: true },
  );
  if (error) console.warn("고민 틀 검수 기록 저장 실패:", error.message);
}

// ---------- 3. 셔플 ----------

export async function shuffle(s: SessionRow) {
  assertNotSafety(s);
  if (s.result_status === "started") throw new TarotError(409, "고민 쓰기부터 해 주세요.");
  if (s.picks.length > 0) throw new TarotError(409, "이미 카드를 뽑기 시작했어요.");
  const sh = createShuffle(data);
  const { error } = await db()
    .from("tarot_shuffles")
    .insert({ id: sh.shuffleId, session_id: s.id, card_order: sh.order, reversed: sh.reversed });
  if (error) {
    console.error("tarot_shuffles 저장 실패:", error.message);
    throw new TarotError(500, "잠시 후 다시 시도해 주세요.");
  }
  await update(s.id, {
    current_shuffle_id: sh.shuffleId,
    reshuffle_count: s.current_shuffle_id ? s.reshuffle_count + 1 : s.reshuffle_count,
  });
  // 카드 순서는 보내지 않는다 — 자리 개수만.
  return { shuffleId: sh.shuffleId, count: sh.order.length };
}

// ---------- 4. 뽑기 ----------

export function publicCard(c: { id: string; no: number; name: string; character: string; image: { file: string } }) {
  return { id: c.id, no: c.no, name: c.name, character: c.character, image: `/images/tarot/${c.image.file}` };
}

export async function pick(s: SessionRow, body: { shuffleId?: unknown; slot?: unknown }) {
  assertNotSafety(s);
  if (!s.current_shuffle_id || body.shuffleId !== s.current_shuffle_id) throw new TarotError(409, "카드를 다시 섞어 주세요.");
  const { data: sh, error } = await db().from("tarot_shuffles").select("card_order, reversed").eq("id", s.current_shuffle_id).single();
  if (error || !sh) throw new TarotError(500, "잠시 후 다시 시도해 주세요.");
  let res;
  try {
    res = pickSlot({ order: sh.card_order, reversed: sh.reversed }, s.picked_slots, body.slot, data);
  } catch (e) {
    throw new TarotError(400, e instanceof Error ? e.message : "카드를 고를 수 없어요.");
  }
  const picks = [...s.picks, { id: res.card.id, reversed: res.reversed, position: res.position }];
  await update(s.id, {
    picked_slots: [...s.picked_slots, res.slot],
    picks,
    result_status: res.isLast ? "preparing" : "drawing",
  });
  return {
    slot: res.slot,
    position: res.position,
    positionName: res.positionName,
    reversed: res.reversed,
    card: publicCard(res.card),
    isLast: res.isLast,
  };
}

// 백그라운드(3장째 직후): 분류가 끝나길 잠깐 기다린 뒤 카드별 고민 연결 한 줄(C)을 만들고 결과를 'ready'로.
// 무료 1~3번 본문은 읽을 때마다 같은 재료(picks·분류·links)로 조립하므로 따로 저장하지 않는다.
export async function prepareResult(sessionId: string) {
  const started = Date.now();
  let s: SessionRow | null = null;
  // 분류(A)가 셔플·뽑기 동안 안 끝났으면 끝날 때까지 기다린다(안전 우선 — 스펙 6장·7.3).
  // 예전엔 12초만 기다려서, 분류가 늦게 urgent를 주면 이미 열린 결과가 그대로 남을 수 있었다.
  // 분류는 15초 × 최대 2번이라 40초면 반드시 끝난다. 그래도 pending이면(서버 재시작 등) 분류 실패로 보고
  // 키워드 판정만으로 진행하되, 폭력 여부를 모르므로 C에는 violence=true처럼 조심스럽게 넘긴다(fail safe).
  let classificationLost = false;
  while (true) {
    const { data: row } = await db().from("tarot_sessions").select("*").eq("id", sessionId).maybeSingle();
    s = row as SessionRow | null;
    if (!s || s.classification_status !== "pending") break;
    if (Date.now() - started > 40000) {
      classificationLost = true;
      await update(sessionId, { classification_status: "failed" });
      break;
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  if (!s || s.result_status === "safety" || s.safety_level === "urgent") return;
  // v4: 결정형이면 카드 점수로 방향을 먼저 정하고(코드), C가 그 방향에 맞춰 한 줄·질문·teaser·이유를 쓴다.
  let links: Record<string, unknown> | null = null;
  const cls = classificationForReport(s.classification);
  if (s.worry_text && aiConfigured()) {
    const picks = expandPicks(s.picks);
    const { decision, lean, review_log, lowered } = decide({ frame: s.frame ?? null, cls, picks, name: s.nickname, safety: { violence: s.violence }, vote: s.frame_vote ?? null });
    if (review_log) await saveFrameReview(s, review_log, lowered);
    const userBlock = buildCUserBlock({ name: s.nickname, worryText: s.worry_text, cls, picks, frame: s.frame ?? null, lean });
    // 연결 한 줄(C)은 최대 12초, 넘으면 그 줄 없이(스펙 7.7). 무료 결과에는 검수를 하지 않는다(owner 2026-10-21 비용 — 검수는 유료 1번만).
    const deadline = Date.now() + 12000;
    const parse = (raw: string) => parseC(raw, { decision, strength: lean?.strength ?? null, frame: s.frame ?? null, lean, violence: s.violence || classificationLost });
    let best: ReturnType<typeof parseC> | null = null;
    for (let attempt = 0; attempt < 2 && userBlock; attempt++) {
      const left = deadline - Date.now();
      if (left < 2000) break;
      try {
        const r = parse(await generateText(C_SYSTEM, userBlock, { timeoutMs: left, maxOutputTokens: 2000, label: "C", reasoningEffort: "low" }));
        // 걸린 칸만 비고 나머지는 쓴다(README_v4). 한 줄(links)까지 통과했으면 재시도하지 않음.
        if (!best || (r.links && !best.links)) best = r;
        if (r.errors.length) console.warn("C 검증 탈락 칸:", r.errors.length, "건");
        if (r.links) break;
      } catch (e) {
        console.warn("C 호출 실패:", e instanceof Error ? e.message : "unknown");
      }
    }

    if (best) {
      const { errors: _errors, ...rest } = best;
      void _errors;
      links = rest;
    }
  }
  await update(sessionId, { links, result_status: "ready" });
  await writeChatSummary(sessionId);
}

// 쏘웰라 채팅이 참고할 요약(tarot_sessions.chat_summary, owner 2026-10-26)을 화면에 보이는 것과 같은 걸러진 쪽으로 만든다.
// 무료 결과가 준비됐을 때 한 번, 유료 리포트가 끝났을 때 다시 쓴다. 칸이 아직 없거나(마이그레이션 20261026000000 전) 실패해도
// 결과 화면에는 영향이 없게 로그만 남긴다(고민 원문·요약 내용은 로그에 넣지 않는다).
async function writeChatSummary(sessionId: string) {
  try {
    const { data: row } = await db().from("tarot_sessions").select("*").eq("id", sessionId).maybeSingle();
    const s = row as SessionRow | null;
    if (!s) return;
    const r = await getResult(s);
    if (r.status !== "ready") return;
    const chat_summary = buildChatSummary(r.pages as Parameters<typeof buildChatSummary>[0], { worryText: s.worry_text ?? null, nickname: s.nickname ?? null, createdAt: s.created_at, paid: r.paid });
    const { error } = await db().from("tarot_sessions").update({ chat_summary }).eq("id", sessionId);
    if (error) console.warn("chat_summary 저장 실패(마이그레이션 20261026000000 전일 수 있음):", error.message);
  } catch (e) {
    console.warn("chat_summary 만들기 실패:", e instanceof Error ? e.message : "unknown");
  }
}

function expandPicks(picks: Pick[]) {
  const positions = data.positions;
  return picks.map((p) => {
    const card = data.cards.find((c) => c.id === p.id)!;
    const pos = positions.find((x) => x.code === p.position)!;
    return { card, reversed: p.reversed, position: p.position, positionName: pos.name };
  });
}

// ---------- 5. 결과 ----------

export async function getStatus(s: SessionRow) {
  return { urgent: s.safety_level === "urgent" || s.result_status === "safety", resultStatus: s.result_status };
}

export async function getResult(s: SessionRow) {
  if (s.safety_level === "urgent" || s.result_status === "safety") return { status: "safety" as const };
  if (s.picks.length < data.deck.pick_count) return { status: "drawing" as const };
  if (s.result_status !== "ready") {
    // 백그라운드 작업이 어떤 이유로 끊겼을 때(배포 중 재시작 등) 영원히 기다리지 않도록,
    // 마지막 갱신 후 70초가 지나면 연결 한 줄 없이(스펙의 실패 대체 동작과 같음) 결과를 연다(분류 대기 최대 40초 + C 12초).
    const idle = Date.now() - new Date(s.updated_at).getTime();
    if (idle < 70000) return { status: "preparing" as const };
    // 분류(안전 판단 포함)가 아직 진행 중이면 결과를 열지 않는다 — 늦게 온 urgent를 놓치지 않게(fail safe).
    // 분류 호출은 길어야 30초라, 3분이 넘도록 pending이면 끊긴 것으로 보고 키워드 판정만으로 연다.
    if (s.classification_status === "pending" && idle < 180000) return { status: "preparing" as const };
  }
  // 결제했는데 유료 리포트(D·E)를 아직 만드는 중이면 기다리는 화면. 4분 40초가 지나도(D·E 동시, 각 최대 50초×2 = 100초 < 함수 한도 300초) 안 끝났으면(서버 재시작 등) 만든 만큼 —
  // 없으면 DB 문장(패키지 대체 경로)으로 연다. 결제한 사람이 영원히 기다리지 않게.
  const paid = Boolean(s.paid_at);
  if (paid && s.report_status === "generating" && Date.now() - new Date(s.report_started_at ?? s.updated_at).getTime() < 280000) {
    return { status: "preparing" as const };
  }
  const picks = expandPicks(s.picks);
  const cls = classificationForReport(s.classification);
  const safety = { level: s.safety_level, violence: s.violence, fear: Boolean(s.fear) };
  const frame = s.frame ?? null;
  // 방향은 저장하지 않고 매번 같은 재료(카드·고민 틀·분류)로 다시 계산한다(결정론적). 결제 전에는 응답에 싣지 않음.
  const { lean, decision } = decide({ frame, cls, picks, name: s.nickname, safety, vote: s.frame_vote ?? null });
  if (paid) {
    const rep = (s.report ?? null) as { sa?: unknown; E?: unknown } | null;
    const pages = buildPaidPages({ name: s.nickname, cls, picks, safety, worryText: s.worry_text ?? "", frame, lean, C: s.links, sa: rep?.sa ?? null, E: rep?.E ?? null });
    return {
      status: "ready" as const,
      nickname: s.nickname,
      createdAt: s.created_at,
      cards: picks.map((p) => ({ ...publicCard(p.card), reversed: p.reversed, position: p.position, positionName: p.positionName })),
      pages: sanitizePaid(pages, { other: lean?.other ?? null }),
      notice: buildSafetyNotice({ data, safety }),
      paid: true,
      decision,
      saved: Boolean(s.user_id),
    };
  }
  const pages = buildUnpaidPages({ name: s.nickname, cls, picks, safety, worryText: s.worry_text ?? "", frame, lean, C: s.links });
  return {
    status: "ready" as const,
    nickname: s.nickname,
    createdAt: s.created_at,
    cards: picks.map((p) => ({ ...publicCard(p.card), reversed: p.reversed, position: p.position, positionName: p.positionName })),
    pages: sanitizeUnpaid(pages),
    // v4: 안내 박스는 폭력(구체 행동)·관계 속 두려움일 때만(주의 단계 삭제). 결제와 상관없이 보임.
    notice: buildSafetyNotice({ data, safety }),
    paid: false,
    // 결정형 고민인지(세 장이 한쪽을 골랐는지)만 — 어느 쪽인지는 보내지 않는다. 결제 카드 문구를 고르는 데 쓴다.
    decision,
    saved: Boolean(s.user_id),
  };
}

// ---------- 결과 저장(로그인 사용자에게 연결) ----------

export async function claim(s: SessionRow, userId: string | null) {
  if (!userId) throw new TarotError(401, "로그인이 필요해요.");
  if (s.user_id && s.user_id !== userId) throw new TarotError(409, "이미 다른 계정에 저장된 결과예요.");
  if (!s.user_id) await update(s.id, { user_id: userId });
  return { saved: true };
}

// ---------- 결제(토스) — 쏠 아스트로 하우스 결제와 같은 원칙 ----------
// ① 금액은 서버가 정한다(currentReportPrice — 11월 한정 990원, 그 밖 1,900원. 주문 행에 고정 저장해 결제 도중 날짜가 바뀌어도 그 주문 금액은 그대로) ② 토스가 돌려준 값은 믿지 않고 시크릿 키로 승인 확인(confirm)한 뒤에만 결제 완료
// ③ 돈이 나갔을 수 있으면 절대 '취소'로 바꾸지 않는다(decideAfterConfirmFailure) ④ 같은 결과를 두 번 결제하면 두 번째를 토스에서 취소.

type OrderRow = { id: string; user_id: string; session_id: string; amount: number; status: "pending" | "paid" | "canceled"; payment_key: string | null };
const CONFIRM_RETRY_MESSAGE = "결제 확인이 늦어지고 있어요. 잠시 뒤 이 화면을 새로고침해 주세요. 계속되면 contact@ssolwellness.com으로 알려 주세요.";

export async function createOrder(s: SessionRow, userId: string | null, body: { withdrawalAck?: unknown }) {
  if (!userId || s.user_id !== userId) throw new TarotError(401, "로그인한 본인 결과만 결제할 수 있어요.");
  // 청약철회 제한은 사전 고지 + 동의가 있어야 한다(약관 제13조 2항). 화면에서 체크해도 서버가 한 번 더 확인한다.
  if (body.withdrawalAck !== true) throw new TarotError(400, "청약철회 안내에 동의해 주세요.");
  if (s.safety_level === "urgent" || s.result_status === "safety") throw new TarotError(403, "이 결과는 결제할 수 없어요.");
  if (s.picks.length < data.deck.pick_count || s.result_status !== "ready") throw new TarotError(409, "결과가 아직 준비되지 않았어요.");
  if (s.paid_at) throw Object.assign(new TarotError(409, "이미 결제한 리포트예요."), { paid: true });
  const amount = currentReportPrice();
  const { data: row, error } = await db()
    .from("tarot_orders")
    .insert({ user_id: userId, session_id: s.id, amount, withdrawal_version: WITHDRAWAL_NOTICE_VERSION })
    .select("id")
    .single();
  if (error || !row) {
    console.error("tarot_orders 생성 실패:", error?.message);
    throw new TarotError(500, "주문을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
  return { orderId: row.id as string, orderName: REPORT_ORDER_NAME, amount, customerKey: userId };
}

async function settleOrder(orderId: string, status: "canceled") {
  await db().from("tarot_orders").update({ status }).eq("id", orderId).neq("status", "paid");
}

/** 결제 완료 저장. 같은 결과에 이미 결제된 주문이 있으면(유일 색인 위반) "duplicate". */
async function markOrderPaid(orderId: string, v: { paymentKey: string; method: string | null }): Promise<"ok" | "duplicate"> {
  const { error } = await db()
    .from("tarot_orders")
    .update({ status: "paid", payment_key: v.paymentKey, method: v.method, paid_at: new Date().toISOString() })
    .eq("id", orderId);
  if (!error) return "ok";
  if (error.code === "23505") return "duplicate";
  throw new Error(`tarot_orders 결제 저장 실패: ${error.message}`);
}

export async function confirmPayment(userId: string | null, body: { paymentKey?: unknown; orderId?: unknown; amount?: unknown }) {
  if (!userId) throw new TarotError(401, "로그인이 필요해요.");
  const paymentKey = typeof body.paymentKey === "string" ? body.paymentKey : "";
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const amount = Number(body.amount);
  if (!paymentKey || !/^[0-9a-f-]{36}$/i.test(orderId) || !Number.isFinite(amount)) throw new TarotError(400, "결제 정보가 올바르지 않아요.");

  const { data: o } = await db().from("tarot_orders").select("id, user_id, session_id, amount, status, payment_key").eq("id", orderId).maybeSingle();
  const order = o as OrderRow | null;
  if (!order || order.user_id !== userId) throw new TarotError(404, "주문 정보를 찾을 수 없어요.");
  if (order.status === "paid") return { ok: true, sessionId: order.session_id, generate: false }; // 새로고침 등으로 다시 온 경우
  if (order.amount !== amount) throw new TarotError(400, "결제 금액이 일치하지 않아요.");

  let method: string | null = null;
  if (order.status === "pending") {
    // 같은 결과를 이미 결제했다면(다른 탭의 주문) 토스 승인을 하지 않는다 — 승인 전이면 카드에서 돈이 나가지 않는다.
    const { data: sess } = await db().from("tarot_sessions").select("paid_at").eq("id", order.session_id).maybeSingle();
    if (sess?.paid_at) {
      await settleOrder(orderId, "canceled");
      throw Object.assign(new TarotError(409, "이미 결제한 결과예요. 결과 화면에서 바로 볼 수 있어요."), { sessionId: order.session_id });
    }
    const r = await confirmTossPayment({ paymentKey, orderId, amount });
    if (r.ok) method = r.method;
    else {
      // 승인 응답이 실패여도 토스에서는 이미 승인됐을 수 있다 — 실제 상태를 물어 DONE이면 결제 완료, 확실히 아니면 취소, 모르면 재시도 안내.
      const lookup = await getTossPayment(paymentKey);
      const d = decideAfterConfirmFailure(lookup, { orderId, amount });
      if (d === "cancel") {
        await settleOrder(orderId, "canceled");
        throw new TarotError(502, r.error);
      }
      if (d === "retry") throw new TarotError(503, CONFIRM_RETRY_MESSAGE);
      method = lookup?.method ?? null;
    }
  } else {
    // 'canceled' 주문: 예전에 오류로 잘못 취소됐을 수 있으니 토스에서 실제로 승인됐는지만 확인한다(다시 승인하지 않음).
    const lookup = await getTossPayment(paymentKey);
    if (decideAfterConfirmFailure(lookup, { orderId, amount }) !== "paid") throw new TarotError(409, "이미 처리된 주문이에요.");
    method = lookup?.method ?? null;
  }

  // 여기부터는 토스 승인이 확인됨.
  const saved = await markOrderPaid(orderId, { paymentKey, method });
  if (saved === "duplicate") {
    const refunded = await cancelTossPayment(paymentKey, "같은 결과에 대한 중복 결제");
    if (refunded) await settleOrder(orderId, "canceled");
    console.error(refunded ? "타로 중복 결제 취소함" : "타로 중복 결제 취소 실패(수동 확인 필요)", orderId);
    throw Object.assign(new TarotError(409, refunded ? "이미 결제한 결과라 이번 결제는 취소했어요." : CONFIRM_RETRY_MESSAGE), { sessionId: order.session_id });
  }
  const now = new Date().toISOString();
  await update(order.session_id, { paid_at: now, report_status: "generating", report_started_at: now });
  return { ok: true, sessionId: order.session_id, generate: true };
}

// 결제 직후(백그라운드): D(5·6쪽)·E1(7쪽)·E2(8·9쪽)를 **동시에** 부른다(v4.2 패키지 — E를 둘로 나눠 속도를 줄임).
// owner 2026-10-22 "검수하지마": 검수 단계는 없다. 안전·형식 검사는 그대로(parseStoryApply·parseE part E1/E2).
// 9쪽 '오늘' 실천과 카드별 이유는 AI가 쓰지 않는다(DB — pagesV4.todayFromDb, decision.lean().cards[].reason).
// 검증에서 떨어지면 그 부분만 1회 다시 부르고, 그래도 안 되면 그 부분은 패키지 대체 경로(DB 문장) — README_v4.
export async function generateReport(sessionId: string) {
  const { data: row } = await db().from("tarot_sessions").select("*").eq("id", sessionId).maybeSingle();
  const s = row as SessionRow | null;
  if (!s || !s.paid_at) return;
  let sa: ReturnType<typeof parseStoryApply> | null = null;
  let E: unknown = null;
  try {
    const cls = classificationForReport(s.classification);
    if (s.worry_text && cls && aiConfigured()) {
      const picks = expandPicks(s.picks);
      const frame = s.frame ?? null;
      const { lean } = decide({ frame, cls, picks, name: s.nickname, safety: { violence: s.violence }, vote: s.frame_vote ?? null });
      // 분류가 실패했으면 폭력 여부를 모르므로 더 조심스러운 쪽(violence=true)으로(스펙 6장 fail safe)
      const violence = s.violence || s.classification_status === "failed";
      const safety = { level: s.safety_level, violence, fear: Boolean(s.fear) };
      const args = { name: s.nickname, worryText: s.worry_text, cls, picks, frame, lean };
      const dBlock = buildDUserBlock({ ...args, safety });
      const e1Block = buildE1UserBlock(args);
      const e2Block = buildE2UserBlock(args);

      const runD = async () => {
        let best: ReturnType<typeof parseStoryApply> | null = null;
        for (let i = 0; i < 2 && dBlock; i++) {
          try {
            const r = parseStoryApply(await generateText(D_SYSTEM, dBlock, { timeoutMs: 50000, maxOutputTokens: 6000, label: "D" }), { violence });
            if (!best || (r.story && r.apply)) best = r;
            if (r.story && r.apply) break;
            console.warn("D 검증 탈락 — 다시 시도");
          } catch (e) {
            console.warn("D 호출 실패:", e instanceof Error ? e.message : "unknown");
          }
        }
        return best;
      };
      // E1·E2: 실패한 쪽만 다시 부른다(05_다음단계 v4.2). 경고(지어낸 요일을 고친 것 등)는 개수만 기록 — 내용은 남기지 않는다.
      const runE = async (part: "E1" | "E2", system: string, block: string | null) => {
        for (let i = 0; i < 2 && block; i++) {
          try {
            const r = parseE(await generateText(system, block, { timeoutMs: 50000, maxOutputTokens: 6000, label: part }), { lean, frame, violence, part, worryText: s.worry_text ?? "" });
            if (r.warnings.length) console.info(`${part} 경고:`, r.warnings.length, "건");
            if (r.E) return r.E;
            console.warn(`${part} 검증 탈락 칸:`, r.errors.length, "건");
          } catch (e) {
            console.warn(`${part} 호출 실패:`, e instanceof Error ? e.message : "unknown");
          }
        }
        return null;
      };
      const [d, e1, e2] = await Promise.all([runD(), runE("E1", E1_SYSTEM, e1Block), runE("E2", E2_SYSTEM, e2Block)]);
      sa = d;
      E = mergeE(e1, e2);
      // 행동 겹침(7쪽 계획·8쪽 처방·9쪽 실천) 경고 — 운영에서 E2 재호출 기준을 정하려고 건수만 남긴다(README_v4 ①).
      const key = picks[2];
      const overlaps = overlapWarnings(actionsOf(E, key ? todayFromDb(data, { no: key.card.no, reversed: Boolean(key.reversed) }, lean) : null));
      if (overlaps.length) console.info("행동 겹침 경고:", overlaps.map((o) => `${o.a}↔${o.b}`).join(", "));
    }
    await update(sessionId, { report: { sa, E }, report_status: "ready" });
    await writeChatSummary(sessionId);
  } catch (e) {
    console.error("유료 리포트 생성 실패:", e instanceof Error ? e.message : "unknown");
    // 실패해도 결제한 사람은 결과를 본다 — report 없이 DB 문장(대체 경로)으로 열림
    await update(sessionId, { report: sa || E ? { sa, E } : null, report_status: "failed" }).catch(() => {});
  }
}

// ---------- 내 결과 목록(/results) ----------

// 로그인한 사람의 지난 타로 결과(최근 순, 최대 50개). 카드 이름·자리·방향과 날짜만 — 고민 원문·해석 본문은 넣지 않는다.
// 결과까지 간 것(카드 3장)만, 안전 안내로 끝난 세션은 뺀다.
export async function listResults(userId: string | null) {
  if (!userId) throw new TarotError(401, "로그인이 필요해요.");
  const { data: rows, error } = await db()
    .from("tarot_sessions")
    .select("id, nickname, picks, result_status, safety_level, created_at, paid_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("tarot_sessions 목록 조회 실패:", error.message);
    throw new TarotError(500, "잠시 후 다시 시도해 주세요.");
  }
  return {
    results: (rows ?? [])
      .filter((r) => Array.isArray(r.picks) && r.picks.length >= data.deck.pick_count && r.result_status !== "safety" && r.safety_level !== "urgent")
      .map((r) => ({
        id: r.id as string,
        nickname: r.nickname as string,
        createdAt: r.created_at as string,
        // 유료 리포트를 결제한 결과인지 — 목록에 '전체 열람 가능' 표시(owner 2026-10-22)
        paid: Boolean((r as { paid_at?: string | null }).paid_at),
        cards: expandPicks(r.picks as Pick[]).map((p) => ({ ...publicCard(p.card), reversed: p.reversed, position: p.position, positionName: p.positionName })),
      })),
  };
}

export async function participantCount(): Promise<number | null> {
  const { count, error } = await db().from("tarot_sessions").select("id", { count: "exact", head: true });
  if (error) return null;
  return count ?? null;
}
