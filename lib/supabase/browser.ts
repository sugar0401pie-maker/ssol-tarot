"use client";

// 브라우저용 Supabase 클라이언트(쏠 아스트로 하우스 lib/supabase/browser.ts와 같은 방식). 공개돼도 되는 값(NEXT_PUBLIC_*)만 쓴다.
// 세션을 쿠키(.ssolwellnesshouse.com)에 두어 쏘웰라(app.)·디저트·아스트로 테스트와 같은 로그인을 공유한다.
// 2026-10-21 owner 결정으로 로그인해야 테스트를 할 수 있게 바뀌어(예전엔 게스트가 대부분이라 Supabase 도구를 나중에 불러왔다)
// 첫 화면부터 로그인 상태를 확인해야 하므로 바로 만든다. DB는 여전히 서버 API로만 다룬다.
import { createBrowserClient } from "@supabase/ssr";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { sharedCookieDomain } from "./shared-cookie-domain";

let client: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // 값이 비어 있으면 조용히 실패하지 않고 콘솔에 남긴다(쏘웰라 2026-09-23 배포 사고 — 값 칸이 비어 있었음).
    console.error("Supabase 브라우저 클라이언트 초기화 실패: NEXT_PUBLIC_SUPABASE_URL/ANON_KEY가 비어 있습니다.");
    return null;
  }
  client = createBrowserClient(url, anonKey, {
    cookieOptions: { domain: sharedCookieDomain(typeof window !== "undefined" ? window.location.hostname : undefined) },
  });
  return client;
}

/** 익명 세션은 로그인으로 치지 않는다(쏘웰라 AuthGate와 같은 기준). */
export function isRealSession(session: Session | null): session is Session {
  return !!session && session.user?.is_anonymous !== true;
}

export async function getRealSession(): Promise<Session | null> {
  const supabase = getBrowserClient();
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return isRealSession(data.session) ? data.session : null;
  } catch {
    return null;
  }
}

// 실제(익명 아닌) 로그인 세션의 접근 토큰. 없으면 null.
export async function getAccessToken(): Promise<string | null> {
  return (await getRealSession())?.access_token ?? null;
}
