/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TarotData } from "./types";
export function shuffleDeck(data: TarotData, rng?: (n: number) => number): string[];
export function drawOrientation(data: TarotData, rng?: (n: number) => number): Record<string, boolean>;
export function createShuffle(data: TarotData, opts?: { rng?: (n: number) => number; idFn?: () => string }): { shuffleId: string; order: string[]; reversed: Record<string, boolean>; createdAt: string };
export function pickSlot(shuffle: { order: string[]; reversed?: Record<string, boolean> }, pickedSlots: number[], slot: unknown, data: TarotData): { slot: number; card: any; reversed: boolean; position: string; positionName: string; isLast: boolean };
export function picksFromSlots(shuffle: { order: string[]; reversed?: Record<string, boolean> }, slots: number[], data: TarotData): { card: any; reversed: boolean; position: string; positionName: string }[];
export function loadingText(data: TarotData, nickname: string, seconds: number): string;
