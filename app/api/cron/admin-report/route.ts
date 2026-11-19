import { sendAdminDailyReport } from "@/lib/server/admin";
import { kstToday } from "@/lib/admin/kstDay";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 매일 관리자 메일(owner 2026-11-19). Vercel cron(vercel.json)이 매일 09시(한국)쯤 부른다.
// Vercel은 CRON_SECRET 환경 변수가 있으면 "Authorization: Bearer <값>"을 붙여 부른다 — 없거나 다르면 거절(누구나 메일을 보내게 하지 않음).
// ?worries=1 이면 요일과 상관없이 고민 엑셀을 붙인다(수동 시험용, 같은 비밀값 필요).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const withWorries = new URL(req.url).searchParams.get("worries") === "1";
    const r = await sendAdminDailyReport(kstToday(), { withWorries });
    return Response.json(r, { status: r.ok ? 200 : 502 });
  } catch (e) {
    console.error("관리자 메일 실패:", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
