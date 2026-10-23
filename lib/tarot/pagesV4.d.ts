/* eslint-disable @typescript-eslint/no-explicit-any */
export const V4_COPY: any;
export const SUBHEADS: string[];
export const PLAN_HEAD_RE: RegExp;
export function planHead(lean: any, heads?: any): string;
export function teaserFallback(a: { strength: string; name: string; frame: any }): any;
export function todayFromDb(data: any, keyCard: { no: number; reversed: boolean } | null, lean?: any): { title: string; how: string; time: string; why: string; from_db: true } | null;
export function buildPagesV4(a: { base: any[]; frame?: any; lean?: any; C?: any; E?: any; name: string; paid?: boolean; data?: any; safety?: any }): any[];
