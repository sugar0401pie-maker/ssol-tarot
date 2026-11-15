/* eslint-disable @typescript-eslint/no-explicit-any */
export type MultiOption = { key: string; label: string; area: string | null; pos: number };
export type MultiDetect = { ask: boolean; options: MultiOption[]; families?: string[] };
export type MultiFocus = { how: "picked" | "linked" | "not_asked" | "unknown"; picked: string | null; picked_key?: string; others: string[]; asked: string[] };
export function detectMulti(text: string, db: any, opts?: { urgent?: boolean }): MultiDetect;
export function multiQuestion(detect: MultiDetect, db: any, name?: string): { ask: string; small: string; options: { id: string; label: string }[] } | null;
export function composeFocus(text: string, choiceId: string | null, detect: MultiDetect, db: any): string;
export function applyFocus(frame: any, detect: MultiDetect, choiceId: string | null, db: any): any;
export function focusLine(focus: MultiFocus | null | undefined, db: any): string | null;
export function multiEvent(focus: MultiFocus | null | undefined): string | null;
