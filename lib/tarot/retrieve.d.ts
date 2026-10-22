/* eslint-disable @typescript-eslint/no-explicit-any */
export type Neighbor = { id: string; score: number; text: string; table: string | null; tables: string[]; mode: string; ranked: string[] };
export type Index = { size: number; nearest(text: string, k?: number, o?: { excludeId?: string | null }): Neighbor[] };
export function normText(t: string): string;
export function grams(text: string, nmin?: number, nmax?: number): Map<string, number>;
export function buildIndex(rows: any[]): Index;
export function nearest(text: string, k?: number, o?: { excludeId?: string | null; index?: Index | null }): Neighbor[];
export function voteTable(neighbors: Neighbor[]): { table: string | null | undefined; share: number; votes: Record<string, number>; top_score: number };
export function setRetriever(fn: ((text: string, o: { k: number; excludeId: string | null }) => Neighbor[]) | null): void;
export function findSimilar(text: string, o?: { k?: number; excludeId?: string | null; index?: Index | null }): Neighbor[];
