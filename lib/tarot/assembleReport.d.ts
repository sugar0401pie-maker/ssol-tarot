/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TarotData, ExpandedPick, Safety } from "./types";
// v4.0 패키지 assembleReport.js 중 서버가 부르는 함수만 타입을 적는다(나머지는 원본 그대로).
export function buildPages(a: {
  name: string; cls: any; picks: ExpandedPick[]; data: TarotData; links?: any; safety?: Safety;
  story?: string | null; apply?: string | null; key?: string | null; storyHead?: string | null; applyHead?: string | null;
  paid?: boolean; worryText?: string;
}): any[];
export function buildSafetyNotice(a: { data: TarotData; safety: Safety }): string | null;
export function buildLinkUserBlock(a: { name: string; worryText: string | null; cls: any; picks: ExpandedPick[]; data: TarotData }): string | null;
export function buildStoryUserBlock(a: any): string | null;
export function parseStoryApply(raw: unknown, opts?: { violence?: boolean }): any;
export function readingSentence(a: any): string;
export function comboScore(a: { picks: ExpandedPick[]; data: TarotData; cls?: any; worryText?: string }): { score: number; pace: "near" | "step" | "slow"; parts: any[] };
