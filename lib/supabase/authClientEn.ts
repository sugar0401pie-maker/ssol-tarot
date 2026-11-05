"use client";

// 영문판 로그인(2026-11-05 owner: 외국인에게 카카오·네이버는 띄우지 않는다 — 구글 + 이메일만).
// 같은 계정 체계(공유 auth.users·profiles)를 쓴다. 한국어판(authClient.ts)과 달리 이름·생년월일·휴대폰·주소를 받지 않고
// 닉네임 + 18세 이상·약관 동의만(정책 문서 08). 오류 문구는 영어.
import { getBrowserClient } from "./browser";
import type { AuthResult } from "./authClient";

export function translateAuthErrorEn(message: string): string {
  const known: Record<string, string> = {
    "Invalid login credentials": "The email or password isn't right.",
    "Email not confirmed": "Your email isn't verified yet. Please check your inbox.",
    "Unable to validate email address: invalid format": "Please check the email format.",
    "User already registered": "This email is already registered. Please sign in.",
    "Password should be at least 6 characters": "Your password needs at least 6 characters.",
  };
  return known[message] ?? "We couldn't do that. Please try again in a moment.";
}
const NOT_CONFIGURED = "Sign-in isn't available right now because of a setup error.";
const CODE_ERROR = "That code is wrong or has expired. Please request a new one.";

export async function signInWithEmailEn(email: string, password: string): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { ok: false, error: translateAuthErrorEn(error.message) } : { ok: true };
}

/** 구글 로그인 — Supabase Auth의 Google provider(owner: 이미 사용 가능). 성공하면 구글 화면으로 갔다가 redirectTo로 돌아온다. */
export async function signInWithGoogle(redirectTo?: string): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectTo ?? (typeof window !== "undefined" ? window.location.href.split("#")[0] : undefined) },
  });
  return error ? { ok: false, error: translateAuthErrorEn(error.message) } : { ok: true };
}

/** 이미 가입된 이메일인지(한국어판과 같은 방법). */
export async function emailAvailableEn(email: string): Promise<boolean> {
  const supabase = getBrowserClient();
  if (!supabase) return true;
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  return !!error;
}

export async function sendSignupCodeEn(email: string, nickname: string): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, data: { display_name: nickname, signup_locale: "en" } } });
  return error ? { ok: false, error: translateAuthErrorEn(error.message) } : { ok: true };
}

/** 가입 마무리: 코드 확인 → 비밀번호 → profiles(닉네임·약관 동의 시각). 바뀐 행 수까지 확인(한국어판과 같은 이유). */
export async function finishSignupEn(p: { email: string; code: string; password: string; nickname: string }): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };
  const { error: vErr } = await supabase.auth.verifyOtp({ email: p.email, token: p.code, type: "email" });
  if (vErr) return { ok: false, error: /expired|invalid/i.test(vErr.message) ? CODE_ERROR : translateAuthErrorEn(vErr.message) };
  const { error: pwErr } = await supabase.auth.updateUser({ password: p.password });
  if (pwErr) return { ok: false, error: translateAuthErrorEn(pwErr.message) };
  const { data: s } = await supabase.auth.getSession();
  const userId = s.session?.user.id;
  if (!userId) return { ok: false, error: "Your session expired. Please start again." };
  const now = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("profiles")
    .update({ display_name: p.nickname, nickname: p.nickname, terms_agreed_at: now })
    .eq("user_id", userId)
    .select("user_id");
  if (error || !rows || rows.length === 0) return { ok: false, error: "Your account was created, but we couldn't save your details. Please refresh and sign in again." };
  return { ok: true };
}

export async function requestResetEn(email: string): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  return error ? { ok: false, error: translateAuthErrorEn(error.message) } : { ok: true };
}

export async function confirmResetEn(email: string, code: string, password: string): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };
  const { error: vErr } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
  if (vErr) return { ok: false, error: /expired|invalid/i.test(vErr.message) ? CODE_ERROR : translateAuthErrorEn(vErr.message) };
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { ok: false, error: translateAuthErrorEn(error.message) } : { ok: true };
}
