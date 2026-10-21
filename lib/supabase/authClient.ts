"use client";

// 로그인·회원가입·비밀번호 재설정(이메일·카카오·네이버). 쏠 아스트로 하우스 lib/supabase/authClient.ts를 그대로 옮겼다
// (2026-10-21 owner 요청 "아스트로 로그인 화면처럼"). 쏘웰라·아스트로와 같은 provider 설정·같은 가입 절차 —
// 계정이 같으므로(공유 auth.users·profiles) 어느 사이트에서 가입해도 같은 결과가 나와야 한다.
// 가입 마지막 단계는 본인 계정의 profiles 행을 본인 권한으로 채운다(쏘웰라·아스트로 가입과 같은 칸, 표 구조는 건드리지 않음).
// 쏘웰라 쪽 가입 절차·저장 칸이 바뀌면 여기도 같이 바꾼다.
import { getBrowserClient } from "./browser";

export type AuthResult = { ok: boolean; error?: string };

function translateAuthError(message: string): string {
  const known: Record<string, string> = {
    "Invalid login credentials": "이메일 또는 비밀번호가 올바르지 않아요.",
    "Email not confirmed": "이메일 인증이 아직 완료되지 않았어요. 메일함을 확인해 주세요.",
    "Unable to validate email address: invalid format": "이메일 형식이 올바르지 않아요.",
    "User already registered": "이미 가입된 이메일이에요. 로그인해 주세요.",
    "Password should be at least 6 characters": "비밀번호는 6자 이상이어야 해요.",
  };
  return known[message] ?? "처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

const NOT_CONFIGURED = "설정 오류로 로그인을 사용할 수 없어요.";
const CODE_ERROR = "인증번호가 올바르지 않거나 만료됐어요. 다시 받아 주세요.";

/**
 * 이미 가입된 이메일인지(쏘웰라와 같은 방법): shouldCreateUser:false로 로그인 코드를 요청해 에러가 없으면 이미 있는 계정.
 * 관리자 키 없이 브라우저에서 할 수 있는 표준 방법이다(있는 계정에는 로그인 코드가 함께 발송되지만 쓰지 않는다).
 */
export async function checkEmailAvailable(email: string): Promise<{ available: boolean }> {
  const supabase = getBrowserClient();
  if (!supabase) return { available: true }; // 설정 오류면 막지 않고 다음 단계에서 다시 확인
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  return { available: !!error };
}

/** 가입 1단계: 이메일로 인증번호 발송(이름·생년월일은 user_metadata로 함께). */
export async function sendSignupOtp(email: string, meta: { display_name: string; birth_date: string }): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, data: meta } });
  return error ? { ok: false, error: translateAuthError(error.message) } : { ok: true };
}

/** 가입 2단계: 인증번호 확인(성공하면 로그인 상태가 된다). */
export async function verifySignupOtp(email: string, token: string): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (!error) return { ok: true };
  return { ok: false, error: /expired|invalid/i.test(error.message) ? CODE_ERROR : translateAuthError(error.message) };
}

/**
 * 가입 3단계: 비밀번호 설정 + profiles에 이름·생년월일·약관 동의 시각 저장(쏘웰라 finishSignup과 같은 칸).
 * 바뀐 행 수를 확인한다 — 권한 문제로 0행만 바뀌어도 에러가 안 나는 경우를 놓치지 않으려고(쏘웰라 2026-09-24 사건).
 */
export async function finishSignup(params: {
  password: string;
  displayName: string;
  birthDate: string;
  nickname?: string;
  phone?: string;
  address?: string;
  marketingConsent?: boolean;
}): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { ok: false, error: "세션이 만료됐어요. 처음부터 다시 시도해 주세요." };

  const { error: pwError } = await supabase.auth.updateUser({ password: params.password });
  if (pwError) return { ok: false, error: translateAuthError(pwError.message) };

  const now = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("profiles")
    .update({
      display_name: params.displayName,
      birth_date: params.birthDate,
      terms_agreed_at: now,
      sensitive_data_agreed_at: now,
      nickname: params.nickname || null,
      phone: params.phone || null,
      address: params.address || null,
      marketing_consent: params.marketingConsent ?? false,
      marketing_consent_at: params.marketingConsent ? now : null,
    })
    .eq("user_id", userId)
    .select("user_id");
  if (error || !rows || rows.length === 0) {
    return { ok: false, error: "가입은 됐지만 정보 저장에 실패했어요. 새로고침 후 로그인해서 다시 시도해 주세요." };
  }
  return { ok: true };
}

/** 비밀번호 재설정 1단계: 이메일로 인증번호(쏘웰라와 같은 숫자 코드 방식). */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  return error ? { ok: false, error: translateAuthError(error.message) } : { ok: true };
}

/** 비밀번호 재설정 2단계: 인증번호 확인 후 새 비밀번호. */
export async function confirmPasswordReset(email: string, token: string, newPassword: string): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };
  const { error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: "recovery" });
  if (verifyError) return { ok: false, error: /expired|invalid/i.test(verifyError.message) ? CODE_ERROR : translateAuthError(verifyError.message) };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return error ? { ok: false, error: translateAuthError(error.message) } : { ok: true };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: "설정 오류로 로그인을 사용할 수 없어요." };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { ok: false, error: translateAuthError(error.message) } : { ok: true };
}

// 네이버는 Supabase 커스텀 OAuth provider(식별자 "custom:naver"), 카카오는 기본 provider.
// 카카오 동의항목은 닉네임·이메일만(쏘웰라와 같은 앱 설정).
const NAVER_PROVIDER_ID = "custom:naver";
const KAKAO_SCOPES = "profile_nickname account_email";

/** 성공하면 카카오/네이버 로그인 화면으로 이동했다가 지금 주소로 돌아온다(Supabase Redirect URLs에 이 도메인 등록 필요). */
export async function signInWithOAuth(provider: "kakao" | "naver", redirectTo?: string): Promise<AuthResult> {
  const supabase = getBrowserClient();
  if (!supabase) return { ok: false, error: "설정 오류로 로그인을 사용할 수 없어요." };
  const { error } = await supabase.auth.signInWithOAuth({
    provider: (provider === "naver" ? NAVER_PROVIDER_ID : provider) as Parameters<typeof supabase.auth.signInWithOAuth>[0]["provider"],
    options: {
      redirectTo: redirectTo ?? (typeof window !== "undefined" ? window.location.href.split("#")[0] : undefined),
      ...(provider === "kakao" ? { scopes: KAKAO_SCOPES } : {}),
    },
  });
  return error ? { ok: false, error: translateAuthError(error.message) } : { ok: true };
}

export async function signOut(): Promise<void> {
  await getBrowserClient()?.auth.signOut();
}
