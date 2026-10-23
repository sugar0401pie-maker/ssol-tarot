/* eslint-disable @typescript-eslint/no-explicit-any */
export type Lean = {
  table: string;
  side: "move" | "stay";
  strength: "strong" | "clear" | "slight";
  score: number;
  with_condition: boolean;
  option: string;
  other: string;
  // v4.1: mode axis(+ 쪽/− 쪽) 또는 rank(추천 순위), pick 0|1, conclusion(= option), 3순위 이하는 결론이 안 됨(not_concluded)
  mode?: "axis" | "rank";
  pick?: 0 | 1;
  conclusion?: string;
  not_concluded?: string[];
  strength_before?: string;
  second_opinion?: { sim_table: string | null };
  // v4.2: key(카드 번호_up/rev)·option(그 카드가 가리키는 선택지)·reason(이유 문장 DB 한 줄, 없으면 null)
  cards: { position: string; key?: string; score: number; weight: number; meaning: string; option?: string; reason?: string | null }[];
  small_note?: string;
};
export const SIDE_WORD: Record<string, string>;
export const STRENGTH_WORD: Record<string, string>;
export function cleanOption(o: unknown): string;
export function pickTable(a: { frame?: any; cls?: any; tables: any; safety?: any }): string | null;
export function isDecisionFrame(frame: any): boolean;
export type SecondOpinion = { strength: string | null; lowered: boolean; disagree: boolean; review_log: Record<string, unknown> | null };
export function secondOpinion(a: { frameTable: string | null; simTable: string | null | undefined; strength?: string | null; worryId?: string | null; simShare?: number | null; simScore?: number | null; score?: number | null; minShare?: number }): SecondOpinion;
export function applySecondOpinion(L: Lean | null, so: SecondOpinion | null): Lean | null;
export function minShareOf(tables: any): number;
export function lean(a: { picks: any[]; type: string; tables: any; money?: boolean; name?: string; frame?: any }): Lean | null;
export function reasonLine(clause: string, option: string): string;
export function reasonFallback(meaning: string, side: string): string;
export function cardSide(score: number): "move" | "stay";
