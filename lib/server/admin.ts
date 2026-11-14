import "server-only";
import { createAdminClient, getAuthUser } from "./supabaseAdmin";
import { TarotError, getResult, type SessionRow } from "./session";
import { reportText } from "@/lib/tarot-glue/chatSummary";
import { isAdminEmail } from "@/lib/admin/access";
import { checkAdminPassword } from "@/lib/admin/password";
import { addDays, kstDayBounds } from "@/lib/admin/kstDay";
import { buildFunnel, recentDays, type DailyCount } from "@/lib/admin/funnel";
import { EXPORT_HEADER, EXPORT_WIDTHS, exportRow, type ExportOrder, type ExportSession, type ExportUser } from "@/lib/admin/exportRows";
import { buildXlsx } from "@/lib/admin/xlsx";
import subDb from "@/data/worry_subtopics.json";

// 관리자 화면(/admin, owner 2026-11-09). 로그인 이메일이 lib/admin/access.ts ADMIN_EMAILS(seotaiji0124@naver.com)여야 한다.
export async function requireAdmin(req: Request): Promise<{ id: string; email: string }> {
  const u = await getAuthUser(req.headers.get("authorization")).catch(() => null);
  if (!u) throw new TarotError(401, "로그인이 필요해요.");
  if (!u.email || !isAdminEmail(u.email)) throw new TarotError(403, "관리자 계정이 아니에요.");
  // 관리자 계정이어도 입장 암호(x-admin-pass 헤더)를 요청마다 다시 확인한다(owner 2026-11-09). 틀리면 423 → 화면이 암호 입력을 다시 띄움.
  if (!checkAdminPassword(req.headers.get("x-admin-pass"))) {
    console.warn("관리자 입장 암호 불일치:", u.id);
    throw new TarotError(423, "관리자 암호가 맞지 않아요.");
  }
  return { id: u.id, email: u.email };
}

const db = () => createAdminClient();

/** 그 날 기준 단계 표 + 최근 7일. 숫자는 tarot_daily_counts(날짜별 숫자만). */
export async function adminSummary(day: string) {
  const { data, error } = await db().from("tarot_daily_counts").select("day, metric, value").lte("day", day);
  if (error) throw new TarotError(500, `집계 표를 읽지 못했어요(${error.message}).`);
  const rows = (data ?? []).map((r) => ({ day: String(r.day).slice(0, 10), metric: String(r.metric), value: Number(r.value) })) as DailyCount[];
  const days = Array.from({ length: 7 }, (_, i) => addDays(day, i - 6));
  const firstVisitDay = rows.filter((r) => r.metric === "visit").map((r) => r.day).sort()[0] ?? null;
  return { day, funnel: buildFunnel(rows, day), recent: recentDays(rows, day, days), firstVisitDay };
}

const PAGE = 1000;
async function readAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new TarotError(500, `데이터를 읽지 못했어요(${error.message}).`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/** 엑셀 파일: range "day" = 그 날 하루에 시작한 결과, "until" = 처음부터 그 날까지,
 *  "paid" = 처음부터 그 날까지 중 실제 결제한 결과만 + 리포트 전문 칸(owner 2026-11-10). */
export async function adminExport(day: string, range: "day" | "until" | "paid", admin: { id: string }) {
  const { start, end } = kstDayBounds(day);
  const cols = "id, created_at, user_id, nickname, experience, worry_text, worry_skipped, classification, frame, safety_level, result_status, paid_at, report_status, locale";
  const sessions = await readAll<ExportSession>((from, to) => {
    let q = db().from("tarot_sessions").select(cols).lt("created_at", end);
    if (range === "day") q = q.gte("created_at", start);
    if (range === "paid") q = q.not("paid_at", "is", null);
    return q.order("created_at", { ascending: true }).range(from, to) as unknown as PromiseLike<{ data: ExportSession[] | null; error: { message: string } | null }>;
  });

  // 결제 완료 주문(결과별 하나)
  const orders = new Map<string, ExportOrder>();
  const ids = sessions.map((s) => s.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db().from("tarot_orders").select("*").in("session_id", ids.slice(i, i + 200)).eq("status", "paid");
    if (error) throw new TarotError(500, `주문을 읽지 못했어요(${error.message}).`);
    for (const o of data ?? []) orders.set(o.session_id, { session_id: o.session_id, amount: Number(o.amount), currency: o.currency ?? "KRW", paid_at: o.paid_at });
  }

  // 계정 이메일·로그인 수단(로그인한 결과만)
  const users = new Map<string, ExportUser | null>();
  const userIds = [...new Set(sessions.map((s) => s.user_id).filter((x): x is string => Boolean(x)))];
  for (let i = 0; i < userIds.length; i += 10) {
    await Promise.all(
      userIds.slice(i, i + 10).map(async (uid) => {
        const { data } = await db().auth.admin.getUserById(uid);
        const u = data?.user;
        users.set(uid, u ? { email: u.email ?? null, provider: (u.app_metadata?.provider as string) ?? null, providers: (u.app_metadata?.providers as string[]) ?? null } : null);
      }),
    );
  }

  const subs = (subDb as { subs: Record<string, { name?: string }> }).subs;
  const frames = (subDb as { frames?: Record<string, { name?: string }> }).frames ?? {};
  // 결제분 파일: 실제 결제 주문이 있는 결과만(관리자 지정 무료 열람 제외), 고객이 보는 화면과 같은 조립으로 리포트 전문을 붙인다(AI 호출 없음).
  const picked = range === "paid" ? sessions.filter((s) => orders.has(s.id)) : sessions;
  const reports = new Map<string, string>();
  if (range === "paid") {
    for (let i = 0; i < picked.length; i += 100) {
      const { data, error } = await db().from("tarot_sessions").select("*").in("id", picked.slice(i, i + 100).map((s) => s.id));
      if (error) throw new TarotError(500, `리포트를 읽지 못했어요(${error.message}).`);
      for (const row of (data ?? []) as SessionRow[]) {
        try {
          const r = await getResult(row);
          reports.set(row.id, r.status === "ready" && "pages" in r ? reportText(r.pages as Parameters<typeof reportText>[0]) : `(리포트 없음: ${r.status})`);
        } catch {
          reports.set(row.id, "(리포트를 만들지 못했어요)");
        }
      }
    }
  }
  const rows = picked.map((s) => {
    const row = exportRow(s, s.user_id ? users.get(s.user_id) : null, orders.get(s.id), subs, frames);
    return range === "paid" ? [...row, reports.get(s.id) ?? ""] : row;
  });
  // 누가 언제 몇 건을 내려받았는지만 기록(내용·이메일은 남기지 않음)
  console.info("관리자 엑셀 내려받기:", { admin: admin.id, day, range, rows: rows.length });
  const title = range === "day" ? `${day} 참가자` : range === "paid" ? `${day}까지 결제 리포트` : `${day}까지 참가자`;
  const header = range === "paid" ? [...EXPORT_HEADER, "리포트 전문"] : EXPORT_HEADER;
  const widths = range === "paid" ? [...EXPORT_WIDTHS, 100] : EXPORT_WIDTHS;
  const file = buildXlsx(title, header, rows, widths);
  return { file, count: rows.length };
}
