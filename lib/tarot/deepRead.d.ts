/* eslint-disable @typescript-eslint/no-explicit-any */
export type DeepRead = {
  level: number; signals: string[]; page1_tail: string; page2_thought: string; thought_sub?: string | null;
  page3_line: string; page3_signal: string; source: "second" | "form" | "fact" | "low_confidence_thought" | null; word?: string | null;
  page1_source?: "card" | "fact" | "free" | null; page2_free?: string; facts_used?: string[]; free_errors?: { p1: string[] | null; p2: string[] | null } | null;
};
export function intensityOf(text: string, opts: { safety?: string } | undefined, db: any): { level: number; signals: string[]; word: string | null };
export function signalLine(it: { level: number; signals: string[]; word: string | null } | null, db: any): string;
export function tailFor(cardKey: string, level: number, db: any): string;
export function formOf(text: string, db: any): string | null;
export function formLine(text: string, variant: string, db: any): string;
export function thoughtFor(variant: string, cardKey: string | undefined, db: any, subId?: string | null): { sub: string; first: string; second: string; text: string } | null;
export function secondLine(variant: string, variant2: string, db: any): string;
export function deepRead(a: { text: string; variant: string; subId?: string | null; variant2?: string | null; cards?: { now?: string; hold?: string }; safety?: string; confidence?: string; branches?: string[]; facts?: any; freeLines?: { p1?: string; p2?: string } | null; sdb?: any; bc?: any }, db: any): DeepRead;
export function deepEvent(r: DeepRead): { deep_level: number; deep_signal: string | null; deep_thought_sub: string | null; deep_source: string | null; deep_branches: string[]; deep_branch_from: string[]; deep_facts: string[]; deep_p1_source: string | null; deep_p2_free: boolean };
