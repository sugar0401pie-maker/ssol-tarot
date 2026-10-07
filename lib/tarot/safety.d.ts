/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Safety } from "./types";
export function screenText(text: string | null | undefined): { level: "none" | "watch" | "urgent"; violence: boolean; matched: string[] };
export function mergeSafety(local: Safety, ai: { crisis_level?: string; violence?: boolean } | null | undefined): Safety & { matched: string[] };
export function nextScreenFor(safety: Safety): string;
export function filterPractices(card: any, safety: Safety): any[];
