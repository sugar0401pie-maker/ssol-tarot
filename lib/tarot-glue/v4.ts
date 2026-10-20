// v4.0 결과 파이프라인의 순수 부분(네트워크 없음 → 단위 테스트 가능). 서버(lib/server/session.ts)가 이 함수들만 부른다.
//   ① 방향 계산(decision.js)  ② C 호출 입력 만들기  ③ 11쪽 조립(buildPages → buildPagesV4)  ④ 결제 전 응답 거르기
// 원본 패키지 코드(lib/tarot/*.js)는 바꾸지 않는다.
import data from "../../data/tarot_data.json" with { type: "json" };
import tables from "../../data/decision_tables.json" with { type: "json" };
import { pickTable, lean as leanOf, type Lean } from "../tarot/decision.js";
import { buildPages, buildLinkUserBlock } from "../tarot/assembleReport.js";
import { buildPagesV4, SUBHEADS } from "../tarot/pagesV4.js";
import type { ExpandedPick, Safety } from "../tarot/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Frame = any;
type Cls = any;

// 결정형 고민이면 카드 점수로 방향을 정한다(AI는 결론을 바꾸지 못함 — README_v4 R1·R2).
// frame이 없거나(미작성·A2 탈락) 점수표가 없으면 비결정형(null).
export function decide({ frame, cls, picks, name }: { frame: Frame | null; cls: Cls | null; picks: ExpandedPick[]; name: string }): {
  decision: boolean;
  lean: Lean | null;
} {
  const table = frame ? pickTable({ frame, cls, tables }) : null;
  const decision = Boolean(frame && frame.worry_type === "decision" && table);
  const lean = decision && table ? leanOf({ picks, type: table, tables, name, frame }) : null;
  return { decision: Boolean(lean), lean };
}

// C 사용자 메시지. 패키지에는 v4용 입력 조립 코드가 없어서, 프롬프트의 [입력] 목록(worry_text·worry_frame·
// direction_lean·cards)에 맞춰 v3 입력(buildLinkUserBlock) 뒤에 고민 틀과 방향을 덧붙인다. 고민 미작성이면 null.
export function buildCUserBlock({ name, worryText, cls, picks, frame, lean }: {
  name: string; worryText: string | null; cls: Cls | null; picks: ExpandedPick[]; frame: Frame | null; lean: Lean | null;
}): string | null {
  const base = buildLinkUserBlock({ name, worryText, cls, picks, data });
  if (!base) return null;
  const dl = lean
    ? {
        decision: true, side: lean.side, option: lean.option, other: lean.other, strength: lean.strength,
        with_condition: lean.with_condition, cards: lean.cards.map((c) => ({ position: c.position, score: c.score, weight: c.weight, meaning: c.meaning })),
      }
    : null;
  return base.replace("</user_data>", `worry_frame=${JSON.stringify(frame ?? null)}\ndirection_lean=${JSON.stringify(dl)}\n</user_data>`);
}

// 11쪽 조립(결제 전). C는 parseC 결과(통과한 칸만), D·E는 결제 뒤에만 생기므로 지금은 없음.
export function buildUnpaidPages({ name, cls, picks, safety, worryText, frame, lean, C }: {
  name: string; cls: Cls | null; picks: ExpandedPick[]; safety: Safety; worryText: string; frame: Frame | null; lean: Lean | null; C: any | null;
}): any[] {
  const base = buildPages({ name, cls, picks, data, links: C?.links ?? null, safety, worryText: worryText || "", paid: false });
  return buildPagesV4({ base, frame, lean, C, E: null, name, paid: false, data });
}

// 결제 전 응답에 실을 칸만 고른다(허용 목록). 특히 5쪽 locked(결론 "세 장을 합치면 ‘○○’ 쪽이…"부터)와
// combo·map(점수·읽기 지도 — 결론을 짐작할 수 있음)은 빼고, 6~11쪽은 본문 없이 제목·예고·고정 예시(blur)만.
// 블러는 CSS로 가리는 게 아니라 데이터가 없는 상태여야 한다(스펙 11장 5번).
const PAGE_KEYS = ["page", "title", "access", "question", "saysTitle", "says", "card", "body", "free", "teaser", "blur", "next", "back"] as const;
export function sanitizeUnpaid(pages: any[]): any[] {
  return pages.map((p) => {
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

// 결과 화면 줄 해석기(lib/client/pageBlocks.ts)에 넘길 설정. 소제목 목록은 패키지(pagesV4.js의 SUBHEADS)와
// 데이터 문구(copy.result.v4·flow_titles)를 합친다 — 데이터 쪽 문구가 바뀌어도 소제목으로 그려지게.
export function resultParseOpts() {
  const r = data.copy.result as any;
  const v4 = r.v4 ?? {};
  const fromData = [v4.summary_title, v4.direction_title, v4.decide_title, v4.change_signs, v4.plan_head?.stay, v4.plan_head?.move, v4.plan_head?.none,
    ...Object.values(r.flow_titles ?? {}), r.tendency_title].filter((x): x is string => typeof x === "string");
  const sec = [r.reflect_title].filter((x): x is string => typeof x === "string");
  return {
    subheads: [...new Set([...SUBHEADS, ...fromData])].filter((x) => !sec.includes(x)),
    secHeads: sec,
    planHeadSuffix: "이번 주에 이것부터",
    positions: data.positions.map((p) => p.name),
    forceLabels: r.force_labels as { up: string[]; flat: string[]; down: string[] },
  };
}
