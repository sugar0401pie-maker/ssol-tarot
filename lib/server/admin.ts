import "server-only";
import { createAdminClient, getAuthUser } from "./supabaseAdmin";
import { TarotError, analysisFor, getResult, type SessionRow } from "./session";
import reportLinesDb from "@/data/report_lines.json";
import { reportText } from "@/lib/tarot-glue/chatSummary";
import { isAdminEmail } from "@/lib/admin/access";
import { checkAdminPassword } from "@/lib/admin/password";
import { addDays, kstDayBounds } from "@/lib/admin/kstDay";
import { buildFunnel, recentDays, type DailyCount } from "@/lib/admin/funnel";
import { ANALYSIS_HEADER, ANALYSIS_WIDTHS, analysisRow, EXPORT_HEADER, EXPORT_WIDTHS, UTM_HEADER, UTM_WIDTHS, exportRow, utmSummaryRows, type ExportOrder, type ExportSession, type ExportUser, type UtmCountRow } from "@/lib/admin/exportRows";
import { buildXlsx } from "@/lib/admin/xlsx";
import subDb from "@/data/worry_subtopics.json";
import { deflateRawSync } from "node:zlib";
import { dailyReportText, isWorryExportDay, utmTop, type UtmDay } from "@/lib/admin/dailyReport";
import { sendEmail } from "@/lib/email/resend";
import { uploadToDrive } from "./driveUpload";

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
export async function adminExport(day: string, range: "day" | "until" | "paid", admin: { id: string }, opts: { analysis?: boolean } = {}) {
  const { start, end } = kstDayBounds(day);
  // 분석 칸(고민 유형·카드 모양·영역 문장)을 다시 계산하려고 카드·폭력 신호·두 번째 의견도 읽는다
  const baseCols = "id, created_at, user_id, nickname, experience, worry_text, worry_skipped, classification, frame, safety_level, result_status, paid_at, report_status, locale, picks, violence, fear";
  const read = (cols: string) => readAll<ExportSession>((from, to) => {
    let q = db().from("tarot_sessions").select(cols).lt("created_at", end);
    if (range === "day") q = q.gte("created_at", start);
    if (range === "paid") q = q.not("paid_at", "is", null);
    return q.order("created_at", { ascending: true }).range(from, to) as unknown as PromiseLike<{ data: ExportSession[] | null; error: { message: string } | null }>;
  });
  // 나중에 마이그레이션으로 생긴 칸(utm 20261114000000, frame_vote 20261022000000)이 아직 없으면 그 칸 없이 읽는다
  // (엑셀의 utm 칸은 빈칸, 카드 모양은 두 번째 의견 없이 계산).
  const optional = ["utm", "frame_vote"];
  const tryRead = async (extra: string[]): Promise<ExportSession[]> => {
    try {
      return await read([baseCols, ...extra].join(", "));
    } catch (e) {
      const miss = e instanceof TarotError ? extra.find((c) => e.message.includes(c)) : undefined;
      if (!miss) throw e;
      return tryRead(extra.filter((c) => c !== miss));
    }
  };
  const sessions = await tryRead(optional);

  // 결제 완료 주문(결과별 하나)
  const orders = new Map<string, ExportOrder>();
  const ids = sessions.map((s) => s.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db().from("tarot_orders").select("*").in("session_id", ids.slice(i, i + 200)).eq("status", "paid");
    if (error) throw new TarotError(500, `주문을 읽지 못했어요(${error.message}).`);
    for (const o of data ?? []) orders.set(o.session_id, { session_id: o.session_id, amount: Number(o.amount), currency: o.currency ?? "KRW", paid_at: o.paid_at, method: o.method ?? null });
  }

  // 계정 이메일·로그인 수단(로그인한 결과만)
  const users = new Map<string, ExportUser | null>();
  // 분석용(메일 첨부)은 이메일·로그인 수단 칸을 빼므로 계정을 읽지 않는다
  const userIds = opts.analysis ? [] : [...new Set(sessions.map((s) => s.user_id).filter((x): x is string => Boolean(x)))];
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
  const variantNames = (reportLinesDb as unknown as { area_variants: { variants: Record<string, { name?: string }> } }).area_variants.variants;
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
    const row = exportRow(s, s.user_id ? users.get(s.user_id) : null, orders.get(s.id), subs, frames, analysisFor(s as unknown as SessionRow), variantNames);
    if (opts.analysis) return analysisRow(row);
    return range === "paid" ? [...row, reports.get(s.id) ?? ""] : row;
  });
  // 누가 언제 몇 건을 내려받았는지만 기록(내용·이메일은 남기지 않음)
  console.info("관리자 엑셀 내려받기:", { admin: admin.id, day, range, analysis: Boolean(opts.analysis), rows: rows.length });
  if (opts.analysis) {
    const file = buildXlsx(`${day}까지 고민 분석용`, ANALYSIS_HEADER, rows, ANALYSIS_WIDTHS, (b) => new Uint8Array(deflateRawSync(b)));
    return { file, count: rows.length };
  }
  const title = range === "day" ? `${day} 참가자` : range === "paid" ? `${day}까지 결제 리포트` : `${day}까지 참가자`;
  const header = range === "paid" ? [...EXPORT_HEADER, "리포트 전문"] : EXPORT_HEADER;
  const widths = range === "paid" ? [...EXPORT_WIDTHS, 100] : EXPORT_WIDTHS;
  const file = buildXlsx(title, header, rows, widths);
  return { file, count: rows.length };
}

