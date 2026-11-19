// 매일 관리자 메일(owner 2026-11-19 "admin 결과도 자리잡기 전까지는 매일 메일로").
// 숫자만 담는다(사람·고민 정보 없음): 그 날 단계 표 + 최근 7일 + 그 날 광고 소재별 상위.
import { FUNNEL, type FunnelRow } from "./funnel.ts";

export type UtmDay = { source: string; campaign: string; content: string; metric: string; value: number };

/** 고민 누적 엑셀을 붙이는 요일(한국 시간, 0=일). 월·목 = 3~4일마다. */
export const WORRY_EXPORT_WEEKDAYS = [1, 4];

/** sendDay(메일 보내는 날, 한국 시간)가 고민 엑셀을 붙이는 날인지. */
export function isWorryExportDay(sendDay: string, weekdays: number[] = WORRY_EXPORT_WEEKDAYS): boolean {
  return weekdays.includes(new Date(`${sendDay}T00:00:00Z`).getUTCDay());
}

const n = (x: number) => x.toLocaleString("en-US");
const pct = (r: number | null) => (r === null ? "-" : `${r}%`);

/** 그 날의 광고 소재별 줄(방문 많은 순 상위 limit개). */
export function utmTop(rows: UtmDay[], limit = 10): { key: string; visit: number; started: number; result: number; paid: number }[] {
  const m = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const key = [r.source, r.campaign, r.content].filter(Boolean).join(" / ") || "(없음)";
    const v = m.get(key) ?? {};
    v[r.metric] = (v[r.metric] ?? 0) + (Number(r.value) || 0);
    m.set(key, v);
  }
  return [...m.entries()]
    .map(([key, v]) => ({ key, visit: v.visit ?? 0, started: v.started ?? 0, result: v.result ?? 0, paid: v.paid ?? 0 }))
    .sort((a, b) => b.visit - a.visit || b.paid - a.paid || a.key.localeCompare(b.key))
    .slice(0, limit);
}

export function dailyReportText(input: {
  day: string;
  funnel: FunnelRow[];
  recent: { day: string; values: Record<string, number> }[];
  utm: ReturnType<typeof utmTop>;
  worryNote?: string | null;
}): { subject: string; text: string } {
  const paid = input.funnel.find((f) => f.metric === "paid")?.day ?? 0;
  const started = input.funnel.find((f) => f.metric === "started")?.day ?? 0;
  const lines: string[] = [];
  lines.push(`쏠 타로 하우스 ${input.day} (한국 시간) 결과`, "");
  lines.push("■ 단계 표 (그 날 / 누적, 괄호 = 바로 앞 단계 대비)");
  for (const f of input.funnel) lines.push(`- ${f.label}: ${n(f.day)} (${pct(f.dayRate)}) / 누적 ${n(f.total)} (${pct(f.totalRate)})`);
  lines.push("", "■ 최근 7일 (방문 · 시작 · 결과 · 결제 · 안전 안내)");
  for (const r of input.recent) {
    const v = r.values;
    lines.push(`- ${r.day}: ${[...FUNNEL.map((f) => f.metric), "safety"].map((m) => n(v[m] ?? 0)).join(" · ")}`);
  }
  lines.push("", "■ 광고 소재별 (방문 많은 순, 방문 · 시작 · 결과 · 결제)");
  if (input.utm.length === 0) lines.push("- (그 날 광고 소재 기록 없음)");
  for (const u of input.utm) lines.push(`- ${u.key}: ${n(u.visit)} · ${n(u.started)} · ${n(u.result)} · ${n(u.paid)}`);
  if (input.worryNote) lines.push("", `■ 고민 누적 엑셀: ${input.worryNote}`);
  lines.push("", "관리자 화면: https://tarot.ssolwellnesshouse.com/admin");
  return { subject: `[쏠 타로] ${input.day} 시작 ${n(started)} · 결제 ${n(paid)}`, text: lines.join("\n") };
}
