"use client";

// 관리자 화면(/admin, owner 2026-11-09): 날짜를 고르면 그 날 하루·처음부터 그 날까지의 단계 표(전 단계 대비 전환율)와
// 참가자 전체 데이터 엑셀 내려받기. 관리자 이메일 확인은 서버가 한다(lib/admin/access.ts) — 이 화면은 결과만 보여 준다.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getAccessToken, getRealSession } from "@/lib/supabase/browser";
import { kstToday } from "@/lib/admin/kstDay";
import type { FunnelRow } from "@/lib/admin/funnel";

type Summary = { day: string; funnel: FunnelRow[]; recent: { day: string; values: Record<string, number> }[]; firstVisitDay: string | null };

const fmt = (n: number) => n.toLocaleString("ko-KR");
const pct = (r: number | null) => (r === null ? "–" : `${r.toFixed(1)}%`);

async function authed(path: string): Promise<Response> {
  const token = await getAccessToken();
  return fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
}

export default function AdminDashboard() {
  const router = useRouter();
  const [day, setDay] = useState(() => kstToday());
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "day" | "until">("");

  const load = useCallback(async (d: string) => {
    setErr(null);
    if (!(await getRealSession())) {
      router.replace("/login?next=/admin");
      return;
    }
    const res = await authed(`/api/admin/summary?day=${d}`);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setData(null);
      setErr(j.error ?? "불러오지 못했어요.");
      return;
    }
    setData(j as Summary);
  }, [router]);

  useEffect(() => {
    const t = setTimeout(() => void load(day), 0);
    return () => clearTimeout(t);
  }, [day, load]);

  const download = async (range: "day" | "until") => {
    setBusy(range);
    setErr(null);
    try {
      const res = await authed(`/api/admin/export?day=${day}&range=${range}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "내려받지 못했어요.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ssol-tarot_${range === "day" ? day : `until_${day}`}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "내려받지 못했어요.");
    } finally {
      setBusy("");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-800">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">쏠 타로 하우스 · 관리자</h1>
            <p className="text-sm text-slate-500">날짜는 한국 시간 기준이에요.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            기준 날짜
            <input type="date" value={day} max={kstToday()} onChange={(e) => e.target.value && setDay(e.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1" />
          </label>
        </header>

        {err && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        {data && (
          <section className="rounded-lg bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">단계별 숫자 ({data.day})</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2">단계</th>
                    <th className="py-2 text-right">그 날</th>
                    <th className="py-2 text-right">전 단계 대비</th>
                    <th className="py-2 text-right">누적(그 날까지)</th>
                    <th className="py-2 text-right">전 단계 대비</th>
                  </tr>
                </thead>
                <tbody>
                  {data.funnel.map((r) => (
                    <tr key={r.metric} className="border-b last:border-0">
                      <td className="py-2">{r.label}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(r.day)}</td>
                      <td className="py-2 text-right tabular-nums text-slate-600">{pct(r.dayRate)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(r.total)}</td>
                      <td className="py-2 text-right tabular-nums text-slate-600">{pct(r.totalRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              방문은 첫 화면을 연 횟수(같은 탭에서는 한 번){data.firstVisitDay ? ` — ${data.firstVisitDay}부터 셌어요. 그 전 날짜가 들어간 누적은 방문보다 시작이 많을 수 있어요.` : "."}{" "}
              결제는 실제 결제만(무료 열람 계정 제외). 로그인 없이 본 결과가 지워져도 이 숫자는 줄지 않아요.
            </p>
          </section>
        )}

        {data && (
          <section className="rounded-lg bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">최근 7일</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2">날짜</th>
                    <th className="py-2 text-right">방문</th>
                    <th className="py-2 text-right">시작</th>
                    <th className="py-2 text-right">결과</th>
                    <th className="py-2 text-right">결제</th>
                    <th className="py-2 text-right">결제/결과</th>
                    <th className="py-2 text-right">안전 안내</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((r) => (
                    <tr key={r.day} className="border-b last:border-0 tabular-nums">
                      <td className="py-2">{r.day}</td>
                      <td className="py-2 text-right">{fmt(r.values.visit)}</td>
                      <td className="py-2 text-right">{fmt(r.values.started)}</td>
                      <td className="py-2 text-right">{fmt(r.values.result)}</td>
                      <td className="py-2 text-right">{fmt(r.values.paid)}</td>
                      <td className="py-2 text-right text-slate-600">{r.values.result ? pct(Math.round((r.values.paid / r.values.result) * 1000) / 10) : "–"}</td>
                      <td className="py-2 text-right">{fmt(r.values.safety)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {data && (
          <section className="rounded-lg bg-white p-4 shadow-sm">
            <h2 className="mb-1 font-semibold">참가자 데이터 엑셀</h2>
            <p className="mb-3 text-xs leading-relaxed text-slate-500">
              참가 시각·이메일·로그인 수단·고민 글·고민 영역·안전 단계·결제 여부가 들어 있어요. 고객의 민감한 글이 담긴 파일이니 공유·보관에 주의해 주세요.
              로그인 없이 본 결과는 보관 기간이 지나면 지워져서 파일에 없을 수 있어요.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy !== ""} onClick={() => void download("day")} className="rounded bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {busy === "day" ? "만드는 중…" : `${day} 하루 내려받기`}
              </button>
              <button type="button" disabled={busy !== ""} onClick={() => void download("until")} className="rounded border border-slate-800 px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {busy === "until" ? "만드는 중…" : `처음부터 ${day}까지 내려받기`}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
