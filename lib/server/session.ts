import "server-only";
import { setAiLocale, withAiSession } from "./aiUsage";
import { createHash, randomBytes } from "node:crypto";
import { bundleFor } from "@/lib/i18n/bundle";
import { toLocale, type Locale } from "@/lib/i18n/locale";
import { screenTextEn } from "@/lib/tarot-glue/screenWorryEn";
import { CONSENT_EN, CONSENT_EN_VERSION } from "@/lib/i18n/consentEn";
import { CHECKOUT_EN_VERSION } from "@/lib/i18n/checkoutEn";
import { buildOrderEmailEn, isEmail } from "@/lib/billing/orderEmailEn";
import { sendEmail } from "@/lib/email/resend";
import { kakaoImagePath, SITE_URL } from "@/lib/client/shareCard";
import { createShuffle, pickSlot } from "@/lib/tarot/deck.js";
import { mergeSafety } from "@/lib/tarot/safety.js";
import { screenWorry } from "@/lib/tarot-glue/screenWorry";
import { buildSafetyNotice } from "@/lib/tarot/assembleReport.js";
import { pkg } from "@/lib/tarot-glue/pkg";

// 결과 화면 안내 박스. 폭력 안내("때리거나 위협하는 일은…")는 띄우지 않는다(owner 2026-10-30 — 일상 연애 고민에
// 잘못 뜬 사례가 있어 완전히 없애기로 결정). 폭력 판정 자체는 그대로라 다가가기 실천·처방 제외와 방향 끄기는 유지된다.
// '관계 속 두려움' 안내는 그대로.
function resultNotice(safety: Parameters<typeof buildSafetyNotice>[0]["safety"], locale: Locale): string | null {
  return safety.violence ? null : pkg(locale).assemble.buildSafetyNotice({ data: bundleFor(locale).data, safety });
}
import { parseClassification, classificationForReport, type Classification } from "@/lib/tarot-glue/classification";
import { prepareFrame, cleanSub2, decide, buildCUserBlock, buildDUserBlock, buildE1UserBlock, buildE2UserBlock, buildUnpaidPages, buildPaidPages, sanitizeUnpaid, sanitizePaid } from "@/lib/tarot-glue/v4";
import { parseStoryApply } from "@/lib/tarot/assembleReport.js";
import { parseFrameV43 } from "@/lib/tarot/v43.js";
import { composeWorry, applyFollowup, firstQuestion, nextQuestion } from "@/lib/tarot/followup.js";
import { lintReport } from "@/lib/tarot/reportLint.js";
import { analysisFields } from "@/lib/tarot-glue/reportLines";
import { FOLLOWUP_DB, shouldAskFollowup, checkAnswers, type FollowupAnswer } from "@/lib/tarot-glue/followup";
import { MULTI_DB, multiFor, checkChoice } from "@/lib/tarot-glue/multiWorry";
import { composeFocus, applyFocus, multiQuestion } from "@/lib/tarot/multiWorry.js";
import { buildChatSummary } from "@/lib/tarot-glue/chatSummary";
import { mergeE } from "@/lib/tarot/validateV4.js";
import { REPORT_ORDER_NAME, REPORT_ORDER_NAME_EN, currencyForLocale, currentReportPrice, reportPriceFor, toMajor, toMinor, tossKeyKind, tossKeysFor, usdCheckoutEnabled, variantKeyFor, consentVersionFrom } from "@/lib/billing/pricing";
import { hasCompAccess } from "@/lib/billing/compAccess";
import { decideAfterConfirmFailure } from "@/lib/billing/confirmDecision";
import { cancelTossPayment, confirmTossPayment, getTossPayment } from "./toss";
import { kakaoApprove, kakaoCancel, kakaoOrder, kakaoReady, kakaoUserRef } from "./kakaopay";
import { KAKAOPAY_METHOD, decideAfterKakaoApproveFailure, kakaopayEnabled, pickKakaoRedirect } from "@/lib/billing/kakaopay";
import { createAdminClient } from "./supabaseAdmin";
import { aiConfigured, generateText } from "./ai";
import { frameCall, guessArea, type FrameVote } from "./frameExamples";
import { GuestLimitError, checkGuestStart } from "./guestLimit";
import { countEvent, countUtm } from "./counters";
import { sanitizeUtm, type Utm } from "@/lib/tarot-glue/utm";
import { MERGED_CLASSIFY_SYSTEM, mergedClassifyEnabled, splitMerged } from "./mergedClassify";
import { CLASSIFY_SYSTEM, FRAME_SYSTEM, C_SYSTEM, C_FREE_ADDENDUM, D_SYSTEM, E1_SYSTEM, E2_SYSTEM, worryUserMessage } from "./prompts";
import { pickFreeLines, isLongWorry, type FreeLines } from "@/lib/tarot-glue/freeLines";
import situationLines from "@/data/situation_lines.json";
import { CLASSIFY_SYSTEM_EN, FRAME_SYSTEM_EN, C_SYSTEM_EN, D_SYSTEM_EN, E1_SYSTEM_EN, E2_SYSTEM_EN } from "./prompts_en";

// 쏠 타로 세션의 모든 서버 동작(마스터 스펙 7.7의 API 순서). DB는 service_role로만 다룬다.
// v4.0(2026-10-20): 결과 11쪽. 고민 제출 → A 분류 + A2 고민 틀 / 3장째 → 방향 계산(코드) + C / 결제 후 → D·E(결제 연동 때).
// 원칙: 카드 순서는 응답에 넣지 않는다 / 결제 전 유료 본문(5쪽 결론부터, 6~11쪽)은 응답에 넣지 않는다 /
//      고민 원문은 로그에 남기지 않는다 / 실패하면 더 조심스러운 쪽으로.

type Pick = { id: string; reversed: boolean; position: string };
export type SessionRow = {
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
  // 영문판(2026-11-05) — 마이그레이션 20261105000100 전에는 없음(= 한국어). 결과는 만든 언어로 고정.
  locale?: string | null;
  worry_consent_at?: string | null;
};

export class TarotError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
const db = () => createAdminClient();
// v2.3.4: 7쪽 시기 답은 '테스트를 본 날'의 달에서 센다. 다시 열어도 같은 달이 나오게 세션을 만든 시각을 쓴다(새 칸 없음).
const viewedAt = (s: { created_at?: string }) => (s.created_at ? new Date(s.created_at) : new Date());
const localeOf = (s: { locale?: string | null }): Locale => toLocale(s.locale);
const B = (s: { locale?: string | null }) => bundleFor(localeOf(s));
/** 언어별 서버 키워드 확인 — 영어는 정규식 사전·제외 목록(lib/tarot-glue/screenWorryEn.ts). */
const screenFor = (locale: Locale, text: string) => (locale === "en" ? screenTextEn(text) : screenWorry(text));
/** 언어별 프롬프트(영어는 docs/spec/en 원문 → prompts_en.ts). */
function promptsFor(locale: Locale) {
  return locale === "en"
    ? { A: CLASSIFY_SYSTEM_EN, A2: FRAME_SYSTEM_EN, C: C_SYSTEM_EN, D: D_SYSTEM_EN, E1: E1_SYSTEM_EN, E2: E2_SYSTEM_EN }
    : { A: CLASSIFY_SYSTEM, A2: FRAME_SYSTEM, C: C_SYSTEM, D: D_SYSTEM, E1: E1_SYSTEM, E2: E2_SYSTEM };
}

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

/** 결과에 저장된 광고 소재(칸이 없거나 비면 null) */
function utmOf(s: object | null | undefined): Utm | null {
  return s ? sanitizeUtm((s as { utm?: unknown }).utm) : null;
}

// ---------- 1. 세션 시작 ----------

