/* eslint-disable @typescript-eslint/no-explicit-any */
export type FollowupView = { key: string; ask: string; options: { id: string; label: string }[] };
export function needsFollowup(text: string, db: any, opts?: { urgent?: boolean }): boolean;
export function firstQuestion(db: any): FollowupView | null;
export function nextQuestion(db: any, answers?: { q: string; id: string }[]): FollowupView | null;
export function composeWorry(text: string, answers: { q: string; id: string }[], db: any): string;
export function applyFollowup(frame: any, answers: { q: string; id: string }[], db: any): any;
