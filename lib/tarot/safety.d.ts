/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Safety } from "./types";
export type SafetyKeywords = { urgent?: string[]; urgent_raw?: string[]; deprecated_watch?: string[]; violence?: string[]; fear?: string[]; exclude?: string[] };
export function screenText(text: string | null | undefined, kw?: SafetyKeywords | null): { level: "none" | "urgent"; violence: boolean; fear: boolean; matched: string[] };
export function mergeSafety(local: Safety, ai: { crisis_level?: string; violence?: boolean; fear?: boolean } | null | undefined): Safety & { fear: boolean; matched: string[] };
export function nextScreenFor(safety: Safety): string;
export function filterPractices(card: any, safety: Safety): any[];
