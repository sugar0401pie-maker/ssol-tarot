/* eslint-disable @typescript-eslint/no-explicit-any */
export const SCREENS: string[];
export type FlowStateBase = {
  screen: string;
  nickname: string | null;
  experience: string | null;
  worryText: string | null;
  worrySkipped: boolean;
  picked: number;
  error?: string | null;
};
export type FlowAction =
  | { type: "START" | "FIRST_TIME_OK" | "SKIP_WORRY" | "AI_URGENT" | "RESHUFFLE" | "PICK_NOW" | "PICK" | "RESULT_READY" }
  | { type: "SUBMIT_NICKNAME"; nickname: string }
  | { type: "CHOOSE_EXPERIENCE"; value: string }
  | { type: "SUBMIT_WORRY"; text: string; localUrgent: boolean }
  | { type: "SEE_RESULT"; ready: boolean };
export function initialState(): FlowStateBase;
export function next(state: FlowStateBase, action: FlowAction, data: any): FlowStateBase;