/** 광고 소재별 집계 엑셀(owner 2026-11-14): 처음부터 그 날까지, 날짜 × utm_source × utm_campaign × utm_content(표 tarot_utm_counts). */
export async function adminUtmExport(day: string, admin: { id: string }) {
  const counts = await readAll<UtmCountRow>((from, to) =>
    db().from("tarot_utm_counts").select("day, source, campaign, content, metric, value").lte("day", day)
      .order("day", { ascending: true }).range(from, to) as unknown as PromiseLike<{ data: UtmCountRow[] | null; error: { message: string } | null }>,
  ).catch((e) => {
    if (e instanceof TarotError && /tarot_utm_counts/.test(e.message)) throw new TarotError(503, "광고 소재 표가 아직 없어요(마이그레이션 20261114000000 실행 필요).");
    throw e;
  });
  const rows = utmSummaryRows(counts.map((c) => ({ ...c, day: String(c.day).slice(0, 10), value: Number(c.value) })));
  console.info("관리자 광고 소재 엑셀 내려받기:", { admin: admin.id, day, rows: rows.length });
  return { file: buildXlsx(`${day}까지 광고 소재별`, UTM_HEADER, rows, UTM_WIDTHS), count: rows.length };
}

/** 매일 관리자 메일(owner 2026-11-19, Vercel cron → /api/cron/admin-report).
 *  sendDay = 보내는 날(한국 시간), 보고하는 날 = 그 전날. 월·목(또는 withWorries)에는 처음부터 그 전날까지의
 *  고민 분석용 엑셀(닉네임·이메일·로그인 수단 뺌, 압축)을 구글 드라이브에 올리고 메일엔 그 사실만 적는다. 받는 사람은 ADMIN_REPORT_TO(없으면 owner 주소). */
export const ADMIN_REPORT_TO_DEFAULT = "sugar0401pie@gmail.com";

export async function sendAdminDailyReport(sendDay: string, opts: { withWorries?: boolean } = {}) {
  const day = addDays(sendDay, -1);
  const summary = await adminSummary(day);
  const { data: utmData, error: utmErr } = await db().from("tarot_utm_counts").select("source, campaign, content, metric, value").eq("day", day);
  if (utmErr) console.warn("관리자 메일: 광고 소재 표를 읽지 못함:", utmErr.code ?? utmErr.message);
  const utm = utmTop(((utmData ?? []) as UtmDay[]).map((r) => ({ ...r, value: Number(r.value) })));

  // 드라이브 설정이 없으면(지금 꺼 둔 상태 — docs/ops/고민엑셀_드라이브_자동화.md) 엑셀을 만들지도 않고 메일에도 적지 않는다.
  const driveOn = Boolean(process.env.DRIVE_UPLOAD_URL?.trim() && process.env.DRIVE_UPLOAD_SECRET?.trim());
  const wantWorries = driveOn && (opts.withWorries || isWorryExportDay(sendDay));
  let worryNote: string | null = null;
  let uploaded = false;
  if (wantWorries) {
    try {
      const { file, count } = await adminExport(day, "until", { id: "cron" }, { analysis: true });
      // 메일 첨부 대신 구글 드라이브 폴더에 올린다(owner 2026-11-19). 고민 글은 메일로 보내지 않는다.
      const up = await uploadToDrive(file, `ssol-tarot_worries_until_${day}.xlsx`);
      uploaded = up.ok;
      if (up.ok) worryNote = `처음부터 ${day}까지 ${count.toLocaleString("en-US")}건을 구글 드라이브에 올렸어요(닉네임·이메일·로그인 수단 제외).${up.url ? `\n${up.url}` : ""}`;
      else if (up.reason === "not_configured") worryNote = "드라이브 올리기 설정(DRIVE_UPLOAD_URL·DRIVE_UPLOAD_SECRET)이 아직 없어요.";
      else {
        console.error("관리자 메일: 드라이브 올리기 실패:", up.reason);
        worryNote = "드라이브에 올리지 못했어요 — 관리자 화면에서 내려받아 주세요.";
      }
    } catch (e) {
      console.error("관리자 메일: 고민 엑셀 실패:", e instanceof Error ? e.message.slice(0, 120) : "unknown");
      worryNote = "만들지 못했어요 — 관리자 화면에서 내려받아 주세요.";
    }
  }
  const { subject, text } = dailyReportText({ day, funnel: summary.funnel, recent: summary.recent, utm, worryNote });
  const to = process.env.ADMIN_REPORT_TO?.trim() || ADMIN_REPORT_TO_DEFAULT;
  const r = await sendEmail({ to, subject, text });
  console.info("관리자 메일:", { day, ok: r.ok, reason: r.reason ?? null, uploaded });
  return { day, ok: r.ok, reason: r.reason ?? null, uploaded };
}
