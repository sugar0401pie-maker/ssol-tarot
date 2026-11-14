/* eslint-disable @typescript-eslint/no-explicit-any */
export const LINT: any;
export function lintReport(a: { pages?: any[]; worryText?: string; options?: string[]; skipped?: boolean; maxOptionRepeat?: number }): { block: { code: string; [k: string]: unknown }[]; warn: { code: string; [k: string]: unknown }[]; ok: boolean };
