// @supabase/ssr의 세션 쿠키 이름: sb-<프로젝트>-auth-token (길면 .0 .1 로 나뉨).
// 이 쿠키가 없으면 로그인한 적 없는 게스트 — Supabase 도구를 불러올 필요가 없다.
export function hasAuthCookie(cookie: string): boolean {
  return /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(cookie);
}
