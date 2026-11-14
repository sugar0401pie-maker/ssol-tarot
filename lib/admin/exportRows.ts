// 관리자 엑셀 내려받기 한 줄 = 타로 결과 1건(owner 2026-11-09 — 예전엔 SQL로 일일이 뽑던 것).
// 순수 함수: DB에서 읽은 결과·계정·주문을 받아 엑셀 칸으로 바꾼다(테스트 있음).
import type { Cell } from "./xlsx.ts";
import { kstStamp } from "./kstDay.ts";

export type ExportSession = {
  id: string;
  created_at: string;
  user_id: string | null;
  nickname: string | null;
  experience: string | null;
  worry_text: string | null;
  worry_skipped?: boolean | null;
  classification?: { domain?: string | null } | null;
  frame?: { area?: string | null; sub_id?: string | null; table?: string | null; frame_id?: string | null; followup?: { answers?: string[]; skipped?: boolean } | null } | null;
  safety_level?: string | null;
  result_status?: string | null;
  paid_at?: string | null;
  report_status?: string | null;
  locale?: string | null;
};
export type ExportUser = { email: string | null; provider: string | null; providers?: string[] | null };
export type ExportOrder = { session_id: string; amount: number; currency?: string | null; paid_at: string | null };

export const EXPORT_HEADER = [
  "참가 시각(한국)", "결과 번호", "언어", "닉네임", "이메일", "로그인 수단", "타로 경험", "고민 글", "고민 글자 수",
  "고민 영역", "세부 고민", "점수표", "안전 단계", "결과 상태", "결제 여부", "결제 시각(한국)", "결제 금액", "통화", "리포트 상태",
  // v2.3.14(2026-11-14): 결과 틀(두 단계 고르기) · 짧은 고민에 다시 묻기(A/B — 결과 번호로 반씩)
  "결과 틀", "다시 묻기",
];
export const EXPORT_WIDTHS = [17, 38, 6, 12, 28, 12, 10, 60, 10, 10, 24, 11, 9, 10, 18, 17, 10, 6, 10, 24, 22];

const PROVIDER: Record<string, string> = { email: "이메일", kakao: "카카오", "custom:naver": "네이버", naver: "네이버", google: "구글", apple: "애플" };
export function providerLabel(u: ExportUser | null | undefined, userId: string | null): string {
  if (!userId) return "로그인 안 함";
  if (!u) return "계정 없음(탈퇴 등)";
  const p = u.provider ?? u.providers?.[0] ?? null;
  return p ? (PROVIDER[p] ?? p) : "알 수 없음";
}

const AREA: Record<string, string> = { LOV: "연애", CAR: "직장", JOB: "취업", EDU: "시험·학업", DIR: "진로", FAM: "가족", SOC: "친구·사회", LIF: "돈·생활", SELF: "나 자신", FORT: "운세", NONE: "없음" };
const SAFETY: Record<string, string> = { none: "보통", watch: "주의", urgent: "위기(멈춤)" };
const RESULT: Record<string, string> = { ready: "결과 나옴", safety: "안전 안내", started: "고민 쓰기 전·중", drawing: "카드 뽑는 중", preparing: "결과 만드는 중" };
const REPORT: Record<string, string> = { none: "", generating: "만드는 중", ready: "완성", failed: "실패" };

export function exportRow(
  s: ExportSession,
  u: ExportUser | null | undefined,
  order: ExportOrder | null | undefined,
  subNames: Record<string, { name?: string }> = {},
  frameNames: Record<string, { name?: string }> = {},
): Cell[] {
  const area = s.frame?.area ?? s.classification?.domain ?? null;
  const sub = s.frame?.sub_id ?? null;
  const paid = order ? "결제" : s.paid_at ? "무료 열람(관리자 지정)" : "안 함";
  const worry = s.worry_text ?? "";
  return [
    kstStamp(s.created_at),
    s.id,
    s.locale === "en" ? "영어" : "한국어",
    s.nickname ?? "",
    u?.email ?? "",
    providerLabel(u, s.user_id),
    s.experience === "first" ? "처음" : s.experience === "returning" ? "본 적 있음" : "",
    worry || (s.worry_skipped ? "(건너뜀)" : ""),
    worry.length,
    area ? (AREA[area] ?? area) : "",
    sub ? `${subNames[sub]?.name ?? ""} (${sub})`.trim() : "",
    s.frame?.table ?? "",
    SAFETY[s.safety_level ?? ""] ?? s.safety_level ?? "",
    RESULT[s.result_status ?? ""] ?? s.result_status ?? "",
    paid,
    kstStamp(order?.paid_at ?? s.paid_at ?? null),
    order ? (order.currency === "USD" ? order.amount / 100 : order.amount) : "",
    order ? (order.currency ?? "KRW") : "",
    REPORT[s.report_status ?? ""] ?? s.report_status ?? "",
    s.frame?.frame_id ? `${frameNames[s.frame.frame_id]?.name ?? ""} (${s.frame.frame_id})`.trim() : "",
    followupLabel(s.frame?.followup ?? null),
  ];
}

/** 다시 묻기 칸: 보여 주지 않았으면 빈칸, 건너뛰면 "건너뜀", 답했으면 "q1:love, love:crush". */
export function followupLabel(f: { answers?: string[]; skipped?: boolean } | null): string {
  if (!f) return "";
  if (f.skipped || !f.answers?.length) return "건너뜀";
  return f.answers.join(", ");
}
