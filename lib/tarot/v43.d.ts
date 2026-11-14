/* eslint-disable @typescript-eslint/no-explicit-any */
// v43.js(패키지 v2.3.9 원본) 타입 — 원본 JS는 고치지 않는다.
export const WANTS: string[];
export function normalizeFrameV43(frame: any, cls?: any): any;
export function applyForecastOptions(frame: any, tables: any): any;
export function midAreaKey(frame: any, cls: any, midDb: any, subDb?: any): string;
export function midParagraph(args: { picks: any[]; frame?: any; cls?: any; midDb: any; subDb?: any }): { key: string; merge_key: string; text: string };
export function teaserLine(args: { frame?: any; lean?: any; name: string; data: any }): string;
export function whenMonths(bucket: string, R: any, now?: Date, thisYear?: boolean): string;
export function answerFirst(args: { frame: any; lean: any; picks: any[]; db: any; data?: any; now?: Date }): any | null;
export function buildPagesV43(args: any): any[];
export function variantOf(id: string, experiment?: string, arms?: string[]): string;
export function eventFields(args: any): Record<string, unknown>;
export function blurSetKey(frame: any, cls: any, B: any): string | null;
export const LOVE_TOPICS: string[];
export function parseFrameV43(raw: any): { frame: any | null; errors: string[]; fixed: string[]; salvaged: boolean };
export function applySubDefaults(frame: any, subDb: any): any;
export const AREA_FAMILY: Record<string, string>;
export function sameAreaFamily(a: string | null | undefined, b: string | null | undefined): boolean;
export function resolveTable(frame: any, subDb: any, tables: any, opts?: { safety?: { level?: string | null; violence?: boolean } | null }): any;
export function tableRuleText(rule: any): string;
export function subPromptBlock(candidates: string[], subDb: any): string;
// v2.3.14 결과 틀(두 단계 고르기)
export function frameOf(subId: string, subDb: any): string | null;
export function resolveFrame(frame: any, subDb: any): any;
export function subPromptBlockFrames(candidates: string[], subDb: any, opts?: { compact?: boolean }): string;
export function scoreSub(pred: any, gold: any, subDb: any): { strict: boolean; second: boolean; frame: boolean; frame_or_second: boolean };
