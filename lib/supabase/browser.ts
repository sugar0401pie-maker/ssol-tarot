import type { SupabaseClient } from "@supabase/supabase-js";
import { sharedCookieDomain } from "./shared-cookie-domain";
import { hasAuthCookie } from "./authCookie";

// 브라우저용 Supabase 클라이언트. 이 앱은 로그인 상태 확인에만 쓴다(DB는 서버 API로만 다룸).
// 세션을 쿠키(.ssolwellnesshouse.com)에 두어 쏘웰라(app.)·디저트 테스트와 같은 로그인을 공유한다.
// Supabase 도구(압축 전 약 260KB)는 첫 화면에 싣지 않고, 로그인 쿠키가 있을 때만 그때 불러온다 —
// 대부분의 방문자(게스트)는 이 파일을 아예 받지 않는다.
let client: Promise<SupabaseClient | null> | null = null;

export function getBrowserClient(): Promise<SupabaseClient | null> {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return Promise.resolve(null); // 설정 전이면 게스트로만 진행
  client = import("@supabase/ssr")
    .then(({ createBrowserClient }) =>
      createBrowserClient(url, anonKey, {
        cookieOptions: { domain: sharedCookieDomain(typeof window !== "undefined" ? window.location.hostname : undefined) },
      }),
    )
    .catch(() => {
      client = null; // 불러오기 실패(네트워크) — 다음에 다시 시도, 이번엔 게스트로
      return null;
    });
  return client;
}

// 실제(익명 아닌) 로그인 세션의 접근 토큰. 없으면 null — 로그인 없이도 테스트는 끝까지 된다.
export async function getAccessToken(): Promise<string | null> {
  if (typeof document === "undefined" || !hasAuthCookie(document.cookie)) return null;
  const supabase = await getBrowserClient();
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    if (!s || s.user.is_anonymous) return null;
    return s.access_token;
  } catch {
    return null;
  }
}
