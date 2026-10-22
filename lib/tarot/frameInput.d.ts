/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Index, Neighbor } from "./retrieve";
import type { Lean, SecondOpinion } from "./decision";
export const FEWSHOT_K: number;
export const FEWSHOT_HEAD: string;
export const FEWSHOT_NOTE: string;
export function exampleAnswer(ex: any): { table: string | null; mode: string | null; options_ranked: string[] };
export function buildFrameUserBlock(a: { worryText: string; examples?: any[] }): string;
export function prepareFrameCall(a: { worryText: string; k?: number; excludeId?: string | null; index?: Index | null }): {
  user: string; neighbors: Neighbor[]; vote: { table: string | null | undefined; share: number; votes: Record<string, number>; top_score: number };
};
export function afterFrame(a: { frame: any; lean?: Lean | null; vote: { table: string | null | undefined; share: number; top_score: number } | null; worryId?: string | null; tables?: any; minShare?: number }): {
  lean: Lean | null; review_log: Record<string, unknown> | null; second_opinion: SecondOpinion | null;
};
