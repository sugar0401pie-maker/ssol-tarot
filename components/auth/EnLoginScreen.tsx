"use client";

// 영문판 로그인(/en/login, 2026-11-05). 한국어판(LoginScreen + AuthStep)과 완전히 따로 만든 화면:
// 카카오·네이버 없음, 구글 + 이메일만. 가입은 이메일 코드 → 닉네임·비밀번호 + 18세 이상·약관 동의(정책 문서 08 ①).
// ?next=로 돌아갈 곳(사이트 안 경로만 — safeNext).
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageFoot from "../PageFoot";
import { SceneArt } from "../SceneArt";
import { Stars } from "../Cards";
import { safeNext } from "@/lib/client/loginForm";
import { getBrowserClient, getRealSession } from "@/lib/supabase/browser";
import { signOut } from "@/lib/supabase/authClient";
import { isPasswordValid, passwordChecks } from "@/lib/auth/password";
import { CONSENT_EN } from "@/lib/i18n/consentEn";
import {
  confirmResetEn, emailAvailableEn, finishSignupEn, requestResetEn, sendSignupCodeEn, signInWithEmailEn, signInWithGoogle,
} from "@/lib/supabase/authClientEn";
import type { SceneArtMap } from "@/lib/client/sceneArt";

type Mode = "signin" | "signup" | "reset";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function Rules({ pw }: { pw: string }) {
  const c = passwordChecks(pw);
  const item = (ok: boolean, label: string) => <li className={ok ? "text-cream" : "text-cream/50"}>{ok ? "●" : "○"} {label}</li>;
  return <ul className="flex flex-col gap-0.5 text-xs">{item(c.length, "At least 8 characters")}{item(c.upper, "At least 1 uppercase letter")}{item(c.special, "At least 1 special character")}</ul>;
}

export default function EnLoginScreen({ sceneArt }: { sceneArt: SceneArtMap }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = (() => {
    const n = safeNext(params.get("next"));
    return n === "/" ? "/en" : n;
  })();
  const goNext = useCallback(() => router.replace(next), [router, next]);
  const justOAuth = params.get("via") === "oauth";
  const [checked, setChecked] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [error, setError] = useState<string | null>(params.get("error_description") ? "Google sign-in didn't finish. Please try again." : null);
  const [busy, setBusy] = useState(false);
  const configured = Boolean(getBrowserClient());

  useEffect(() => {
    void getRealSession().then((s) => {
      if (s && justOAuth) return goNext();
      if (s) setAccount(s.user.email ?? "");
      setChecked(true);
    });
  }, [goNext, justOAuth]);

  async function google() {
    setError(null);
    setBusy(true);
    const r = await signInWithGoogle(`${window.location.origin}/en/login?via=oauth&next=${encodeURIComponent(next)}`);
    if (!r.ok) {
      setError(r.error ?? null);
      setBusy(false);
    }
  }

  const isResults = next.includes("/result");
  const title = isResults ? "Sign in to see\nyour readings again" : "Sign in and\nsee your tarot";
  const art = sceneArt.login?.length ? "login" : "welcome";

  return (
    <main className="night-bg relative flex min-h-dvh flex-col overflow-x-hidden">
      <Stars />
      <div className="auth relative z-[1] mx-auto w-full max-w-md flex-1 px-6 pb-10 pt-7">
        <Link href="/en" className="text-[13px] text-moon/80">← Back to start</Link>
        {!checked ? null : account !== null ? (
          <div className="flex flex-col gap-5">
            <h1 className="big whitespace-pre-line">{title}</h1>
            <p className="small">{account ? `You're signed in as ${account}.` : "You're signed in with your SSOL Wellness House account."}</p>
            <SceneArt map={sceneArt} id={art} className="guide-art fade-up" sizes="320px" />
            <button type="button" className="btn block" onClick={goNext}>Continue with this account</button>
            <button type="button" className="linkish" onClick={() => void signOut().then(() => setAccount(null))}>Use a different account</button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <h1 className="big whitespace-pre-line">{mode === "signup" ? "Create your account" : mode === "reset" ? "Reset your password" : title}</h1>
            {mode === "signin" && <p className="small">Your readings are saved to your account so you can come back anytime.</p>}
            {mode === "signin" && <SceneArt map={sceneArt} id={art} className="guide-art fade-up" sizes="320px" />}
            {mode !== "reset" && (
              <button className="btn block google" type="button" disabled={!configured || busy} onClick={() => void google()}>
                <GoogleMark />
                Continue with Google
              </button>
            )}
            {mode === "signin" && <SignIn busy={busy} setBusy={setBusy} setError={setError} onDone={goNext} onForgot={() => setMode("reset")} />}
            {mode === "signup" && <SignUp busy={busy} setBusy={setBusy} setError={setError} onDone={goNext} />}
            {mode === "reset" && <Reset busy={busy} setBusy={setBusy} setError={setError} onDone={goNext} />}
            {error && <p className="err" role="alert">{error}</p>}
            <p className="text-center text-sm text-cream/80">
              {mode === "signin" ? (
                <>
                  New here?{" "}
                  <button type="button" className="underline" onClick={() => { setError(null); setMode("signup"); }}>Create an account</button>
                </>
              ) : (
                <button type="button" className="underline" onClick={() => { setError(null); setMode("signin"); }}>Back to sign in</button>
              )}
            </p>
          </div>
        )}
      </div>
      <PageFoot locale="en" />
    </main>
  );
}

