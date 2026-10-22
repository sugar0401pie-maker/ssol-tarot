// 로그인 화면용 순수 함수(네트워크 없음 → 단위 테스트 가능).

// 로그인 뒤 돌아갈 주소. 우리 앱 안의 경로("/"로 시작, "//"·"/\" 아님)만 허용한다 —
// ?next=https://다른사이트 같은 값으로 밖으로 내보내는 것(오픈 리다이렉트)을 막기 위해서다.
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  // 브라우저는 주소의 탭·줄바꿈을 지워 "/\t/evil.com"을 "//evil.com"으로 읽는다 — 제어 문자·역슬래시가 있으면 거부(아스트로와 같은 규칙)
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return "/";
  return raw;
}

// 이메일·비밀번호 입력 검사. 문제가 없으면 null, 있으면 화면에 보여 줄 안내 문구.
export function checkLoginInput(email: string, password: string): string | null {
  const e = email.trim();
  if (!e) return "이메일을 입력해 주세요.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return "이메일 형식을 확인해 주세요.";
  if (!password) return "비밀번호를 입력해 주세요.";
  return null;
}
