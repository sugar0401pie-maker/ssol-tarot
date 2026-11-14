import "server-only";
import fs from "node:fs";
import path from "node:path";
import { buildIndex, voteTable, subCandidates } from "@/lib/tarot/retrieve.js";
import { buildFrameUserBlock, FEWSHOT_K, FEWSHOT_HEAD, FEWSHOT_NOTE } from "@/lib/tarot/frameInput.js";
import { buildNormalizer } from "@/lib/tarot/normalize.js";
import { subPromptBlockFrames } from "@/lib/tarot/v43.js";
import normDict from "@/data/norm_dict.json";
import subDb from "@/data/worry_subtopics.json";
import type { Locale } from "@/lib/i18n/locale";
import { worryUserMessage } from "./prompts";
import { embedText, EMBED_MODEL, EMBED_DIM } from "./ai";
import { decodeIndex, hybridTop, unit } from "@/lib/tarot-glue/embedSearch";
import { countEvent } from "./counters";

// v4.1 고민 틀(A2) 사용자 입력: 판별 DB '고민 틀 정답'에서 비슷한 고민 5개를 붙인다. 한국어 = judge-db/data/frame_gold_v2.1.jsonl(1,446건 — 합성 490 + 실제 고민 956건을 owner가 익명화·문체 변경, 2026-11-05).
// 이 파일은 엑셀(judge-db/쏠타로_판별DB_*.xlsx '고민 틀 정답(T6)' 시트)에서 scripts/judge_db_frame_gold.py로 만든다.
// Vercel에 같이 실리도록 next.config.ts outputFileTracingIncludes에 넣어 두었다.
// 색인을 못 만들면(파일 없음 등) 예시 없이 예전처럼 고민만 보내고 두 번째 의견은 건너뛴다(README_v4 대체 경로).
// 영문판은 같은 490건을 영어로 옮긴 judge-db/data/frame_gold_en_v1.2.jsonl(기획 전달본, text = 영어 고민).
const GOLD: Record<Locale, string> = {
  // v2.3.12: 판별 DB v2.7 — 4,695줄(합성 + 실제 고민 익명판 R-·R2-), 줄마다 세부 고민 sub_id(144개)
  ko: path.join(process.cwd(), "judge-db/data/frame_gold_v2.9.jsonl"),
  en: path.join(process.cwd(), "judge-db/data/frame_gold_en_v1.2.jsonl"),
};

type Index = ReturnType<typeof buildIndex>;
const indexes: Partial<Record<Locale, Index | null>> = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const goldRows: Partial<Record<Locale, any[]>> = {};

