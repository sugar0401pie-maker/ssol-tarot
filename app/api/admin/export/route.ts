import { fail } from "@/lib/server/http";
import { adminExport, requireAdmin } from "@/lib/server/admin";
import { isValidDay, kstToday } from "@/lib/admin/kstDay";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 관리자: 참가자 전체 데이터 엑셀(.xlsx). range=day(그 날 하루) | until(처음부터 그 날까지)
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    const sp = new URL(req.url).searchParams;
    const day = isValidDay(sp.get("day")) ? (sp.get("day") as string) : kstToday();
    const range = sp.get("range") === "until" ? "until" : "day";
    const { file } = await adminExport(day, range, admin);
    const name = `ssol-tarot_${range === "day" ? day : `until_${day}`}.xlsx`;
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
