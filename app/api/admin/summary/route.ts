import { NextResponse } from "next/server";
import { fail } from "@/lib/server/http";
import { adminSummary, requireAdmin } from "@/lib/server/admin";
import { isValidDay, kstToday } from "@/lib/admin/kstDay";

export const dynamic = "force-dynamic";

// 관리자: 그 날 기준 단계 표(방문 → 시작 → 결과 → 결제)
export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const q = new URL(req.url).searchParams.get("day");
    const day = isValidDay(q) ? q : kstToday();
    return NextResponse.json(await adminSummary(day), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e, req);
  }
}
