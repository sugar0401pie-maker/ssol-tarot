/* eslint-disable @typescript-eslint/no-explicit-any */
export type Practice = { id: string; title: string; level: string; min: number; max: number; power: number; form: string; stay: number; partner: boolean; employed: boolean; others: boolean };
export function worryType(frame: any, sub: any, db: any): "OUTCOME" | "CHOICE" | "SITUATION";
export function cardPattern(scores: number[], pickSign: number): "ALL" | "TWO_KEY" | "TWO_NOKEY" | "KEY_ALONE" | "MIXED";
export function page5Head(a: { type: string; pickSign?: number; pattern: string; pick?: string; gap?: number; seed?: number }, db: any): string;
export function aliasFor(a: { type: string; table: string; side: number; userOption?: any }, db: any): { full: string; alias: string; source: string } | null;
export function optionNameFor(page: number, nth: number, names: { full: string; alias: string }, db: any): string;
export function cardLine(a: { cardKey: string; score: number; pickSign: number; stance?: string; tableReason?: string }, db: any): string;
export function areaVariant(subId: string | null | undefined, opts: { confidence?: string; safety?: string } | undefined, db: any): string;
export function applyScene(text: string, cardKey: string, pos: string, variant: string, db: any): string;
export function page3Tail(type: string, pattern: string, db: any): string;
export function page7Cond(table: string, pickSign: number, db: any): { win: string; flip: string } | null;
export function fallbackQuote(worryText: string, type: string, db: any, seed?: number): string;
export function planLine(frameId: string, pickSign: number, db: any): { first: string; look?: string } | null;
export function cueFor(a: { subId?: string | null; frameId?: string | null; sceneCue?: string | null }, db: any): string;
export function pickPractices(a: { frameId: string; variant?: string; emotion?: string | null; safety?: string; pickSign?: number; exclude?: string[] }, db: any): { today: Practice | null; three: Practice | null };
export function practiceLine(p: Practice | null, cue: string): string;
export function splitQuestions(frameId: string, db: any): any[];
