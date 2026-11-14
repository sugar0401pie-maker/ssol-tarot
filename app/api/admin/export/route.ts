import { fail } from "@/lib/server/http";
import { adminExport, adminUtmExport, requireAdmin } from "@/lib/server/admin";
import { isValidDay, kstToday } from "@/lib/admin/kstDay";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 관리자: 참가자 전체 데이터 엑셀(.xlsx). range=day(그 날 하루) | until(처음부터 그 날까지) | paid(그 날까지 결제분 + 리포트 전문) | utm(그 날까지 광고 소재별 집계)
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    const sp = new URL(req.url).searchParams;
    const day = isValidDay(sp.get("day")) ? (sp.get("day") as string) : kstToday();
    const r = sp.get("range");
    const range = r === "until" ? "until" : r === "paid" ? "paid" : r === "utm" ? "utm" : "day";
    // range=utm: 광고 소재별 집계(2026-11-14)
    const { file } = range === "utm" ? await adminUtmExport(day, admin) : await adminExport(day, range, admin);
    const name = `ssol-tarot_${range === "day" ? day : range === "paid" ? `paid_until_${day}` : range === "utm" ? `utm_until_${day}` : `until_${day}`}.xlsx`;
    return new Response(file as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return fail(e, req);
  }
}