export async function createSession(input: { nickname: unknown; experience: unknown; userId: string | null; headers: { get(name: string): string | null }; locale?: unknown; termsConsent?: unknown; utm?: unknown }) {
  const locale = toLocale(input.locale);
  const copy = bundleFor(locale).data.copy;
  // 영문판: 18세 이상·이용약관·개인정보처리방침 동의(정책 문서 08 ①) — 화면에서 체크해도 서버가 한 번 더 확인한다.
  if (locale === "en" && input.termsConsent !== true) throw new TarotError(400, CONSENT_EN.termsMissing);
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
  // 광고 소재(owner 2026-11-14): 브라우저가 보낸 첫 방문 utm을 다시 검사해 저장(칸이 없으면 — 마이그레이션 20261114000000 전 — 빼고 다시 저장)
  const utm = sanitizeUtm(input.utm);
  let withUtm = Boolean(utm);
  const insert = (withLocale: boolean) =>
    db()
      .from("tarot_sessions")
      .insert({
        access_key_hash: hashKey(key),
        user_id: input.userId,
        nickname: nickname.slice(0, copy.welcome.max_len),
        experience,
        ...(withUtm ? { utm } : {}),
        ...(withLocale ? { locale, terms_consent_at: new Date().toISOString(), consent_version: CONSENT_EN_VERSION } : {}),
      })
      .select("id")
      .single();
  // 한국어 세션은 locale 칸을 쓰지 않는다(칸 기본값 'ko' — 마이그레이션 전에도 그대로 동작).
  // 영문 세션은 칸이 없으면 만들지 않는다 — 언어가 빠진 채 저장되면 뒤 단계가 한국어로 돌아가므로(fail closed).
  let { data: row, error } = await insert(locale === "en");
  if (error && withUtm && /utm/.test(error.message)) {
    console.warn("tarot_sessions.utm 칸 없음(마이그레이션 20261114000000 실행 필요) — 광고 소재 없이 저장");
    withUtm = false;
    ({ data: row, error } = await insert(locale === "en"));
  }
  if (error && locale === "en" && /locale|consent/.test(error.message)) {
    console.error("tarot_sessions.locale 칸 없음(마이그레이션 20261105000100 실행 필요) — 영문 세션을 만들지 않음");
    throw new TarotError(503, "잠시 후 다시 시도해 주세요.");
  }
  if (error || !row) {
    console.error("tarot_sessions 생성 실패:", error?.message);
    throw new TarotError(500, "잠시 후 다시 시도해 주세요.");
  }
  await countEvent("started");
  await countUtm(withUtm ? utm : null, "started");
  return { id: row.id as string, key };
}

// ---------- 2. 고민 제출 / 건너뛰기 ----------

// 반환값 urgent=true면 화면은 안전 안내로. AI 분류는 호출한 라우트가 after()로 백그라운드 실행한다.
export async function submitWorry(s: SessionRow, body: { text?: unknown; skip?: unknown; consent?: unknown }) {
  const copy = B(s).data.copy;
  const en = localeOf(s) === "en";
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
    await countUtm(utmOf(s), "skip");
    return { urgent: false, needsClassification: false };
  }
  const text = String(body.text ?? "").trim();
  if (text.length < copy.worry.min_len) throw new TarotError(400, copy.worry.too_short);
  // 영문판: 고민 글 이용 별도 동의(정책 문서 08 ②) — 고민을 쓸 때만. 건너뛰기에는 필요 없다.
  if (en && body.consent !== true) throw new TarotError(400, CONSENT_EN.worryMissing);
  const worry = text.slice(0, copy.worry.max_len);
  const local = screenFor(localeOf(s), worry);
  const urgent = local.level === "urgent";
  // v2.3.21 여러 고민을 한꺼번에 썼으면 뽑기 전에 하나를 고르게 한다. 이 질문이 나가면 짧은 고민 다시 묻기는 건너뜀(질문 화면은 한 번만).
  const multi = !urgent && aiConfigured() ? multiFor(worry, { urgent, locale: localeOf(s) }) : null;
  const ask = !urgent && aiConfigured() && (Boolean(multi) || shouldAskFollowup(s.id, worry, { urgent, locale: localeOf(s) }));
  await update(s.id, {
    worry_text: worry,
    worry_skipped: false,
    ...(en ? { worry_consent_at: new Date().toISOString() } : {}),
    safety_level: local.level,
    violence: local.violence,
    fear: local.fear,
    frame: null,
    // urgent면 카드 진행 자체가 없으므로 분류도 하지 않는다.
    // v2.3.14 다시 묻기: 짧은 글(B칸)이면 고르기 답을 받은 뒤에 분류한다(classification_status "followup" — 답·건너뛰기·섞기 중 먼저 오는 것에서 시작).
    classification_status: urgent || !aiConfigured() ? "failed" : ask ? "followup" : "pending",
    classification: null,
    result_status: urgent ? "safety" : "drawing",
  });
  if (urgent) await countEvent("safety");
  await countUtm(utmOf(s), "worry");
  if (multi) return { urgent, needsClassification: false, multi: multiQuestion(multi, MULTI_DB, s.nickname ?? "") };
  if (ask) return { urgent, needsClassification: false, followup: await withAiSession(s.id, localeOf(s), () => followupStart(worry)) };
  return { urgent, needsClassification: !urgent && aiConfigured() };
}

// 다시 묻기 첫 화면. 2026-11-14(owner): 비슷한 고민들로 분야를 짐작할 수 있으면 첫 질문을 건너뛰고 그 분야의 둘째 질문부터
// (화면에 "{분야} 고민으로 읽었어요." + [다른 분야예요]로 첫 질문으로 돌아갈 수 있음). 짐작은 고민 글을 저장하지 않는 검색만(AI 호출 없음).
async function followupStart(worry: string) {
  const db = FOLLOWUP_DB as typeof FOLLOWUP_DB & { guess_line?: string; guess_change?: string };
  const base = { intro: db.intro, skip: db.skip, first: firstQuestion(db), guessed: null as null | { id: string; line: string; change: string } };
  const g = await guessArea(worry);
  if (!g || !db.guess_line || !db.guess_change) return base;
  const preset = [{ q: "q1", id: g.id }];
  const second = nextQuestion(db, preset);
  const label = firstQuestion(db)?.options.find((o) => o.id === g.id)?.label;
  if (!second || !label) return base;
  return { ...base, first: second, guessed: { id: g.id, line: db.guess_line.replace("{area}", label), change: db.guess_change } };
}

