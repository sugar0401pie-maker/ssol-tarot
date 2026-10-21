// 비밀번호 규칙 — 쏘웰라 가입 화면(components/auth/LoginScreen.tsx)과 같다(같은 계정이라 규칙도 같아야 함).
export function passwordChecks(pw: string): { length: boolean; upper: boolean; special: boolean } {
  return { length: pw.length >= 8, upper: /[A-Z]/.test(pw), special: /[^A-Za-z0-9]/.test(pw) };
}

export function isPasswordValid(pw: string): boolean {
  const c = passwordChecks(pw);
  return c.length && c.upper && c.special;
}
