/* eslint-disable @typescript-eslint/no-explicit-any */
export type Lean = {
  table: string;
  side: "move" | "stay";
  strength: "strong" | "clear" | "slight";
  score: number;
  with_condition: boolean;
  option: string;
  other: string;
  cards: { position: string; score: number; weight: number; meaning: string }[];
  small_note?: string;
};
export const SIDE_WORD: Record<string, string>;
export const STRENGTH_WORD: Record<string, string>;
export function cleanOption(o: unknown): string;
export function pickTable(a: { frame?: any; cls?: any; tables: any }): string | null;
export function lean(a: { picks: any[]; type: string; tables: any; money?: boolean; name?: string; frame?: any }): Lean | null;
export function reasonFallback(meaning: string, side: string): string;
export function cardSide(score: number): "move" | "stay";