// v2.3.14 다시 묻기 답(또는 건너뛰기 = 빈 목록). 답을 받은 뒤에만 분류를 시작한다.
// 반환값 start=true면 라우트가 after()로 runClassification(id, answers)를 돌린다.
// v2.3.21 여러 고민 고르기도 같은 길로 받는다: {multi: 선택 id}. 선택 id는 저장된 고민 글로 선택지를 다시 만들어 검사(맞지 않으면 고르지 않은 것으로).
export async function submitFollowup(s: SessionRow, body: { answers?: unknown; guessed?: unknown; multi?: unknown }): Promise<{ start: boolean; answers: FollowupAnswer[] | null; guessed: boolean; multi: string | null }> {
  if (s.classification_status !== "followup") return { start: false, answers: [], guessed: false, multi: null }; // 이미 시작됨(연타·섞기 먼저)
  await update(s.id, { classification_status: "pending" });
  const detect = multiFor(s.worry_text, { urgent: s.safety_level === "urgent", locale: localeOf(s) });
  if (detect) return { start: true, answers: null, guessed: false, multi: checkChoice(detect, body.multi) };
  const answers = checkAnswers(body.answers ?? []) ?? [];
  // guessed = 첫 질문(분야)을 서버가 짐작해 건너뛰었고 사람이 바꾸지 않음 — 기록(frame.followup.guessed)에만 남긴다
  return { start: true, answers, guessed: body.guessed === true && answers[0]?.q === "q1", multi: null };
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

// v2.3.7: 한국어 고민 틀은 '부분 살리기'(parseFrameV43 — 고칠 수 있는 칸은 고치고, 그래도 안 되면 표 없이 결국 묻는 것만 살림).
// 영문판은 영어 패키지 검증기 그대로.
function parseFrameFor(locale: Locale, raw: unknown): { frame: unknown; errors: string[] } {
  if (locale === "en") return pkg(locale).validate.parseFrame(raw as string);
  const r = parseFrameV43(raw);
  if (r.salvaged) console.warn("고민 틀(A2) 부분 살리기:", r.fixed.length, "칸 고침");
  // 저장하기 전에도 2순위 세부를 정리(1순위와 같은 값·없는 id는 비움 — 관리자 엑셀·분석에 잘못된 값이 남지 않게)
  return { frame: cleanSub2(r.frame as { sub_id?: unknown; sub2?: unknown } | null), errors: r.errors };
}

// followup: 다시 묻기를 보여 준 세션이면 고른 답(건너뛰면 []), 보여 주지 않았으면 null.
//   답은 고민 글 뒤에 "(덧붙임: …)"으로 붙여 AI(A·A2)와 비슷한 예시 찾기에 넘기고(composeWorry — 저장된 고민 글은 그대로),
//   고민 틀이 나온 뒤 빈 칸만 채운다(applyFollowup). 안전 키워드 검사는 원문으로.
// multiChoice: 여러 고민 질문에서 고른 id(고르지 않고 섞기로 넘어왔으면 null). 여러 고민 글인지는 저장된 글로 다시 판단한다.
//   고른 고민은 "(고른 고민: 연애)"로 AI 글에만 붙이고(composeFocus — 저장된 고민 글은 그대로), 고민 틀에 focus를 단다(applyFocus).
// AI 사용량 기록(tarot_ai_usage)에 이 결과 번호가 붙도록 맥락을 연다(owner 2026-11-23).
export function runClassification(sessionId: string, followup: FollowupAnswer[] | null = null, guessed = false, multiChoice: string | null = null) {
  return withAiSession(sessionId, null, () => runClassificationInner(sessionId, followup, guessed, multiChoice));
}
async function runClassificationInner(sessionId: string, followup: FollowupAnswer[] | null = null, guessed = false, multiChoice: string | null = null) {
  const { data: row } = await db().from("tarot_sessions").select("*").eq("id", sessionId).maybeSingle();
  const original = row?.worry_text as string | null;
  if (!original) return;
  const locale = localeOf(row as SessionRow);
  setAiLocale(locale);
  const multi = followup && followup.length ? null : multiFor(original, { urgent: row?.safety_level === "urgent", locale });
  if (multi) followup = null; // 여러 고민 질문을 보낸 세션(섞기로 넘어오면 []가 옴) — 다시 묻기 기록을 남기지 않는다
  const worry = followup && followup.length ? composeWorry(original, followup, FOLLOWUP_DB) : multi ? composeFocus(original, multiChoice, multi, MULTI_DB) : original;
  const { data } = bundleFor(locale);
  const P = promptsFor(locale);
  const msg = worryUserMessage(worry);
  // v4.1: A2 사용자 입력에 비슷한 고민의 정답 5개를 붙이고(few-shot), 같은 5개의 투표를 두 번째 의견용으로 저장한다.
  // 비슷한 예시 찾기(의미 검색 약 1초)는 A2에만 필요 — 고민 분류(A)는 기다리지 않고 바로 시작한다(2026-11-09).
  const fcP = frameCall(worry, locale);
  const callA = () => tryTwice("고민 분류(A)", async () => parseClassification(await generateText(P.A, msg, { timeoutMs: 15000, maxOutputTokens: 800, label: "A" }), data));
  const callA2 = () =>
    tryTwice("고민 틀(A2)", async () => {
      const fc = await fcP;
      const r = parseFrameFor(locale, await generateText(P.A2, fc.user, { timeoutMs: 15000, maxOutputTokens: 800, label: "A2" }));
      // 탈락 이유는 운영 로그에만(내용 없이 규칙 이름만)
      if (!r.frame && r.errors.length) console.warn("고민 틀(A2) 검증 탈락:", r.errors.length, "건");
      return r.frame;
    });
  let cls: Classification | null = null;
  let frame: unknown = null;
  // 합친 호출은 한국어 프롬프트로만 평가했으므로 영문판은 따로 부른다.
  if (mergedClassifyEnabled() && locale === "ko") {
    // A+A2 한 번 호출(owner 2026-10-26). 어느 절반이든 검증을 못 넘으면 그 절반만 예전처럼 따로 다시 부른다 —
    // 특히 안전 판단(A)이 빠진 채로 넘어가지 않게.
    try {
      const parts = splitMerged(await generateText(MERGED_CLASSIFY_SYSTEM, (await fcP).user, { timeoutMs: 20000, maxOutputTokens: 2400, label: "A+A2" }));
      cls = parts.classification ? parseClassification(parts.classification, data) : null;
      frame = parts.frame ? parseFrameFor(locale, parts.frame).frame : null;
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
  // v3.0 개발 요청 1: 세부(sub_id)가 비면 한 번 더 판별(운영 11/9~15 세부 없음 5.3%, 긴 글·여러 고민 글에 몰림).
  // 다시 부른 결과에 세부가 있을 때만 바꾼다(없거나 실패하면 처음 것 그대로). 한국어만 — 영문판은 세부가 없다.
  if (locale === "ko" && frame && !(frame as { sub_id?: unknown }).sub_id) {
    try {
      const again = parseFrameFor(locale, await generateText(P.A2, (await fcP).user, { timeoutMs: 15000, maxOutputTokens: 800, label: "A2-sub" })).frame;
      if (again && (again as { sub_id?: unknown }).sub_id) frame = again;
    } catch (e) {
      console.warn("고민 틀(A2) 세부 다시 판별 실패:", e instanceof Error ? e.message : "unknown");
    }
  }
  // 안전 단계는 서버 키워드와 AI 중 항상 높은 쪽(mergeSafety — v4.1: none < watch < urgent, CSO 2026-10-22).
  // urgent만 카드를 멈추고, watch는 결과 그대로 + 마지막 쪽 맨 아래 109 안내 한 줄. 분류에 실패해도 키워드 결과는 유지.
  if (frame && followup) frame = followup.length ? applyFollowup(frame, followup, FOLLOWUP_DB) : { ...(frame as object), followup: { answers: [], filled: [], skipped: true } };
  if (frame && multi) frame = applyFocus(frame, multi, multiChoice, MULTI_DB);
  if (frame && guessed) { const f = frame as { followup?: Record<string, unknown> }; if (f.followup) f.followup = { ...f.followup, guessed: true }; }
  const merged = mergeSafety(screenFor(locale, original), cls);
  const patch: Partial<SessionRow> = {
    classification: cls,
    classification_status: cls ? "done" : "failed",
    safety_level: merged.level,
    violence: merged.violence,
    fear: merged.fear,
    frame,
    frame_vote: (await fcP).vote,
  };
  if (merged.level === "urgent") patch.result_status = "safety";
  await update(sessionId, patch);
  // 키워드로 이미 멈춘 고민은 분류를 부르지 않으므로 여기는 AI가 처음 위험으로 본 경우만 — 두 번 세지 않는다.
  if (merged.level === "urgent") await countEvent("safety");
}

// 고민 분류(A) 마지막 재시도(12초, 1번). 성공하면 안전 단계를 키워드와 다시 합쳐(항상 높은 쪽) 저장하고 새 행을 돌려준다.
// 실패해도 결과는 예전처럼 분류 없이 진행(3쪽은 고민을 쓴 사람용 문장 — reorderSecret wrote).
async function retryClassification(s: SessionRow): Promise<SessionRow | null> {
  const locale = localeOf(s);
  setAiLocale(locale);
  const { data } = bundleFor(locale);
  try {
    const cls = parseClassification(await generateText(promptsFor(locale).A, worryUserMessage(s.worry_text ?? ""), { timeoutMs: 12000, maxOutputTokens: 800, label: "A-retry" }), data);
    if (!cls) return null;
    const merged = mergeSafety(screenFor(locale, s.worry_text ?? ""), cls);
    const patch: Partial<SessionRow> = { classification: cls, classification_status: "done", safety_level: merged.level, violence: merged.violence, fear: merged.fear };
    if (merged.level === "urgent") patch.result_status = "safety";
    await update(s.id, patch);
    if (merged.level === "urgent") await countEvent("safety");
    return { ...s, ...patch } as SessionRow;
  } catch (e) {
    console.warn("고민 분류(A) 재시도 실패:", e instanceof Error ? e.message : "unknown");
    return null;
  }
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

// 반환값의 startClassification=true면 라우트가 after()로 분류를 시작한다(다시 묻기에 답하지 않고 섞기로 넘어온 경우 — 건너뛴 것으로).
export async function shuffle(s: SessionRow) {
  assertNotSafety(s);
  const startClassification = s.classification_status === "followup";
  if (startClassification) await update(s.id, { classification_status: "pending" });
  if (s.result_status === "started") throw new TarotError(409, "고민 쓰기부터 해 주세요.");
  if (s.picks.length > 0) throw new TarotError(409, "이미 카드를 뽑기 시작했어요.");
  const sh = createShuffle(B(s).data);
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
  return { shuffleId: sh.shuffleId, count: sh.order.length, startClassification };
}

// ---------- 4. 뽑기 ----------

export function publicCard(c: { id: string; no: number; name: string; character: string; image: { file: string } }) {
  return { id: c.id, no: c.no, name: c.name, character: c.character, image: `/images/tarot/${c.image.file}` };
}

// 세 번째 카드(앞으로의 열쇠)는 결제 뒤에 공개(owner 2026-11-02). 결제 전 응답에는 이 자리 표시만 보낸다(카드 이름·그림·방향 없음).
const HIDDEN_CARD = { id: "hidden", no: -1, name: "", character: "", image: "/images/tarot/card-back.webp", hidden: true } as const;
type PickView = { card: Parameters<typeof publicCard>[0]; reversed: boolean; position: string; positionName: string };
function cardsView(picks: PickView[], paid: boolean) {
  return picks.map((p, i) =>
    !paid && i === 2
      ? { ...HIDDEN_CARD, reversed: false, position: p.position, positionName: p.positionName }
      : { ...publicCard(p.card), reversed: p.reversed, position: p.position, positionName: p.positionName },
  );
}

export async function pick(s: SessionRow, body: { shuffleId?: unknown; slot?: unknown }) {
  assertNotSafety(s);
  if (!s.current_shuffle_id || body.shuffleId !== s.current_shuffle_id) throw new TarotError(409, "카드를 다시 섞어 주세요.");
  const { data: sh, error } = await db().from("tarot_shuffles").select("card_order, reversed").eq("id", s.current_shuffle_id).single();
  if (error || !sh) throw new TarotError(500, "잠시 후 다시 시도해 주세요.");
  let res;
  try {
    res = pickSlot({ order: sh.card_order, reversed: sh.reversed }, s.picked_slots, body.slot, B(s).data);
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
    // 세 번째 카드는 뽑을 때 보여 주지 않는다(결제 뒤 공개, owner 2026-11-02) — 뒷면 그대로 칸에 들어간다.
    reversed: res.isLast ? false : res.reversed,
    card: res.isLast ? null : publicCard(res.card),
    isLast: res.isLast,
  };
}

// 백그라운드(3장째 직후): 분류가 끝나길 잠깐 기다린 뒤 카드별 고민 연결 한 줄(C)을 만들고 결과를 'ready'로.
// 무료 1~3번 본문은 읽을 때마다 같은 재료(picks·분류·links)로 조립하므로 따로 저장하지 않는다.
// AI 사용량 기록(tarot_ai_usage)에 이 결과 번호가 붙도록 맥락을 연다(owner 2026-11-23).
export function prepareResult(sessionId: string) {
  return withAiSession(sessionId, null, () => prepareResultInner(sessionId));
}
async function prepareResultInner(sessionId: string) {
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
  // 고민 분류(A)가 두 번 다 실패했으면(시간 초과·형식 오류) 결과를 만들기 전에 한 번 더 시도한다(2026-11-15 owner —
  // 리포트 검사 '고민 미반영'의 원인). 기다리다 놓친 경우(classificationLost)·이미 30초 넘게 기다린 경우는 함수 시간 한도(60초 = 재시도 12초 + C 12초) 때문에 건너뛴다.
  if (s && !classificationLost && Date.now() - started < 30000 && s.classification_status === "failed" && s.worry_text && s.result_status !== "safety" && s.safety_level !== "urgent" && aiConfigured()) {
    s = (await retryClassification(s)) ?? s;
  }
  if (!s || s.result_status === "safety" || s.safety_level === "urgent") return;
  // v4: 결정형이면 카드 점수로 방향을 먼저 정하고(코드), C가 그 방향에 맞춰 한 줄·질문·teaser·이유를 쓴다.
  let links: Record<string, unknown> | null = null;
  const cls = classificationForReport(s.classification);
  if (s.worry_text && aiConfigured()) {
    const locale = localeOf(s);
    setAiLocale(locale);
    const picks = expandPicks(s.picks, locale);
    const frame = prepareFrame(s.frame ?? null, cls, locale, { level: s.safety_level, violence: s.violence });
    const { decision, lean, review_log, lowered } = decide({ frame, cls, picks, name: s.nickname, safety: { violence: s.violence }, vote: s.frame_vote ?? null, locale });
    if (review_log) await saveFrameReview(s, review_log, lowered);
    const userBlock = buildCUserBlock({ name: s.nickname, worryText: s.worry_text, cls, picks, frame, lean, locale });
    // 연결 한 줄(C)은 최대 12초, 넘으면 그 줄 없이(스펙 7.7). 무료 결과에는 검수를 하지 않는다(owner 2026-10-21 비용 — 검수는 유료 1번만).
    const deadline = Date.now() + 12000;
    const parse = (raw: string) => pkg(locale).validate.parseC(raw, { decision, strength: lean?.strength ?? null, frame, lean, violence: s.violence || classificationLost });
    let best: ReturnType<typeof parse> | null = null;
    // v3.7 과제 1 2안: 41자 이상 고민이면 C 지시문 끝에 덧붙임을 붙여 1·2쪽 '글에서 짚는 한 줄'(free_lines)도 함께 받는다(한국어만).
    const longWorry = locale !== "en" && isLongWorry(s.worry_text, situationLines.free_line.min_chars);
    const cSystem = longWorry ? `${promptsFor(locale).C}\n\n${C_FREE_ADDENDUM}` : promptsFor(locale).C;
    let freeLines: FreeLines | null = null;
    for (let attempt = 0; attempt < 2 && userBlock; attempt++) {
      const left = deadline - Date.now();
      if (left < 2000) break;
      try {
        const raw = await generateText(cSystem, userBlock, { timeoutMs: left, maxOutputTokens: 2000, label: "C", reasoningEffort: "low" });
        const r = parse(raw);
        if (longWorry && !freeLines) freeLines = pickFreeLines(raw);
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
      links = freeLines ? { ...rest, free_lines: freeLines } : rest;
    }
  }
  await update(sessionId, { links, result_status: "ready" });
  await countEvent("result");
  await countUtm(utmOf(s), "result");
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

// v2.3.14 내보내기 전 검사(reportLint) — 지금은 운영 로그에 규칙 이름·건수만 남긴다(내용·고민 글은 남기지 않음).
// 차단(block)이 나와도 결과는 그대로 연다: 다시 만들거나 DB 문장으로 바꾸는 처리는 로그를 보고 정한다.
async function logReportLint(sessionId: string) {
  try {
    const { data: row } = await db().from("tarot_sessions").select("*").eq("id", sessionId).maybeSingle();
    const s = row as SessionRow | null;
    if (!s || localeOf(s) === "en") return;
    const r = await getResult(s);
    if (r.status !== "ready") return;
    // 읽기 지도([[…]])는 화면이 따로 그리는 내부 표시라 검사에서 뺀다.
    const pages = (r.pages as { page: number; body?: string | null }[]).map((p) => ({ page: p.page, body: String(p.body ?? "").replace(/\[\[[^\]]*\]\]/g, "") }));
    const f = (s.frame ?? {}) as { options?: string[] | null };
    const out = lintReport({ pages, worryText: s.worry_text ?? "", options: (f.options ?? []).filter(Boolean), skipped: Boolean(s.worry_skipped) });
    if (out.block.length || out.warn.length) console.info("리포트 검사:", "차단", out.block.map((x) => x.code).join(",") || "-", "· 기록", out.warn.map((x) => x.code).join(",") || "-");
  } catch (e) {
    console.warn("리포트 검사 실패:", e instanceof Error ? e.message : "unknown");
  }
}

/** 관리자 엑셀용 분석 칸(고민 유형·카드 모양·영역 문장). 결과 화면과 같은 재료로 다시 계산 — 한국어판·카드 3장일 때만. */
export function analysisFor(s: SessionRow): ReturnType<typeof analysisFields> | null {
  if (localeOf(s) === "en") return null;
  try {
    const cls = classificationForReport(s.classification);
    const safety = { level: s.safety_level, violence: s.violence, fear: Boolean(s.fear) };
    const frame = prepareFrame(s.frame ?? null, cls, "ko", { level: s.safety_level, violence: s.violence });
    const picks = (s.picks ?? []).length === 3 ? expandPicks(s.picks, "ko") : [];
    const lean = picks.length === 3 ? decide({ frame, cls, picks, name: s.nickname, safety, vote: s.frame_vote ?? null, locale: "ko" }).lean : null;
    return analysisFields({ frame, lean, safety, picks, worryText: s.worry_text ?? "", freeLines: (s.links as { free_lines?: FreeLines } | null)?.free_lines ?? null });
  } catch {
    return null;
  }
}

function expandPicks(picks: Pick[], locale: Locale = "ko") {
  const { data } = bundleFor(locale);
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
  if (s.picks.length < B(s).data.deck.pick_count) return { status: "drawing" as const };
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
  const locale = localeOf(s);
  setAiLocale(locale);
  const picks = expandPicks(s.picks, locale);
  const cls = classificationForReport(s.classification);
  const safety = { level: s.safety_level, violence: s.violence, fear: Boolean(s.fear) };
  const frame = prepareFrame(s.frame ?? null, cls, locale, { level: s.safety_level, violence: s.violence });
  // 방향은 저장하지 않고 매번 같은 재료(카드·고민 틀·분류)로 다시 계산한다(결정론적). 결제 전에는 응답에 싣지 않음.
  const { lean, decision } = decide({ frame, cls, picks, name: s.nickname, safety, vote: s.frame_vote ?? null, locale });
  if (paid) {
    const rep = (s.report ?? null) as { sa?: unknown; E?: unknown } | null;
    const pages = buildPaidPages({ name: s.nickname, cls, picks, safety, worryText: s.worry_text ?? "", frame, lean, C: s.links, sa: rep?.sa ?? null, E: rep?.E ?? null, locale, now: viewedAt(s) });
    return {
      status: "ready" as const,
      nickname: s.nickname,
      createdAt: s.created_at,
      cards: cardsView(picks, true),
      pages: sanitizePaid(pages, { other: lean?.other ?? null, locale }),
      notice: resultNotice(safety, locale),
      locale,
      paid: true,
      decision,
      saved: Boolean(s.user_id),
    };
  }
  const pages = buildUnpaidPages({ name: s.nickname, cls, picks, safety, worryText: s.worry_text ?? "", frame, lean, C: s.links, locale });
  return {
    status: "ready" as const,
    nickname: s.nickname,
    createdAt: s.created_at,
    cards: cardsView(picks, false),
    pages: sanitizeUnpaid(pages, locale),
    // v4: 안내 박스는 폭력(구체 행동)·관계 속 두려움일 때만(주의 단계 삭제). 결제와 상관없이 보임.
    notice: resultNotice(safety, locale),
    locale,
    paid: false,
    // 결정형 고민인지(세 장이 한쪽을 골랐는지)만 — 어느 쪽인지는 보내지 않는다. 결제 카드 문구를 고르는 데 쓴다.
    decision,
    saved: Boolean(s.user_id),
    // 카카오페이 결제가 켜져 있는지(원화 결과만) — 4쪽 결제 버튼을 카카오페이 모양으로(owner 2026-11-18)
    kakaopay: locale !== "en" && kakaopayEnabled(),
  };
}

// ---------- 결과 저장(로그인 사용자에게 연결) ----------

export async function claim(s: SessionRow, userId: string | null) {
  if (!userId) throw new TarotError(401, "로그인이 필요해요.");
  if (s.user_id && s.user_id !== userId) throw new TarotError(409, "이미 다른 계정에 저장된 결과예요.");
  if (!s.user_id) {
    await update(s.id, { user_id: userId });
    // 로그인 없이 결제한 주문도 이 계정으로 채운다(내 결과·관리자 엑셀·문의 대응). 실패해도 저장은 그대로(결과 접근은 세션이 기준)
    const { error } = await db().from("tarot_orders").update({ user_id: userId }).eq("session_id", s.id).is("user_id", null);
    if (error) console.warn("주문 계정 연결 실패:", error.message);
  }
  return { saved: true };
}

// ---------- 결제(토스) — 쏠 아스트로 하우스 결제와 같은 원칙 ----------
// ① 금액은 서버가 정한다(currentReportPrice — 2026-10-26부터 끝 없이 990원(owner 2026-11-21). 주문 행에 고정 저장해 결제 도중 날짜가 바뀌어도 그 주문 금액은 그대로) ② 토스가 돌려준 값은 믿지 않고 시크릿 키로 승인 확인(confirm)한 뒤에만 결제 완료
// ③ 돈이 나갔을 수 있으면 절대 '취소'로 바꾸지 않는다(decideAfterConfirmFailure) ④ 같은 결과를 두 번 결제하면 두 번째를 토스에서 취소.

// amount: 원화는 원, 달러는 센트(정수 칸). currency 칸은 영문 결제 마이그레이션(20261106000000) 전에는 없다 → 원화로 본다.
type OrderRow = { id: string; user_id: string | null; session_id: string; amount: number; currency?: "KRW" | "USD" | null; status: "pending" | "paid" | "canceled"; payment_key: string | null };
const CONFIRM_RETRY_MESSAGE = "결제 확인이 늦어지고 있어요. 잠시 뒤 이 화면을 새로고침해 주세요. 계속되면 contact@ssolwellness.com으로 알려 주세요.";

/**
 * 결제 화면 설정(주문 전에도 결제창을 그리려고 — owner 2026-11-04): 이 결과의 통화와 **그 통화 상점의 클라이언트 키**를 서버가 정해 준다.
 * 통화는 세션 언어로(영문 = USD) — 브라우저 언어·주소로 고르지 않는다. 클라이언트 키는 공개 값이지만 시크릿 키는 절대 보내지 않는다.
 */
export function payConfig(s: SessionRow) {
  const currency = currencyForLocale(localeOf(s));
  const clientKey = tossKeysFor(currency).clientKey;
  // variantKey: 같은 결제위젯 키로 어느 MID(원화 DEFAULT / 달러 dollar.only)를 쓸지
  // kakaopay: 카카오페이 직접 결제 버튼(원화만, CID·Secret key가 설정됐을 때만 — owner 2026-11-18)
  return { currency, clientKey, keyKind: tossKeyKind(clientKey), variantKey: variantKeyFor(currency), kakaopay: currency === "KRW" && kakaopayEnabled() };
}

export async function createOrder(s: SessionRow, userId: string | null, body: { withdrawalAck?: unknown; consentVersion?: unknown }, { email = null, country = null }: { email?: string | null; country?: string | null } = {}) {
  // 로그인 없이 결제(owner 2026-11-18): 계정에 안 붙은 결과는 결과 접근 키로 연 경우(loadSession이 이미 확인) 주문을 계정 없이 만든다.
  // 계정에 붙은 결과는 예전처럼 그 계정으로 로그인한 본인만.
  const guest = !s.user_id;
  if (!guest && s.user_id !== userId) throw new TarotError(401, "로그인한 본인 결과만 결제할 수 있어요.");
  // 영문(달러) 결제는 주문 확인 이메일을 계정 주소로 보내므로 지금처럼 로그인 필요
  if (guest && localeOf(s) === "en") throw Object.assign(new TarotError(401, "로그인이 필요해요."), { needLogin: true });
  // 청약철회 제한은 사전 고지 + 동의가 있어야 한다(약관 제13조 2항). 화면에서 체크해도 서버가 한 번 더 확인한다.
  if (body.withdrawalAck !== true) throw new TarotError(400, "이용 관련 약관에 동의해 주세요.");
  if (s.safety_level === "urgent" || s.result_status === "safety") throw new TarotError(403, "이 결과는 결제할 수 없어요.");
  if (s.picks.length < B(s).data.deck.pick_count || s.result_status !== "ready") throw new TarotError(409, "결과가 아직 준비되지 않았어요.");
  if (s.paid_at) throw Object.assign(new TarotError(409, "이미 결제한 리포트예요."), { paid: true });
  // 기간 한정 무료 열람 계정(owner 지정, lib/billing/compAccess.ts): 토스 없이 결제한 것처럼 열고 리포트를 만든다.
  // 주문·결제 기록과 결제 집계(countEvent "paid")는 남기지 않는다. 위의 본인·안전·준비 확인은 그대로 거친다.
  if (hasCompAccess(email)) {
    const now = new Date().toISOString();
    await update(s.id, { paid_at: now, report_status: "generating", report_started_at: now });
    console.info("타로 무료 열람 권한으로 리포트 열림:", s.id);
    return { comp: true as const, sessionId: s.id };
  }
  // 영문 결과는 US$1.99(할인 없음, owner 2026-11-05) — 토스 해외 결제를 켜고 확인하기 전에는 주문을 만들지 않는다.
  const en = localeOf(s) === "en";
  if (en && !usdCheckoutEnabled()) throw new TarotError(503, "영문 결제는 아직 준비 중이에요.");
  const price = en ? reportPriceFor("en") : { currency: "KRW" as const, amount: currentReportPrice() };
  const insert: Record<string, unknown> = { user_id: guest ? null : userId, session_id: s.id, amount: toMinor(price.currency, price.amount), withdrawal_version: en ? CHECKOUT_EN_VERSION : consentVersionFrom(body.consentVersion) };
  insert.currency = price.currency; // 주문 통화를 저장 — 승인·조회·취소 키를 이 값으로 고른다(마이그레이션 20261106000000 실행 완료)
  const { data: row, error } = await db().from("tarot_orders").insert(insert).select("id").single();
  const amount = price.amount;
  // 마이그레이션(20261118000000, user_id 비워 두기) 전이면 계정 없는 주문이 막힌다 — 로그인 결제로 안내(예전 동작)
  if (error?.code === "23502" && guest) throw Object.assign(new TarotError(401, "결제하려면 로그인이 필요해요."), { needLogin: true });
  if (error || !row) {
    console.error("tarot_orders 생성 실패:", error?.message);
    throw new TarotError(500, "주문을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
  // country: 영문 PayPal 결제창(API 개별 연동 키)에 넘기는 나라 — 접속 국가, 모르거나 한국이면 US(아스트로와 같음)
  const payCountry = country && /^[A-Z]{2}$/.test(country) && country !== "KR" ? country : "US";
  return { orderId: row.id as string, orderName: en ? REPORT_ORDER_NAME_EN : REPORT_ORDER_NAME, amount, currency: price.currency, clientKey: tossKeysFor(price.currency).clientKey, customerKey: guest ? null : userId, ...(en ? { country: payCountry } : {}) };
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

/**
 * 주문을 다룰 권한: 계정 주문은 그 계정 본인, 계정 없는 주문(로그인 없이 결제)은 그 결과의 접근 키 또는
 * 그 뒤 결과를 저장한 계정. 둘 다 아니면 404(주문이 있는지도 알리지 않음).
 */
async function assertOrderAccess(order: OrderRow | null, auth: { userId: string | null; key: string | null }): Promise<OrderRow> {
  if (!order) throw new TarotError(404, "주문 정보를 찾을 수 없어요.");
  if (order.user_id) {
    if (order.user_id !== auth.userId) throw new TarotError(404, "주문 정보를 찾을 수 없어요.");
    return order;
  }
  const { data } = await db().from("tarot_sessions").select("user_id, access_key_hash").eq("id", order.session_id).maybeSingle();
  const keyOk = Boolean(auth.key && data && hashKey(auth.key) === data.access_key_hash);
  const userOk = Boolean(auth.userId && data?.user_id && data.user_id === auth.userId);
  if (!keyOk && !userOk) throw new TarotError(404, "주문 정보를 찾을 수 없어요.");
  return order;
}

/** 결제 완료 뒤 공통 기록(토스·카카오페이 같게): 결과에 결제 표시 → 리포트 만들기 시작, 결제 수·광고 소재별 결제 집계. */
async function recordPaid(order: OrderRow, currency: "KRW" | "USD"): Promise<string> {
  const now = new Date().toISOString();
  await update(order.session_id, { paid_at: now, report_status: "generating", report_started_at: now });
  await countEvent("paid");
  const { data: srow } = await db().from("tarot_sessions").select("*").eq("id", order.session_id).maybeSingle();
  const u = utmOf(srow as SessionRow | null);
  await countUtm(u, "paid");
  await countUtm(u, currency === "USD" ? "paid_usd_cents" : "paid_krw", Number(order.amount) || 0);
  return now;
}

export async function confirmPayment(userId: string | null, body: { paymentKey?: unknown; orderId?: unknown; amount?: unknown }, key: string | null = null) {
  const paymentKey = typeof body.paymentKey === "string" ? body.paymentKey : "";
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  let amount = Number(body.amount);
  if (!paymentKey || !/^[0-9a-f-]{36}$/i.test(orderId) || !Number.isFinite(amount)) throw new TarotError(400, "결제 정보가 올바르지 않아요.");

  // select("*"): currency 칸이 아직 없는 DB(마이그레이션 전)에서도 한국어 주문 조회가 깨지지 않게
  const { data: o } = await db().from("tarot_orders").select("*").eq("id", orderId).maybeSingle();
  const order = await assertOrderAccess(o as OrderRow | null, { userId, key });
  if (order.status === "paid") return { ok: true, sessionId: order.session_id, generate: false }; // 새로고침 등으로 다시 온 경우
  const currency = order.currency === "USD" ? "USD" : "KRW";
  // 토스가 돌려준 금액(달러면 1.99)을 센트로 바꿔 주문 금액(정수)과 비교한다
  if (toMinor(currency, amount) !== order.amount) throw new TarotError(400, "결제 금액이 일치하지 않아요.");
  amount = toMajor(currency, order.amount);
  // 승인·조회·취소 키는 주문 통화의 상점 것만(달러 주문 = USD 상점 키) — 다른 통화 키로 대신하지 않음
  const store = currency;

  let method: string | null = null;
  let tossEmail: string | null = null;
  if (order.status === "pending") {
    // 같은 결과를 이미 결제했다면(다른 탭의 주문) 토스 승인을 하지 않는다 — 승인 전이면 카드에서 돈이 나가지 않는다.
    const { data: sess } = await db().from("tarot_sessions").select("paid_at").eq("id", order.session_id).maybeSingle();
    if (sess?.paid_at) {
      await settleOrder(orderId, "canceled");
      throw Object.assign(new TarotError(409, "이미 결제한 결과예요. 결과 화면에서 바로 볼 수 있어요."), { sessionId: order.session_id });
    }
    const r = await confirmTossPayment({ paymentKey, orderId, amount }, store);
    if (!r.ok) console.warn("토스 승인 실패:", { currency: store, code: r.code, network: r.network }); // 금액·키·이메일은 남기지 않음
    if (r.ok) {
      method = r.method;
      tossEmail = r.customerEmail ?? null;
    }
    else {
      // 승인 응답이 실패여도 토스에서는 이미 승인됐을 수 있다 — 실제 상태를 물어 DONE이면 결제 완료, 확실히 아니면 취소, 모르면 재시도 안내.
      const lookup = await getTossPayment(paymentKey, store);
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
    const lookup = await getTossPayment(paymentKey, store);
    if (decideAfterConfirmFailure(lookup, { orderId, amount }) !== "paid") throw new TarotError(409, "이미 처리된 주문이에요.");
    method = lookup?.method ?? null;
  }

  // 여기부터는 토스 승인이 확인됨.
  const saved = await markOrderPaid(orderId, { paymentKey, method });
  if (saved === "duplicate") {
    const refunded = await cancelTossPayment(paymentKey, "같은 결과에 대한 중복 결제", store);
    if (refunded) await settleOrder(orderId, "canceled");
    console.error(refunded ? "타로 중복 결제 취소함" : "타로 중복 결제 취소 실패(수동 확인 필요)", orderId);
    throw Object.assign(new TarotError(409, refunded ? "이미 결제한 결과라 이번 결제는 취소했어요." : CONFIRM_RETRY_MESSAGE), { sessionId: order.session_id });
  }
  const now = await recordPaid(order, currency);
  // 영문(달러) 주문은 결제가 처음 완료될 때 한 번 주문 확인 이메일(08 §4) — 보내는 일은 라우트가 응답 뒤(after)에
  const orderEmail = currency === "USD" && order.user_id ? { orderId, userId: order.user_id, method, tossEmail, paidAt: new Date(now) } : null;
  return { ok: true, sessionId: order.session_id, generate: true, orderEmail, paidOrder: { orderId, amount: toMajor(currency, order.amount), currency } };
}

// ── 카카오페이 직접 결제(owner 2026-11-18) ──────────────────────────────────────────────
// 주문은 토스와 같은 createOrder로 만들고(금액은 서버가 정함), 준비 단계에서 받은 tid를 그 주문의 payment_key에,
// method는 '카카오페이'로 저장한다(새 칸·마이그레이션 없음). 승인 뒤 기록은 토스와 같은 recordPaid.
const UUID_RE = /^[0-9a-f-]{36}$/i;

async function loadOwnOrder(auth: { userId: string | null; key: string | null }, orderId: unknown): Promise<OrderRow> {
  if (typeof orderId !== "string" || !UUID_RE.test(orderId)) throw new TarotError(400, "결제 정보가 올바르지 않아요.");
  const { data } = await db().from("tarot_orders").select("*").eq("id", orderId).maybeSingle();
  return assertOrderAccess(data as OrderRow | null, auth);
}

/** 결제 준비: 카카오페이 결제 화면 주소를 돌려준다. returnOrigin은 라우트가 우리 사이트로 확인한 주소. */
export async function kakaopayReadyForOrder(auth: { userId: string | null; key: string | null }, body: { orderId?: unknown; page?: unknown }, ctx: { returnOrigin: string; userAgent: string }) {
  if (!kakaopayEnabled()) throw new TarotError(503, "카카오페이 결제가 아직 준비되지 않았어요.");
  const order = await loadOwnOrder(auth, body.orderId);
  if (order.status !== "pending") throw Object.assign(new TarotError(409, "이미 처리된 주문이에요."), { sessionId: order.session_id });
  if (order.currency === "USD") throw new TarotError(400, "카카오페이는 원화 결제만 돼요.");
  const { data: sess } = await db().from("tarot_sessions").select("paid_at").eq("id", order.session_id).maybeSingle();
  if (sess?.paid_at) {
    await settleOrder(order.id, "canceled");
    throw Object.assign(new TarotError(409, "이미 결제한 리포트예요."), { paid: true, sessionId: order.session_id });
  }
  const page = Math.min(11, Math.max(1, Number.parseInt(String(body.page ?? "4"), 10) || 4));
  const o = ctx.returnOrigin;
  const back = `id=${order.session_id}&page=${page}`;
  const r = await kakaoReady({
    orderId: order.id,
    userRef: kakaoUserRef(order.user_id ?? `guest:${order.session_id}`),
    itemName: REPORT_ORDER_NAME,
    amount: order.amount,
    approvalUrl: `${o}/checkout/kakaopay?orderId=${order.id}&${back}`,
    cancelUrl: `${o}/checkout/fail?${back}&code=KAKAOPAY_CANCEL`,
    failUrl: `${o}/checkout/fail?${back}&code=KAKAOPAY_FAIL&orderId=${order.id}`,
  });
  if (!r.ok) {
    console.warn("카카오페이 준비 실패:", { code: r.code, network: r.network }); // 키·금액·사용자 정보는 남기지 않음
    throw new TarotError(502, `카카오페이 결제를 시작하지 못했어요. ${r.message}${r.code ? ` (오류 코드 ${r.code})` : ""}`);
  }
  const redirectUrl = pickKakaoRedirect(ctx.userAgent, r.body);
  if (!r.body.tid || !redirectUrl) throw new TarotError(502, "카카오페이 결제를 시작하지 못했어요.");
  const { error } = await db().from("tarot_orders").update({ payment_key: r.body.tid, method: KAKAOPAY_METHOD }).eq("id", order.id).eq("status", "pending");
  if (error) {
    console.error("카카오페이 tid 저장 실패:", error.message);
    throw new TarotError(500, "결제를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
  return { redirectUrl };
}

/** 결제 승인: 카카오페이가 돌려준 pg_token으로 승인 → 금액 확인 → 결제 완료 기록(토스와 같은 규칙). */
export async function kakaopayApproveOrder(auth: { userId: string | null; key: string | null }, body: { orderId?: unknown; pgToken?: unknown }) {
  const order = await loadOwnOrder(auth, body.orderId);
  if (order.status === "paid") return { ok: true, sessionId: order.session_id, generate: false }; // 새로고침 등
  const pgToken = typeof body.pgToken === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(body.pgToken) ? body.pgToken : "";
  const tid = order.payment_key ?? "";
  if (!pgToken || !tid) throw new TarotError(400, "결제 정보가 올바르지 않아요.");
  const userRef = kakaoUserRef(order.user_id ?? `guest:${order.session_id}`); // 준비 때와 같은 값이어야 한다
  const expect = { orderId: order.id, amount: order.amount };

  if (order.status === "pending") {
    const { data: sess } = await db().from("tarot_sessions").select("paid_at").eq("id", order.session_id).maybeSingle();
    if (sess?.paid_at) {
      // 승인 전이라 카카오페이에서 돈이 나가지 않는다
      await settleOrder(order.id, "canceled");
      throw Object.assign(new TarotError(409, "이미 결제한 결과예요. 결과 화면에서 바로 볼 수 있어요."), { sessionId: order.session_id });
    }
    const r = await kakaoApprove({ tid, orderId: order.id, userRef, pgToken });
    if (r.ok) {
      const total = r.body.amount?.total;
      if (r.body.partner_order_id !== order.id || total !== order.amount) {
        // 주문과 다른 결제가 승인됨 — 바로 전액 취소하고 멈춘다
        const refunded = await kakaoCancel(tid, typeof total === "number" ? total : order.amount);
        if (refunded) await settleOrder(order.id, "canceled");
        console.error(refunded ? "카카오페이 금액 불일치 — 취소함" : "카카오페이 금액 불일치 — 취소 실패(수동 확인 필요)", order.id);
        throw new TarotError(400, "결제 금액이 일치하지 않아 결제를 취소했어요.");
      }
    } else {
      console.warn("카카오페이 승인 실패:", { code: r.code, network: r.network });
      // 승인 응답이 실패여도 이미 승인됐을 수 있다 — 실제 상태를 물어 판단(돈이 나갔을 수 있으면 취소로 바꾸지 않음)
      const d = decideAfterKakaoApproveFailure(await kakaoOrder(tid), expect);
      if (d === "cancel") {
        await settleOrder(order.id, "canceled");
        throw new TarotError(502, `카카오페이 결제가 완료되지 않았어요. ${r.message}${r.code ? ` (오류 코드 ${r.code})` : ""}`);
      }
      if (d === "retry") throw new TarotError(503, CONFIRM_RETRY_MESSAGE);
    }
  } else {
    // 'canceled' 주문: 잘못 취소됐을 수 있으니 실제로 결제됐는지만 확인(다시 승인하지 않음)
    if (decideAfterKakaoApproveFailure(await kakaoOrder(tid), expect) !== "paid") throw new TarotError(409, "이미 처리된 주문이에요.");
  }

  // 여기부터는 카카오페이 결제가 확인됨
  const saved = await markOrderPaid(order.id, { paymentKey: tid, method: KAKAOPAY_METHOD });
  if (saved === "duplicate") {
    const refunded = await kakaoCancel(tid, order.amount);
    if (refunded) await settleOrder(order.id, "canceled");
    console.error(refunded ? "타로 중복 결제(카카오페이) 취소함" : "타로 중복 결제(카카오페이) 취소 실패(수동 확인 필요)", order.id);
    throw Object.assign(new TarotError(409, refunded ? "이미 결제한 결과라 이번 결제는 취소했어요." : CONFIRM_RETRY_MESSAGE), { sessionId: order.session_id });
  }
  await recordPaid(order, "KRW");
  return { ok: true, sessionId: order.session_id, generate: true, amount: order.amount, paidOrder: { orderId: order.id, amount: order.amount, currency: "KRW" as const } };
}

/** 로그인 계정의 이메일(auth). user_metadata는 사용자가 바꿀 수 있어 쓰지 않는다(아스트로 getAccountEmail과 같은 규칙). */
async function accountEmail(userId: string): Promise<string | null> {
  const { data, error } = await db().auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  const fromIdentity = (data.user.identities ?? [])
    .map((i) => (i.identity_data ?? {}) as Record<string, unknown>)
    .map((d) => (typeof d.email === "string" ? d.email : ""))
    .find((e) => e) ?? "";
  const email = data.user.email || fromIdentity;
  return isEmail(email) ? email : null;
}

/**
 * 영문 주문 확인 이메일(쏠 아스트로 하우스와 같은 방식). 받는 사람: 로그인 계정 이메일 → 토스 결제창에서 받은 이메일.
 * 고민 글·해석은 넣지 않는다 — 세 번째 카드 그림·이름(결제 뒤라 공개)과 주문 내역만. 실패해도 결제·리포트에는 영향 없다.
 * 받는 주소·본문은 로그에 남기지 않는다.
 */
export async function sendOrderEmailEn(sessionId: string, m: { orderId: string; userId: string; method: string | null; tossEmail: string | null; paidAt: Date }) {
  try {
    const to = (await accountEmail(m.userId)) ?? (isEmail(m.tossEmail) ? m.tossEmail : null);
    if (!to) return console.warn("영문 주문 확인 이메일: 받을 주소 없음");
    const { data: row } = await db().from("tarot_sessions").select("*").eq("id", sessionId).maybeSingle();
    const s = row as SessionRow | null;
    const key = s ? expandPicks(s.picks, "en")[2] : null;
    const mail = buildOrderEmailEn({
      orderId: m.orderId,
      paidAt: m.paidAt,
      method: m.method,
      resultId: sessionId,
      imageUrl: key ? `${SITE_URL}${kakaoImagePath(String(key.card.image), Boolean(key.reversed))}` : null,
      cardName: key ? String(key.card.name) : null,
      nickname: s?.nickname ?? null,
    });
    const r = await sendEmail({ to, ...mail, from: "SSOL Tarot House <noreply@ssolwellnesshouse.com>" });
    if (!r.ok) console.error("영문 주문 확인 이메일 실패:", r.reason);
  } catch (e) {
    console.error("영문 주문 확인 이메일 오류:", e instanceof Error ? e.name : "unknown");
  }
}

// 결제 직후(백그라운드): D(5·6쪽)·E1(7쪽)·E2(8·9쪽)를 **동시에** 부른다(v4.2 패키지 — E를 둘로 나눠 속도를 줄임).
// owner 2026-10-22 "검수하지마": 검수 단계는 없다. 안전·형식 검사는 그대로(parseStoryApply·parseE part E1/E2).
// 9쪽 '오늘' 실천과 카드별 이유는 AI가 쓰지 않는다(DB — pagesV4.todayFromDb, decision.lean().cards[].reason).
// 검증에서 떨어지면 그 부분만 1회 다시 부르고, 그래도 안 되면 그 부분은 패키지 대체 경로(DB 문장) — README_v4.
// AI 사용량 기록(tarot_ai_usage)에 이 결과 번호가 붙도록 맥락을 연다(owner 2026-11-23).
export function generateReport(sessionId: string) {
  return withAiSession(sessionId, null, () => generateReportInner(sessionId));
}
async function generateReportInner(sessionId: string) {
  const { data: row } = await db().from("tarot_sessions").select("*").eq("id", sessionId).maybeSingle();
  const s = row as SessionRow | null;
  if (!s || !s.paid_at) return;
  let sa: ReturnType<typeof parseStoryApply> | null = null;
  let E: unknown = null;
  try {
    const cls = classificationForReport(s.classification);
    if (s.worry_text && cls && aiConfigured()) {
      const locale = localeOf(s);
      setAiLocale(locale);
      const P = promptsFor(locale);
      const picks = expandPicks(s.picks, locale);
      const frame = prepareFrame(s.frame ?? null, cls, locale, { level: s.safety_level, violence: s.violence });
      const { lean } = decide({ frame, cls, picks, name: s.nickname, safety: { violence: s.violence }, vote: s.frame_vote ?? null, locale });
      // 분류가 실패했으면 폭력 여부를 모르므로 더 조심스러운 쪽(violence=true)으로(스펙 6장 fail safe)
      const violence = s.violence || s.classification_status === "failed";
      const safety = { level: s.safety_level, violence, fear: Boolean(s.fear) };
      const args = { name: s.nickname, worryText: s.worry_text, cls, picks, frame, lean, locale, now: viewedAt(s) };
      const dBlock = buildDUserBlock({ ...args, safety });
      const e1Block = buildE1UserBlock(args);
      const e2Block = buildE2UserBlock(args);

      const runD = async () => {
        let best: ReturnType<typeof parseStoryApply> | null = null;
        for (let i = 0; i < 2 && dBlock; i++) {
          try {
            const r = pkg(locale).assemble.parseStoryApply(await generateText(P.D, dBlock, { timeoutMs: 50000, maxOutputTokens: 6000, label: "D" }), { violence });
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
            const r = pkg(locale).validate.parseE(await generateText(system, block, { timeoutMs: 50000, maxOutputTokens: 6000, label: part }), { lean, frame, violence, part, worryText: s.worry_text ?? "" });
            if (r.warnings.length) console.info(`${part} 경고:`, r.warnings.length, "건");
            if (r.E) return r.E;
            console.warn(`${part} 검증 탈락 칸:`, r.errors.length, "건");
          } catch (e) {
            console.warn(`${part} 호출 실패:`, e instanceof Error ? e.message : "unknown");
          }
        }
        return null;
      };
      const [d, e1, e2] = await Promise.all([runD(), runE("E1", P.E1, e1Block), runE("E2", P.E2, e2Block)]);
      sa = d;
      E = mergeE(e1, e2);
      // 행동 겹침(7쪽 계획·8쪽 처방·9쪽 실천) 경고 — 운영에서 E2 재호출 기준을 정하려고 건수만 남긴다(README_v4 ①).
      const key = picks[2];
      const overlaps = pkg(locale).validate.overlapWarnings(pkg(locale).validate.actionsOf(E, key ? pkg(locale).pages.todayFromDb(bundleFor(locale).data, { no: key.card.no, reversed: Boolean(key.reversed) }, lean) : null));
      if (overlaps.length) console.info("행동 겹침 경고:", overlaps.map((o) => `${o.a}↔${o.b}`).join(", "));
    }
    await update(sessionId, { report: { sa, E }, report_status: "ready" });
    await writeChatSummary(sessionId);
    await logReportLint(sessionId);
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
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("tarot_sessions 목록 조회 실패:", error.message);
    throw new TarotError(500, "잠시 후 다시 시도해 주세요.");
  }
  return {
    results: (rows ?? [])
      .filter((r) => Array.isArray(r.picks) && r.picks.length >= 3 && r.result_status !== "safety" && r.safety_level !== "urgent")
      .map((r) => ({
        id: r.id as string,
        nickname: r.nickname as string,
        createdAt: r.created_at as string,
        // 유료 리포트를 결제한 결과인지 — 목록에 '전체 열람 가능' 표시(owner 2026-10-22)
        paid: Boolean((r as { paid_at?: string | null }).paid_at),
        locale: localeOf(r as SessionRow),
        cards: cardsView(expandPicks(r.picks as Pick[], localeOf(r as SessionRow)), Boolean((r as { paid_at?: string | null }).paid_at)),
      })),
  };
}

export async function participantCount(): Promise<number | null> {
  const { count, error } = await db().from("tarot_sessions").select("id", { count: "exact", head: true });
  if (error) return null;
  return count ?? null;
}
