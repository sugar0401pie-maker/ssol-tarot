import "server-only";
import fs from "node:fs";
import path from "node:path";
import { buildIndex } from "@/lib/tarot/retrieve.js";
import { prepareFrameCall, FEWSHOT_HEAD, FEWSHOT_NOTE } from "@/lib/tarot/frameInput.js";
import type { Locale } from "@/lib/i18n/locale";
import { worryUserMessage } from "./prompts";

// v4.1 고민 틀(A2) 사용자 입력: 판별 DB '고민 틀 정답'에서 비슷한 고민 5개를 붙인다. 한국어 = judge-db/data/frame_gold_v2.1.jsonl(1,446건 — 합성 490 + 실제 고민 956건을 owner가 익명화·문체 변경, 2026-11-05).
// 이 파일은 엑셀(judge-db/쏠타로_판별DB_*.xlsx '고민 틀 정답(T6)' 시트)에서 scripts/judge_db_frame_gold.py로 만든다.
// Vercel에 같이 실리도록 next.config.ts outputFileTracingIncludes에 넣어 두었다.
// 색인을 못 만들면(파일 없음 등) 예시 없이 예전처럼 고민만 보내고 두 번째 의견은 건너뛴다(README_v4 대체 경로).
// 영문판은 같은 490건을 영어로 옮긴 judge-db/data/frame_gold_en_v1.2.jsonl(기획 전달본, text = 영어 고민).
const GOLD: Record<Locale, string> = {
  ko: path.join(process.cwd(), "judge-db/data/frame_gold_v2.1.jsonl"), // v2.3.4 + owner 익명화판(2026-11-05): 합성 490 + 실제 956(익명화·문체 변경)
  en: path.join(process.cwd(), "judge-db/data/frame_gold_en_v1.2.jsonl"),
};

type Index = ReturnType<typeof buildIndex>;
const indexes: Partial<Record<Locale, Index | null>> = {};

function getIndex(locale: Locale): Index | null {
  if (indexes[locale] !== undefined) return indexes[locale] ?? null;
  try {
    const rows = fs.readFileSync(GOLD[locale], "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
    indexes[locale] = buildIndex(rows);
  } catch (e) {
    console.warn("고민 틀 정답 색인을 만들지 못함 — 예시 없이 A2 호출:", e instanceof Error ? e.message : "unknown");
    indexes[locale] = null;
  }
  return indexes[locale] ?? null;
}

// 패키지 buildFrameUserBlock의 한국어 안내 줄을 영어로(PROMPTS_EN_NOTES — "개발 확인 필요"의 안내 한 줄).
const EN_FEWSHOT_HEAD = "[Answer examples for similar worries — use them only for picking the table and ordering the options. Take the words for options and questions from this worry.]";
const EN_FEWSHOT_NOTE = "The examples below show how to pick the table and order the options. Don't copy their option wording; use the words from this worry.";
const EN_THIS = "[This worry — sort out its frame in the output format]";
function toEnglishBlock(user: string): string {
  return user.replace(FEWSHOT_HEAD, EN_FEWSHOT_HEAD).replace(FEWSHOT_NOTE, EN_FEWSHOT_NOTE).replace("[이번 고민 — 이 글의 고민 틀을 출력 형식대로 정리합니다]", EN_THIS);
}

export type FrameVote = { table: string | null; share: number; top_score: number; neighbors: { id: string; score: number; table: string | null }[] };

/** A2 사용자 메시지 + 투표(두 번째 의견용). 이웃의 고민 글은 판별 DB 예시 문장이고, 투표 기록에는 id·점수·표만 남긴다. */
export function frameCall(worryText: string, locale: Locale = "ko"): { user: string; vote: FrameVote | null } {
  const ix = getIndex(locale);
  if (!ix) return { user: worryUserMessage(worryText), vote: null };
  try {
    const prep = prepareFrameCall({ worryText, index: ix });
    const v = prep.vote;
    // table이 undefined면 이웃이 없다는 뜻(두 번째 의견 건너뜀) — null(= '방향 없음' 표)과 구분해서 기록하지 않는다.
    const vote: FrameVote | null = v && v.table !== undefined
      ? { table: v.table ?? null, share: v.share, top_score: v.top_score, neighbors: prep.neighbors.map((n) => ({ id: n.id, score: n.score, table: n.table ?? null })) }
      : null;
    return { user: locale === "en" ? toEnglishBlock(prep.user) : prep.user, vote };
  } catch (e) {
    console.warn("비슷한 예시 찾기 실패 — 예시 없이 A2 호출:", e instanceof Error ? e.message : "unknown");
    return { user: worryUserMessage(worryText), vote: null };
  }
}
