"use client";

// 하단(사업자 정보 바로 위)의 로그인/로그아웃 자리 — 쏠 아스트로 하우스 AuthFooterLink와 같은 방식:
// 로그아웃 상태 → '로그인', 로그인 상태 → '내 결과 · 로그아웃'.
import Link from "next/link";
import { useEffect, useState } from "react";
import { getBrowserClient, isRealSession } from "@/lib/supabase/browser";
import { signOut } from "@/lib/supabase/authClient";
import { localePath, type Locale } from "@/lib/i18n/locale";

// tone="dark": 결과 화면(크림 바탕)용 남색 글자(owner 2026-10-21 "결과보고서 화면 밑에도 로그인/로그아웃 작게")
export default function AuthFooterLink({ tone = "light", locale = "ko" }: { tone?: "light" | "dark"; locale?: Locale }) {
  const en = locale === "en";
  const L = (p: string) => localePath(p, locale);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) {
      queueMicrotask(() => setLoggedIn(false));
      return;
    }
    void supabase.auth.getSession().then(({ data }) => setLoggedIn(isRealSession(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setLoggedIn(isRealSession(s)));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  if (loggedIn === null) return null;

  return (
    <p className={tone === "dark" ? "authfoot pb-1 pt-4 text-center text-[12px] text-[#204870]/70" : "pb-3 text-center text-sm text-moon/80"}>
      {loggedIn ? (
        <>
          <Link href={L("/results")} className="underline">{en ? "My readings" : "내 결과"}</Link>
          {" · "}
          <button type="button" className="underline" onClick={() => void signOut().then(() => setToast(en ? "You're signed out." : "로그아웃했어요."))}>
            {en ? "Sign out" : "로그아웃"}
          </button>
        </>
      ) : (
        <Link href={L("/login")} className="underline">{en ? "Sign in" : "로그인"}</Link>
      )}
      {toast && <span className="mt-1 block text-xs">{toast}</span>}
    </p>
  );
}
