"use client";

// 하단(사업자 정보 바로 위)의 로그인/로그아웃 자리 — 쏠 아스트로 하우스 AuthFooterLink와 같은 방식:
// 로그아웃 상태 → '로그인', 로그인 상태 → '내 결과 · 로그아웃'.
import Link from "next/link";
import { useEffect, useState } from "react";
import { getBrowserClient, isRealSession } from "@/lib/supabase/browser";
import { signOut } from "@/lib/supabase/authClient";

export default function AuthFooterLink() {
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
    <p className="pb-3 text-center text-sm text-moon/80">
      {loggedIn ? (
        <>
          <Link href="/results" className="underline">내 결과</Link>
          {" · "}
          <button type="button" className="underline" onClick={() => void signOut().then(() => setToast("로그아웃했어요."))}>
            로그아웃
          </button>
        </>
      ) : (
        <Link href="/login" className="underline">로그인</Link>
      )}
      {toast && <span className="mt-1 block text-xs">{toast}</span>}
    </p>
  );
}
