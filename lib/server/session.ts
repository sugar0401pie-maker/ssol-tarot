import "server-only";
import { createHash, randomBytes } from "node:crypto";
import data from "@/data/tarot_data.json";
import { createShuffle, pickSlot } from "@/lib/tarot/deck.js";
import { screenText, mergeSafety } from "@/lib/tarot/safety.js";
import {
  buildFreeSections,
  buildLockedPreview,
  buildSafetyNotice,
  buildLinkUserBlock,
  parseLinks,
} from "@/lib/tarot/assembleReport.js";
import { parseClassification, classificationForReport, type Classification } from "@/lib/tarot-glue/classification";
import type { Links } from "@/lib/tarot/types";
import { createAdminClient } from "./supabaseAdmin";
import { aiConfigured, generateText } from "./ai";
import { CLASSIFY_SYSTEM, LINKS_SYSTEM, classifyUserMessage } from "./prompts";

// 쏠 타로 세션의 모든 서버 동작(마스터 스펙 7.7의 API 순서). DB는 service_role로만 다룬다.
// 원칙: 카드 순서는 응답에 넣지 않는다 / 결제 전 유료 본문(4~8번)은 응답에 넣지 않는다 /
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
  current_shuffle_id: string | null;
  reshuffle_count: number;
  picked_slots: number[];
  picks: Pick[];
  links: Links | null;
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
  const { error } = await db()
    .from("tarot_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
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
      result_status: "drawing",
    });
    return { urgent: false, needsClassification: false };
  }
  const text = String(body.text ?? "").trim();
  if (text.length < copy.worry.min_len) throw new TarotError(400, copy.worry.too_short);
  const worry = text.slice(0, copy.worry.max_len);
  const local = screenText(worry);
  const urgent = local.level === "urgent";
  await update(s.id, {
    worry_text: worry,
    worry_skipped: false,
    safety_level: local.level,
    violence: local.violence,
    // urgent면 카드 진행 자체가 없으므로 분류도 하지 않는다.
    classification_status: urgent || !aiConfigured() ? "failed" : "pending",
    classification: null,
    result_status: urgent ? "safety" : "drawing",
  });
  return { urgent, needsClassification: !urgent && aiConfigured() };
}

// 백그라운드: 고민 분류(A). 실패 → 1회 재시도 → 그래도 실패면 'failed'(결과는 미작성 모드처럼 조립).
export async function runClassification(sessionId: string) {
  const { data: row } = await db().from("tarot_sessions").select("worry_text").eq("id", sessionId).maybeSingle();
  const worry = row?.worry_text as string | null;
  if (!worry) return;
  let cls: Classification | null = null;
  for (let attempt = 0; attempt < 2 && !cls; attempt++) {
    try {
      cls = parseClassification(await generateText(CLASSIFY_SYSTEM, classifyUserMessage(worry), { timeoutMs: 15000, maxOutputTokens: 600 }), data);
    } catch (e) {
      console.warn("고민 분류 호출 실패:", e instanceof Error ? e.message : "unknown");
    }
  }
  // 안전 단계는 서버 키워드와 AI 중 항상 높은 쪽(mergeSafety). 분류에 실패해도 키워드 결과는 유지.
  const merged = mergeSafety(screenText(worry), cls);
  const patch: Partial<SessionRow> = {
    classification: cls,
    classification_status: cls ? "done" : "failed",
    safety_level: merged.level,
    violence: merged.violence,
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
  // 분류가 셔플·뽑기 동안 안 끝났으면 최대 12초 기다린다.
  while (Date.now() - started < 12000) {
    const { data: row } = await db().from("tarot_sessions").select("*").eq("id", sessionId).maybeSingle();
    s = row as SessionRow | null;
    if (!s || s.classification_status !== "pending") break;
    await new Promise((r) => setTimeout(r, 800));
  }
  if (!s || s.result_status === "safety" || s.safety_level === "urgent") return;
  let links: Links | null = null;
  const cls = classificationForReport(s.classification);
  if (s.worry_text && cls && aiConfigured()) {
    const userBlock = buildLinkUserBlock({ name: s.nickname, worryText: s.worry_text, cls, picks: expandPicks(s.picks), data });
    const deadline = started + 12000 + 12000;
    for (let attempt = 0; attempt < 2 && !links && userBlock; attempt++) {
      const left = deadline - Date.now();
      if (left < 2000) break;
      try {
        links = parseLinks(await generateText(LINKS_SYSTEM, userBlock, { timeoutMs: Math.min(12000, left), maxOutputTokens: 1200 }), { violence: s.violence });
      } catch (e) {
        console.warn("연결 한 줄 호출 실패:", e instanceof Error ? e.message : "unknown");
      }
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
  }
  const picks = expandPicks(s.picks);
  const cls = classificationForReport(s.classification);
  const safety = { level: s.safety_level, violence: s.violence };
  // links.step(세 번째 카드)은 결제 전이라 넘기지 않는다 — buildFreeSections는 now·hold만 쓰지만 확실히 하려고 잘라 낸다.
  const freeLinks = s.links ? { now: s.links.now, hold: s.links.hold } : null;
  const free = buildFreeSections({ name: s.nickname, cls, picks, data, links: freeLinks });
  return {
    status: "ready" as const,
    nickname: s.nickname,
    createdAt: s.created_at,
    cards: picks.map((p) => ({ ...publicCard(p.card), reversed: p.reversed, position: p.position, positionName: p.positionName })),
    free: [free.section1, free.section2, free.section3],
    notice: buildSafetyNotice({ data, safety }),
    // watch 안내 박스는 "기댈 수 있는 곳도 함께 적어 둘게요"라고 말하므로 연락처를 같이 보여 준다.
    noticeContacts: s.safety_level === "watch" ? data.copy.safety.urgent_contacts : null,
    locked: buildLockedPreview(data, picks),
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

export async function participantCount(): Promise<number | null> {
  const { count, error } = await db().from("tarot_sessions").select("id", { count: "exact", head: true });
  if (error) return null;
  return count ?? null;
}
