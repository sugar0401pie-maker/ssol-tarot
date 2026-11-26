/* eslint-disable @typescript-eslint/no-explicit-any */
export type ChallengeDay = { key: "day1" | "day2" | "day3" | "week" | "month"; label: string; title?: string; text: string; proof: string; story: string; tie?: string; how?: string; how_label?: string | null; home?: string; practice_id?: string | null };
export type Challenge = { domain: string; kind: string; family: string; family_name: string; group: string; master_family: string | null; picked_from: string; branch: string | null; pair: string; card3_name: string; how: string; later_how: string; days: ChallengeDay[] };
export function domainOf(subId: string | null, cdb: any): string;
export function familyOf(cardKey: string | null, cdb: any): string | null;
export function candidatesFor(subId: string | null, branchCode: string | null, cdb: any): { list: string[]; from: string; branch: string | null };
export function pickFamily(subId: string | null, card3: string | null, cdb: any, branchCode?: string | null): string;
export function buildChallenge(a: { subId?: string | null; branchKind?: string | null; branchCode?: string | null; card2?: string | null; card3?: string | null }, cdb: any): Challenge;
export function challengePage9(ch: Challenge, cdb: any): { kind: "challenge"; title: string; access: string; challenge: any; body: string };
export function sowellaPage10(a: { name?: string; domain?: string; paid?: boolean }, cdb: any): any;
export const HANDOFF_SCHEMA: string;
export function resultForHandoff(pages: any[]): any[];
export function challengeHandoff(ch: Challenge, a: any): any;
export function sowellaLink(resultId: string, to?: string): string;