type FormProps = { busy: boolean; setBusy: (b: boolean) => void; setError: (e: string | null) => void; onDone: () => void };

function SignIn({ busy, setBusy, setError, onDone, onForgot }: FormProps & { onForgot: () => void }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return setError("Please check your email address.");
    if (!pw) return setError("Please enter your password.");
    setBusy(true);
    setError(null);
    const r = await signInWithEmailEn(email.trim(), pw);
    setBusy(false);
    if (r.ok) onDone();
    else setError(r.error ?? null);
  }
  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <input className="auth-input" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="auth-input" type="password" autoComplete="current-password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <button className="btn block ghost" type="submit" disabled={busy}>Sign in with email</button>
      <button type="button" className="linkish" onClick={onForgot}>Forgot your password?</button>
    </form>
  );
}

function SignUp({ busy, setBusy, setError, onDone }: FormProps) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [pw, setPw] = useState("");
  const [agreed, setAgreed] = useState(false);
  async function send() {
    const e = email.trim();
    if (!EMAIL_RE.test(e)) return setError("Please check your email address.");
    setBusy(true);
    setError(null);
    if (!(await emailAvailableEn(e))) {
      setBusy(false);
      return setError("This email is already registered. Please sign in, or reset your password.");
    }
    const r = await sendSignupCodeEn(e, nickname.trim());
    setBusy(false);
    if (r.ok) setSent(true);
    else setError(r.error ?? null);
  }
  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!sent) return setError("Please get a code sent to your email first.");
    if (!code.trim()) return setError("Please enter the code from your email.");
    if (!nickname.trim()) return setError("Please enter a nickname.");
    if (!isPasswordValid(pw)) return setError("Please check the password rules.");
    if (!agreed) return setError(CONSENT_EN.termsMissing);
    setBusy(true);
    setError(null);
    const r = await finishSignupEn({ email: email.trim(), code: code.trim(), password: pw, nickname: nickname.trim().slice(0, 20) });
    setBusy(false);
    if (r.ok) onDone();
    else setError(r.error ?? null);
  }
  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <input className="auth-input" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => { setEmail(e.target.value); setSent(false); setCode(""); }} />
      <button type="button" className="btn block ghost" disabled={busy} onClick={() => void send()}>{sent ? "Send the code again" : "Email me a code"}</button>
      {sent && <p className="small" style={{ margin: 0 }}>We sent a code to {email.trim()}. It may take a minute.</p>}
      <input className="auth-input" inputMode="numeric" autoComplete="one-time-code" placeholder="Code from your email" value={code} onChange={(e) => setCode(e.target.value)} />
      <input className="auth-input" maxLength={20} placeholder="Nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />
      <input className="auth-input" type="password" autoComplete="new-password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <Rules pw={pw} />
      <label className="flex items-start gap-2.5 text-left text-[13px] leading-relaxed text-cream/90">
        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#E7C873]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          {CONSENT_EN.terms.before}
          <Link href="/en/legal#terms" target="_blank" className="underline">{CONSENT_EN.terms.terms}</Link>
          {CONSENT_EN.terms.mid}
          <Link href="/en/legal#privacy" target="_blank" className="underline">{CONSENT_EN.terms.privacy}</Link>
          {CONSENT_EN.terms.after}
        </span>
      </label>
      <button className="btn block" type="submit" disabled={busy}>Create account</button>
    </form>
  );
}

function Reset({ busy, setBusy, setError, onDone }: FormProps) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  async function request(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return setError("Please check your email address.");
    setBusy(true);
    setError(null);
    const r = await requestResetEn(email.trim());
    setBusy(false);
    if (r.ok) setSent(true);
    else setError(r.error ?? null);
  }
  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!isPasswordValid(pw)) return setError("Please check the password rules.");
    setBusy(true);
    setError(null);
    const r = await confirmResetEn(email.trim(), code.trim(), pw);
    setBusy(false);
    if (r.ok) onDone();
    else setError(r.error ?? null);
  }
  return !sent ? (
    <form className="flex flex-col gap-3" onSubmit={request}>
      <input className="auth-input" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn block" type="submit" disabled={busy}>Email me a code</button>
    </form>
  ) : (
    <form className="flex flex-col gap-3" onSubmit={confirm}>
      <p className="small" style={{ margin: 0 }}>We sent a code to {email.trim()}.</p>
      <input className="auth-input" inputMode="numeric" autoComplete="one-time-code" placeholder="Code from your email" value={code} onChange={(e) => setCode(e.target.value)} />
      <input className="auth-input" type="password" autoComplete="new-password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <Rules pw={pw} />
      <button className="btn block" type="submit" disabled={busy}>Save new password</button>
    </form>
  );
}