function getIndex(locale: Locale): Index | null {
  if (indexes[locale] !== undefined) return indexes[locale] ?? null;
  try {
    const rows = fs.readFileSync(GOLD[locale], "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
    goldRows[locale] = rows;
    // 한국어는 반말·줄임말·오타를 정리한 뒤 비교(v2.3.9 normalize.js — 검색에만 쓰고 AI에 보내는 원문은 그대로)
    indexes[locale] = locale === "ko" ? buildIndex(rows, { normalize: koNorm }) : buildIndex(rows);
  } catch (e) {
    console.warn("고민 틀 정답 색인을 만들지 못함 — 예시 없이 A2 호출:", e instanceof Error ? e.message : "unknown");
    indexes[locale] = null;
  }
  return indexes[locale] ?? null;
}

// v2.3.9 의미 검색 색인(한국어만) — scripts/build_embed_index.mjs가 만든 16비트 벡터. 모델·차원·줄 id가 지금 판별 DB와 다르면 쓰지 않는다.
// 끄기: TAROT_EMBED_SEARCH=0. 색인이 없거나 질문 임베딩이 실패·4초 초과면 예전처럼 글자 검색만(결과가 멈추지 않게).
const EMB_BIN = path.join(process.cwd(), "judge-db/data/frame_gold_v2.9.emb.f16.bin");
const EMB_META = path.join(process.cwd(), "judge-db/data/frame_gold_v2.9.emb.meta.json");
let embIndex: { vecs: Float32Array[]; ids: string[] } | null | undefined;
function getEmbIndex(): { vecs: Float32Array[]; ids: string[] } | null {
  if (embIndex !== undefined) return embIndex;
  embIndex = null;
  if (process.env.TAROT_EMBED_SEARCH === "0") return null;
  try {
    const rows = goldRows.ko;
    const meta = JSON.parse(fs.readFileSync(EMB_META, "utf8"));
    if (!rows || meta.model !== EMBED_MODEL || meta.dim !== EMBED_DIM || meta.ids.length !== rows.length || meta.ids.some((id: string, i: number) => id !== rows[i].id)) {
      console.warn("의미 검색 색인이 판별 DB·모델과 맞지 않음 — 글자 검색만");
      return null;
    }
    const vecs = decodeIndex(new Uint8Array(fs.readFileSync(EMB_BIN)), EMBED_DIM);
    embIndex = { vecs, ids: meta.ids };
  } catch (e) {
    console.warn("의미 검색 색인을 읽지 못함 — 글자 검색만:", e instanceof Error ? e.message : "unknown");
  }
  return embIndex;
}

// 글자 검색 이웃(id → 점수)과 임베딩 코사인을 0.7·0.3으로 섞어 이웃 k개(글자 검색 결과와 같은 모양).
async function hybridNeighbors(ix: Index, worryText: string, norm: (t: string) => string, k: number) {
  const charTop = ix.nearest(worryText, 50);
  if (process.env.TAROT_EMBED_SEARCH === "0" || !aiReady()) return ix.nearest(worryText, k);
  const E = getEmbIndex();
  const rows = goldRows.ko;
  // 의미 검색을 쓰려 했는데 못 쓴 경우만 'embed_fallback'으로 센다(숫자만 — 고민 글·사람 정보 없음). 'embed_ok'와 나눠 보면 실패 비율.
  if (!E || !rows) {
    void countEvent("embed_fallback");
    return ix.nearest(worryText, k);
  }
  try {
    const q = unit(await embedText(norm(worryText)));
    const top = hybridTop(q, E.vecs, E.ids, new Map(charTop.map((n) => [n.id, n.score])), k);
    const out = top.map(({ i, score }) => {
      const r = rows[i];
      return { id: r.id, score, text: r.text, table: (r.tables ?? [r.table ?? null])[0] ?? null, tables: r.tables ?? [r.table ?? null], mode: r.mode ?? null, ranked: r.ranked ?? r.options_ranked ?? [],
        sub_id: r.sub_id ?? null, sub2: r.sub2 ?? null, area: r.area ?? null, want: r.want ?? null, love_status: r.love_status ?? null, love_topic: r.love_topic ?? null };
    });
    void countEvent("embed_ok");
    return out;
  } catch (e) {
    void countEvent("embed_fallback");
    console.warn("의미 검색 실패 — 글자 검색만:", e instanceof Error ? e.message : "unknown");
    return ix.nearest(worryText, k);
  }
}
const aiReady = () => Boolean(process.env.OPENAI_API_KEY);

/** 색인 미리 읽기(약 0.5초) — 세션을 만들 때 뒤에서 불러, 고민을 제출할 때는 이미 읽혀 있게 한다(같은 서버 인스턴스일 때). 실패해도 조용히. */
export function warmFrameIndexes(locale: Locale = "ko"): void {
  try {
    if (getIndex(locale) && locale === "ko") getEmbIndex();
  } catch {
    /* 실제 요청 때 다시 시도 */
  }
}
const koNorm = buildNormalizer(normDict);

// 패키지 buildFrameUserBlock의 한국어 안내 줄을 영어로(PROMPTS_EN_NOTES — "개발 확인 필요"의 안내 한 줄).
const EN_FEWSHOT_HEAD = "[Answer examples for similar worries — use them only for picking the table and ordering the options. Take the words for options and questions from this worry.]";
const EN_FEWSHOT_NOTE = "The examples below show how to pick the table and order the options. Don't copy their option wording; use the words from this worry.";
const EN_THIS = "[This worry — sort out its frame in the output format]";
function toEnglishBlock(user: string): string {
  return user.replace(FEWSHOT_HEAD, EN_FEWSHOT_HEAD).replace(FEWSHOT_NOTE, EN_FEWSHOT_NOTE).replace("[이번 고민 — 이 글의 고민 틀을 출력 형식대로 정리합니다]", EN_THIS);
}

export type FrameVote = { table: string | null; share: number; top_score: number; neighbors: { id: string; score: number; table: string | null }[] };

/** A2 사용자 메시지 + 투표(두 번째 의견용). 이웃의 고민 글은 판별 DB 예시 문장이고, 투표 기록에는 id·점수·표만 남긴다. */
// v2.3.9: 이웃 20개 → 앞 5개는 few-shot 예시·두 번째 의견 투표, 20개 전체로 세부 고민 후보 8개(subCandidates)를 뽑아
// A2 v4.10의 [세부 고민 후보] 블록(subPromptBlock)을 사용자 입력 맨 앞에 붙인다(영문판은 세부 고민 DB가 없어 예전처럼 5개만).
// v2.3.14(A2 v4.12): 후보 세부를 결과 틀별로 묶은 [결과 틀 후보] 블록(subPromptBlockFrames) — 틀을 먼저 고르고 그 안에서 세부.
export const SUB_NEIGHBORS = 20;
export const SUB_CANDIDATES = 8;

export async function frameCall(worryText: string, locale: Locale = "ko"): Promise<{ user: string; vote: FrameVote | null }> {
  const ix = getIndex(locale);
  if (!ix) return { user: worryUserMessage(worryText), vote: null };
  try {
    const all = locale === "ko" ? await hybridNeighbors(ix, worryText, koNorm, SUB_NEIGHBORS) : ix.nearest(worryText, FEWSHOT_K);
    const neighbors = all.slice(0, FEWSHOT_K);
    const v = voteTable(neighbors);
    // table이 undefined면 이웃이 없다는 뜻(두 번째 의견 건너뜀) — null(= '방향 없음' 표)과 구분해서 기록하지 않는다.
    const vote: FrameVote | null = v && v.table !== undefined
      ? { table: v.table ?? null, share: v.share, top_score: v.top_score, neighbors: neighbors.map((n) => ({ id: n.id, score: n.score, table: n.table ?? null })) }
      : null;
    const base = buildFrameUserBlock({ worryText, examples: neighbors });
    if (locale === "en") return { user: toEnglishBlock(base), vote };
    const subBlock = subPromptBlockFrames(subCandidates(all, SUB_CANDIDATES), subDb);
    return { user: `${subBlock}\n\n${base}`, vote };
  } catch (e) {
    console.warn("비슷한 예시 찾기 실패 — 예시 없이 A2 호출:", e instanceof Error ? e.message : "unknown");
    return { user: worryUserMessage(worryText), vote: null };
  }
}
