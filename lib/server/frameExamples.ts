import "server-only";
import fs from "node:fs";
import path from "node:path";
import { buildIndex } from "@/lib/tarot/retrieve.js";
import { prepareFrameCall } from "@/lib/tarot/frameInput.js";
import { worryUserMessage } from "./prompts";

// v4.1 고민 틀(A2) 사용자 입력: 판별 DB '고민 틀 정답'(judge-db/data/frame_gold_v1.jsonl, 490건)에서 비슷한 고민 5개를 붙인다.
// 이 파일은 엑셀(judge-db/쏠타로_판별DB_*.xlsx '고민 틀 정답(T6)' 시트)에서 scripts/judge_db_frame_gold.py로 만든다.
// Vercel에 같이 실리도록 next.config.ts outputFileTracingIncludes에 넣어 두었다.
// 색인을 못 만들면(파일 없음 등) 예시 없이 예전처럼 고민만 보내고 두 번째 의견은 건너뛴다(README_v4 대체 경로).
const GOLD = path.join(process.cwd(), "judge-db/data/frame_gold_v1.jsonl");

type Index = ReturnType<typeof buildIndex>;
let index: Index | null | undefined;

function getIndex(): Index | null {
  if (index !== undefined) return index;
  try {
    const rows = fs.readFileSync(GOLD, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
    index = buildIndex(rows);
  } catch (e) {
    console.warn("고민 틀 정답 색인을 만들지 못함 — 예시 없이 A2 호출:", e instanceof Error ? e.message : "unknown");
    index = null;
  }
  return index;
}

export type FrameVote = { table: string | null; share: number; top_score: number; neighbors: { id: string; score: number; table: string | null }[] };

/** A2 사용자 메시지 + 투표(두 번째 의견용). 이웃의 고민 글은 판별 DB 예시 문장이고, 투표 기록에는 id·점수·표만 남긴다. */
export function frameCall(worryText: string): { user: string; vote: FrameVote | null } {
  const ix = getIndex();
  if (!ix) return { user: worryUserMessage(worryText), vote: null };
  try {
    const prep = prepareFrameCall({ worryText, index: ix });
    const v = prep.vote;
    // table이 undefined면 이웃이 없다는 뜻(두 번째 의견 건너뜀) — null(= '방향 없음' 표)과 구분해서 기록하지 않는다.
    const vote: FrameVote | null = v && v.table !== undefined
      ? { table: v.table ?? null, share: v.share, top_score: v.top_score, neighbors: prep.neighbors.map((n) => ({ id: n.id, score: n.score, table: n.table ?? null })) }
      : null;
    return { user: prep.user, vote };
  } catch (e) {
    console.warn("비슷한 예시 찾기 실패 — 예시 없이 A2 호출:", e instanceof Error ? e.message : "unknown");
    return { user: worryUserMessage(worryText), vote: null };
  }
}
