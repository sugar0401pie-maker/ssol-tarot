/* eslint-disable @typescript-eslint/no-explicit-any */
export const WORRY_TYPES: string[];
export const TABLE_TYPES: string[];
export function parseFrame(raw: unknown): { frame: any | null; errors: string[] };
export function parseC(raw: unknown, opts?: { decision?: boolean; strength?: string | null; frame?: any; lean?: any; option?: string | null; violence?: boolean }): {
  links: any | null;
  teaser_headline: string | null;
  teaser_lead: string | null;
  reasons: string[] | null;
  errors: string[];
};
export function parseE(raw: unknown, opts?: { lean?: any; frame?: any; violence?: boolean; part?: "all" | "E1" | "E2"; worryText?: string }): { E: any | null; errors: string[]; warnings: string[] };
export function mergeE(E1: any | null, E2: any | null): any | null;
export function fixInventedDays(text: string, opts?: { worryText?: string; frame?: any }): { text: string; hits: string[] };
export function overlapWarnings(acts: { where: string; text: string }[], opts?: { limit?: number }): { a: string; b: string; ratio: number }[];
export function actionsOf(E: any, today?: any): { where: string; text: string }[];
export function ruleHitsV4(text: string, opts?: { violence?: boolean }): string[];
export function v10Hits(text: string): string[];
