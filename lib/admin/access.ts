// 관리자 화면(/admin) 접근 — owner 지정(2026-11-09): 관리자 계정은 seotaiji0124@naver.com 하나만.
// 로그인 계정 이메일이 이 목록과 정확히 같을 때만 열린다(대소문자·앞뒤 공백 무시). 목록이 비면 아무도 못 들어온다(fail closed).
// 고객 고민 글·이메일을 내려받는 화면이라 환경 변수로 넓히지 않고 코드에만 둔다 — 바꾸려면 이 목록만 고친다.
export const ADMIN_EMAILS: readonly string[] = ["seotaiji0124@naver.com"];

export function isAdminEmail(email: string | null | undefined, list: readonly string[] = ADMIN_EMAILS): boolean {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e) return false;
  return list.some((a) => a.trim().toLowerCase() === e);
}
