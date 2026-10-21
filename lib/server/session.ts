import "server-only";
import { createHash, randomBytes } from "node:crypto";
import data from "@/data/tarot_data.json";
import { createShuffle, pickSlot } from "@/lib/tarot/deck.js";
import { mergeSafety } from "@/lib/tarot/safety.js";
import { screenWorry } from "@/lib/tarot-glue/screenWorry";
import { buildSafetyNotice } from "@/lib/tarot/assembleReport.js";
import { parseFrame, parseC } from "@/lib/tarot/validateV4.js";
import { parseClassification, classificationForReport, type Classification } from "@/lib/tarot-glue/classification";
import { decide, buildCUserBlock, buildUnpaidPages, sanitizeUnpaid } from "@/lib/tarot-glue/v4";
import { createAdminClient } from "./supabaseAdmin";
import { aiConfigured, generateText } from "./ai";
import { CLASSIFY_SYSTEM, FRAME_SYSTEM, C_SYSTEM, worryUserMessage } from "./prompts";

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
  current_shuffle_id: string | null;
  reshuffle_count: number;
  picked_slots: number[];
  picks: Pick[];
  // v4: C 출력(parseC 결과에서 errors를 뺀 것 — links·teaser·reasons)
  links: Record<string, unknown> | null;
  result_status: string;
  created_at: string;
  updated_at: string;
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
  // v4 칸(frame·fear) 마이그레이션 전이면 그 칸만 빼고 다시 쓴다 — 결과가 멈추지 않게(이때는 비결정형 경로로 동작).
  if (error && /frame|fear/.test(error.message) && ("frame" in patch || "fear" in patch)) {
    console.warn("tarot_sessions v4 칸 없음(마이그레이션 20261020000000 실행 필요) — 그 칸 없이 저장");
    const rest: Partial<SessionRow> = { ...patch };
    delete rest.frame;
    delete rest.fear;
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

export async function createSession(input: { nickname: unknown; experience: unknown; userId: string | null }) {
  // 2026-10-21 owner 결정: 로그인해야 테스트를 할 수 있다(예전엔 게스트도 끝까지 가능). 화면에서 막는 것과 별개로 서버에서도 막는다.
  if (!input.userId) throw new TarotError(401, "로그인이 필요해요.");
  const nickname = String(input.nickname ?? "").trim();
  if (nickname.length < copy.welcome.min_len) throw new TarotError(400, copy.welcome.empty_error);
  const experience = input.experience === "first" || input.experience === "returning" ? input.experience : null;
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
  const [cls, frame] = await Promise.all([
    tryTwice("고민 분류(A)", async () => parseClassification(await generateText(CLASSIFY_SYSTEM, msg, { timeoutMs: 15000, maxOutputTokens: 800, label: "A" }), data)),
    tryTwice("고민 틀(A2)", async () => {
      const r = parseFrame(await generateText(FRAME_SYSTEM, msg, { timeoutMs: 15000, maxOutputTokens: 800, label: "A2" }));
      // 탈락 이유는 운영 로그에만(내용 없이 규칙 이름만)
      if (!r.frame && r.errors.length) console.warn("고민 틀(A2) 검증 탈락:", r.errors.length, "건");
      return r.frame;
    }),
  ]);
  // 안전 단계는 서버 키워드와 AI 중 항상 높은 쪽(mergeSafety, v4: watch 없음). 분류에 실패해도 키워드 결과는 유지.
  const merged = mergeSafety(screenWorry(worry), cls);
  const patch: Partial<SessionRow> = {
    classification: cls,
    classification_status: cls ? "done" : "failed",
    safety_level: merged.level,
    violence: merged.violence,
    fear: merged.fear,
    frame,
  };
  if (merged.level === "urgent") patch.result_status = "safety";
  await update(sessionId, patch);
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
    const { decision, lean } = decide({ frame: s.frame ?? null, cls, picks, name: s.nickname });
    const userBlock = buildCUserBlock({ name: s.nickname, worryText: s.worry_text, cls, picks, frame: s.frame ?? null, lean });
    // 연결 한 줄(C)은 최대 12초, 넘으면 그 줄 없이(스펙 7.7).
    const deadline = Date.now() + 12000;
    let best: ReturnType<typeof parseC> | null = null;
    for (let attempt = 0; attempt < 2 && userBlock; attempt++) {
      const left = deadline - Date.now();
      if (left < 2000) break;
      try {
        const r = parseC(await generateText(C_SYSTEM, userBlock, { timeoutMs: left, maxOutputTokens: 2000, label: "C" }), {
          decision, strength: lean?.strength ?? null, frame: s.frame ?? null, lean, violence: s.violence || classificationLost,
        });
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
    // 마지막 갱신 후 60초가 지나면 연결 한 줄 없이(스펙의 실패 대체 동작과 같음) 결과를 연다.
    const idle = Date.now() - new Date(s.updated_at).getTime();
    if (idle < 60000) return { status: "preparing" as const };
    // 분류(안전 판단 포함)가 아직 진행 중이면 결과를 열지 않는다 — 늦게 온 urgent를 놓치지 않게(fail safe).
    // 분류 호출은 길어야 30초라, 3분이 넘도록 pending이면 끊긴 것으로 보고 키워드 판정만으로 연다.
    if (s.classification_status === "pending" && idle < 180000) return { status: "preparing" as const };
  }
  const picks = expandPicks(s.picks);
  const cls = classificationForReport(s.classification);
  const safety = { level: s.safety_level, violence: s.violence, fear: Boolean(s.fear) };
  const frame = s.frame ?? null;
  // 방향은 저장하지 않고 매번 같은 재료(카드·고민 틀·분류)로 다시 계산한다(결정론적). 결제 전에는 응답에 싣지 않음.
  const { lean, decision } = decide({ frame, cls, picks, name: s.nickname });
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

// ---------- 내 결과 목록(/results) ----------

// 로그인한 사람의 지난 타로 결과(최근 순, 최대 50개). 카드 이름·자리·방향과 날짜만 — 고민 원문·해석 본문은 넣지 않는다.
// 결과까지 간 것(카드 3장)만, 안전 안내로 끝난 세션은 뺀다.
export async function listResults(userId: string | null) {
  if (!userId) throw new TarotError(401, "로그인이 필요해요.");
  const { data: rows, error } = await db()
    .from("tarot_sessions")
    .select("id, nickname, picks, result_status, safety_level, created_at")
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
        cards: expandPicks(r.picks as Pick[]).map((p) => ({ ...publicCard(p.card), reversed: p.reversed, position: p.position, positionName: p.positionName })),
      })),
  };
}

export async function participantCount(): Promise<number | null> {
  const { count, error } = await db().from("tarot_sessions").select("id", { count: "exact", head: true });
  if (error) return null;
  return count ?? null;
}
