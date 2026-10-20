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
export function parseE(raw: unknown, opts?: { lean?: any; frame?: any; violence?: boolean }): { E: any | null; errors: string[] };
export function ruleHitsV4(text: string, opts?: { violence?: boolean }): string[];
export function v10Hits(text: string): string[];
