// 관리자 화면의 단계별 표(owner 2026-11-09): 방문 → 테스트 시작 → 결과까지 → 결제.
// 숫자는 tarot_daily_counts(날짜별 숫자만 쌓는 표)에서 온다 — 로그인 없이 본 결과가 지워져도 줄지 않는 값.
// 전환율 = 바로 앞 단계 대비 %. 앞 단계 숫자가 0이면 전환율은 없음(null).
export type DailyCount = { day: string; metric: string; value: number };

export const FUNNEL = [
  { metric: "visit", label: "첫 화면 방문" },
  { metric: "started", label: "테스트 시작" },
  { metric: "result", label: "결과까지 봄" },
  { metric: "paid", label: "결제(전체 리포트)" },
] as const;

export type FunnelRow = {
  metric: string;
  label: string;
  day: number;
  dayRate: number | null;
  total: number;
  totalRate: number | null;
};

const rate = (n: number, prev: number | null) => (prev === null || prev <= 0 ? null : Math.round((n / prev) * 1000) / 10);

/** day(그 날) 하루 숫자와, 처음부터 그 날까지의 누적 숫자로 단계 표를 만든다. */
export function buildFunnel(rows: DailyCount[], day: string): FunnelRow[] {
  const sum = (metric: string, pred: (d: string) => boolean) =>
    rows.filter((r) => r.metric === metric && pred(r.day)).reduce((s, r) => s + (Number(r.value) || 0), 0);
  let prevDay: number | null = null;
  let prevTotal: number | null = null;
  return FUNNEL.map(({ metric, label }) => {
    const d = sum(metric, (x) => x === day);
    const t = sum(metric, (x) => x <= day);
    const row: FunnelRow = { metric, label, day: d, dayRate: rate(d, prevDay), total: t, totalRate: rate(t, prevTotal) };
    prevDay = d;
    prevTotal = t;
    return row;
  });
}

/** 그 날 포함 최근 n일의 날짜별 숫자(표 아래 '최근 7일'). */
export function recentDays(rows: DailyCount[], day: string, days: string[]): { day: string; values: Record<string, number> }[] {
  return days.map((d) => ({
    day: d,
    values: Object.fromEntries(
      [...FUNNEL.map((f) => f.metric), "safety"].map((m) => [m, rows.filter((r) => r.day === d && r.metric === m).reduce((s, r) => s + (Number(r.value) || 0), 0)]),
    ),
  })).filter((x) => x.day <= day);
}
