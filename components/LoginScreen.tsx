"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { checkLoginInput, safeNext } from "@/lib/client/loginForm";
import { Stars } from "./Cards";

// 로그인 화면(밤 테마, 디자인 가이드 4·5장). 2026-10-07 owner: "로그인·결제 API는 나중에 붙일게, 로그인 화면만 만들어 줘."
// → 화면과 입력 검사까지만 만들고, 실제 로그인 호출은 비워 둔다(누르면 "준비 중" 안내).
// 계정은 쏘웰라·디저트 테스트와 같은 Supabase 계정이다.
// 회원가입은 같은 계정을 만드는 쏘웰라 가입 화면으로 보낸다(이 앱에 가입 폼을 따로 두지 않음 — 바꾸려면 SIGNUP_URL만 고치면 됨).
const SIGNUP_URL = "https://app.ssolwellnesshouse.com/signup";
const NOT_CONNECTED = "로그인 연결은 준비 중이에요. 조금만 기다려 주세요.";

export default function LoginScreen() {
  const params = useSearchParams();
  // 로그인 뒤 돌아갈 곳(예: 결과 저장하기에서 왔으면 그 결과 페이지). 실제 로그인 연결 때 router.replace(next)로 쓴다.
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    const problem = checkLoginInput(email, password);
    setError(problem);
    if (problem) return;
    // TODO: 실제 연동 — getBrowserClient().auth.signInWithPassword({ email, password }) 후 router.replace(next).
    // 실패 시 "이메일 또는 비밀번호를 확인해 주세요." 안내. 쿠키는 .ssolwellnesshouse.com에 심겨 쏘웰라와 공유된다.
    void next;
    setNotice(NOT_CONNECTED);
  }

  function social(provider: "kakao" | "naver") {
    setError(null);
    // TODO: 실제 연동 — signInWithOAuth({ provider: provider === "naver" ? "custom:naver" : "kakao",
    // options: { redirectTo: location.origin + next } }) (쏘웰라 lib/supabase/authClient.ts와 같은 방식).
    void provider;
    void next;
    setNotice(NOT_CONNECTED);
  }

  return (
    <main className="night-bg relative flex min-h-dvh flex-col overflow-hidden">
      <Stars />
      <div className="gold-frame relative flex flex-1 flex-col items-center justify-start px-9 py-16">
        <div className="fade-up w-full max-w-sm">
          <Link href="/" className="text-[13px] text-moon/80">
            ← 처음으로
          </Link>
          <div className="mt-8 flex flex-col items-center gap-2 text-center">
            <p className="text-[12px] tracking-[0.2em] text-gold">SSOL WELLNESS HOUSE</p>
            <h1 className="font-serif text-[26px] font-bold text-gold-soft">로그인</h1>
            <p className="text-[14px] leading-relaxed text-moon/85">
              로그인하면 타로 결과를 내 계정에 저장하고
              <br />
              쏘웰라 마이페이지에서 다시 볼 수 있어요.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => social("kakao")}
              className="w-full rounded-full py-3.5 text-[15px] font-medium text-[#191919]"
              style={{ background: "#FEE500" }}
            >
              카카오로 로그인
            </button>
            <button
              type="button"
              onClick={() => social("naver")}
              className="w-full rounded-full py-3.5 text-[15px] font-medium text-white"
              style={{ background: "#03C75A" }}
            >
              네이버로 로그인
            </button>
          </div>

          <div className="my-7 flex items-center gap-3 text-[12px] text-moon/60" aria-hidden>
            <span className="h-px flex-1 bg-gold/40" />
            또는 이메일로
            <span className="h-px flex-1 bg-gold/40" />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-moon/90">이메일</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-night px-4 py-3 text-[15px]"
                aria-invalid={Boolean(error && /이메일/.test(error))}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-moon/90">비밀번호</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-night px-4 py-3 text-[15px]"
                aria-invalid={Boolean(error && /비밀번호/.test(error))}
              />
            </label>
            <p className="min-h-5 text-[13px] text-gold-soft" role="alert">
              {error ?? notice ?? ""}
            </p>
            {/* 디저트 시안 규칙과 같이: 입력 전에도 버튼은 활성, 검사는 누를 때 */}
            <button type="submit" className="btn-night w-full rounded-full py-3.5 text-[15px] font-bold">
              로그인
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-3 text-[13px] text-moon/80">
            <button type="button" onClick={() => setNotice("비밀번호 찾기는 준비 중이에요. 쏘웰라에서 재설정할 수 있어요.")} className="underline">
              비밀번호를 잊으셨나요?
            </button>
            <p>
              계정이 없으신가요?{" "}
              <a href={SIGNUP_URL} className="font-medium text-gold-soft underline">
                회원가입
              </a>
            </p>
            <p className="text-[12px] text-moon/60">쏘웰라·디저트 테스트와 같은 계정으로 로그인해요.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
