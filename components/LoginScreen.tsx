"use client";

// 로그인 화면(/login) — 쏠 아스트로 하우스 /login(LoginClient)과 같은 구성(owner 2026-10-21 "이 페이지처럼 넣어줘"):
// 제목 → 안내말 → 안내 그림 → [5초만에 빠르게 카카오로 시작하기][네이버로 시작하기][이메일로 시작하기] → '아직 계정이 없으신가요? 회원가입하기'.
// 2026-10-21 owner 결정: 로그인해야 테스트를 할 수 있다 → 아스트로의 '로그인 없이 테스트하기'는 두지 않는다.
// ?next=로 돌아갈 곳을 받는다(사이트 안 경로만 — safeNext). 테스트를 시작하러 왔으면 시작 문구, [이전 결과 보기]에서 왔으면 결과 문구.
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AuthStep from "./auth/AuthStep";
import PageFoot from "./PageFoot";
import { SceneArt } from "./SceneArt";
import { Stars } from "./Cards";
import { safeNext } from "@/lib/client/loginForm";
import { oauthErrorFromUrl } from "@/lib/auth/oauthError";
import { getRealSession } from "@/lib/supabase/browser";
import { signOut } from "@/lib/supabase/authClient";
import type { SceneArtMap } from "@/lib/client/sceneArt";

export default function LoginScreen({ sceneArt }: { sceneArt: SceneArtMap }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const goNext = useCallback(() => router.replace(next), [router, next]);

  // 이미 로그인돼 있으면(쏘웰라·디저트·아스트로에서 로그인한 경우 포함) 그냥 넘기지 않고 '이 계정으로 계속할까요?'를 먼저 보여 준다
  // (owner 2026-10-22 "닉네임 입력하기 전에 로그인하는 페이지"). 카카오·네이버 로그인을 막 마치고 돌아온 경우(?via=oauth)만 바로 넘어간다.
  const justOAuth = params.get("via") === "oauth";
  const [account, setAccount] = useState<string | null>(null);
  useEffect(() => {
    void getRealSession().then((s) => {
      if (!s) return;
      if (justOAuth) return goNext();
      setAccount(s.user.email ?? "");
    });
  }, [goNext, justOAuth]);

  // 카카오·네이버 로그인이 실패하면 Supabase가 ?error=…로 돌려보낸다 — 이유를 보여 준다(아스트로와 같음).
  const oauthReason = oauthErrorFromUrl({ search: `?${params.toString()}`, hash: "" });
  const isResults = next.startsWith("/results") || next.startsWith("/result/");
  // 문구: 아스트로 로그인 화면 문장에서 별자리 → 타로로. '나중에 태어난 시간을 추가할 수도 있어요'는 타로에 없는 기능이라 뺐다.
  const title = isResults ? "로그인하고\n내 결과를 다시 볼까요?" : "빠르게 로그인하고\n내 타로를 확인해볼까요?";
  const subtitle = "결과는 내 계정에 저장돼서 언제든 다시 볼 수 있어요.";
  const art = sceneArt.login?.length ? "login" : "welcome";

  return (
    <main className="night-bg relative flex min-h-dvh flex-col overflow-x-hidden">
      <Stars />
      <div className="auth relative z-[1] mx-auto w-full max-w-md flex-1 px-6 pb-10 pt-7">
        <Link href="/" className="text-[13px] text-moon/80">
          ← 처음으로
        </Link>
        {account !== null ? (
          <div className="flex flex-col gap-5">
            <h1 className="big whitespace-pre-line break-keep">{title}</h1>
            <p className="small whitespace-pre-line">{account ? `지금 ${account}\n계정으로 로그인되어 있어요.` : "지금 쏠 웰니스 하우스 계정으로\n로그인되어 있어요."}</p>
            <SceneArt map={sceneArt} id={art} className="guide-art fade-up" sizes="320px" />
            <button type="button" className="btn block" onClick={goNext}>
              이 계정으로 계속하기
            </button>
            <button type="button" className="linkish" onClick={() => void signOut().then(() => setAccount(null))}>
              다른 계정으로 로그인하기
            </button>
          </div>
        ) : (
        <AuthStep
          title={title}
          subtitle={subtitle}
          start
          initialMode={params.get("mode") === "signup" ? "signup" : "signin"}
          oauthRedirect={typeof window !== "undefined" ? `${window.location.origin}/login?via=oauth&next=${encodeURIComponent(next)}` : undefined}
          initialError={oauthReason}
          onSignedIn={goNext}
          art={<SceneArt map={sceneArt} id={art} className="guide-art fade-up" sizes="320px" />}
        />
        )}
      </div>
      <PageFoot />
    </main>
  );
}
