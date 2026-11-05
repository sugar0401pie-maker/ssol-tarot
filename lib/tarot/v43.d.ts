/* eslint-disable @typescript-eslint/no-explicit-any */
// v43.js(패키지 v2.3.4 원본) 타입 — 원본 JS는 고치지 않는다.
export const WANTS: string[];
export function normalizeFrameV43(frame: any, cls?: any): any;
export function applyForecastOptions(frame: any, tables: any): any;
export function midAreaKey(frame: any, cls: any, midDb: any): string;
export function midParagraph(args: { picks: any[]; frame?: any; cls?: any; midDb: any }): { key: string; merge_key: string; text: string };
export function teaserLine(args: { frame?: any; lean?: any; name: string; data: any }): string;
export function whenMonths(bucket: string, R: any, now?: Date, thisYear?: boolean): string;
export function answerFirst(args: { frame: any; lean: any; picks: any[]; db: any; data?: any; now?: Date }): any | null;
export function buildPagesV43(args: any): any[];
export function variantOf(id: string, experiment?: string, arms?: string[]): string;
export function eventFields(args: any): Record<string, unknown>;
