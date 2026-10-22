"use client";

// 로그인·회원가입 화면 — 쏠 아스트로 하우스 components/auth/AuthStep.tsx를 그대로 옮겼다(2026-10-21 owner 요청).
// 바꾼 것: 문구 DB(useCopy) 대신 아스트로 기본 문구를 그대로 적음, 약관 링크는 이 사이트 /legal, 모양은 app/auth.css(.auth).
// (원문 설명) 카카오·네이버·이메일. 쏘웰라·디저트 테스트와 같은 계정이고,
// 그쪽에서 이미 로그인했다면 쿠키가 공유돼 이 화면은 건너뛴다.
// 가입은 이 화면 안에서 끝난다(2026-10-08 owner 요청) — 쏘웰라 가입 화면과 같은 절차·같은 저장 칸:
// 이름·닉네임·생년월일 → 이메일 인증번호 → 휴대전화·주소(선택) → 비밀번호(8자·대문자·특수문자) → 약관 동의 → 가입 완료.
import { useEffect, useRef, useState } from "react";
import { openAddressSearch } from "@/lib/address/daumPostcode";
import { isPasswordValid, passwordChecks } from "@/lib/auth/password";
import { PRIVACY_URL, SENSITIVE_URL, TERMS_URL } from "@/lib/legal/urls";
import { getBrowserClient, getRealSession, isRealSession } from "@/lib/supabase/browser";
import {
  checkEmailAvailable, confirmPasswordReset, finishSignup, requestPasswordReset, sendSignupOtp, signInWithEmail, signInWithOAuth,
  verifySignupOtp,
} from "@/lib/supabase/authClient";

/** 한국어 입력(조합) 중 Enter가 폼 제출로 넘어가지 않게(CLAUDE.md 5: isComposing 중 Enter는 전송이 아님) */
function blockImeEnter(e: React.KeyboardEvent<HTMLFormElement>) {
  if (e.key === "Enter" && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault();
}

// 프로토타입 입력칸·버튼 모양(input[type=text]·.btn block·.linkish)을 그대로 쓴다
const field = "auth-input";
const primary = "btn block";
const linkBtn = "linkish";

type Mode = "signin" | "signup" | "reset";

function PasswordRules({ pw }: { pw: string }) {
  const c = passwordChecks(pw);
  const item = (ok: boolean, label: string) => (
    <li className={ok ? "text-cream" : "text-cream/50"}>
      {ok ? "●" : "○"} {label}
    </li>
  );
  return (
    <ul className="flex flex-col gap-0.5 text-xs">
      {item(c.length, "8자 이상")}
      {item(c.upper, "대문자 1자 이상")}
      {item(c.special, "특수문자 1자 이상")}
    </ul>
  );
}

export default function AuthStep({
  onSignedIn,
  beforeRedirect,
  title,
  subtitle,
  prefill,
  initialMode = "signin",
  oauthRedirect,
  belowButtons,
  art,
  initialError,
  start = false,
  onBack,
}: {
  /** [결과로 돌아가기](프로토타입 #btn-login-back — 저장·쏘웰라·결제 후 가입에서 들어온 로그인 화면) */
  onBack?: () => void;
  /** 테스트를 시작하는 로그인 화면(패키지 v3 2_login): 버튼이 "~로 시작하기", 카카오는 "5초만에 빠르게 카카오로 시작하기" */
  start?: boolean;
  /** 처음부터 보여 줄 오류(카카오·네이버 로그인에서 돌아왔는데 실패한 경우 그 이유) */
  initialError?: string | null;
  /** 제목·안내말 아래 안내 그림(화면별 프로세스 #6 로그인) */
  art?: React.ReactNode;
  onSignedIn: () => void;
  /** 로그인 버튼 세 개 바로 아래에 둘 것(/login의 '로그인 없이 테스트하기') */
  belowButtons?: React.ReactNode;
  /** 처음 보여 줄 화면(결제 후 가입 권유는 'signup') */
  initialMode?: "signin" | "signup";
  /** 카카오·네이버 로그인 뒤 돌아올 주소(없으면 지금 주소) */
  oauthRedirect?: string;
  beforeRedirect?: () => void;
  title?: string;
  /** 제목 아래 작은 글(없으면 '같은 계정' 안내) */
  subtitle?: string;
  /** 테스트에서 이미 받은 값(가입 화면에 미리 채움) */
  prefill?: { birthDate?: string; nickname?: string };
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  // 프로토타입 #scr-login: [카카오로 계속하기][네이버로 계속하기][이메일로 계속하기] — 이메일 칸은 누른 뒤에 연다
  const [emailOpen, setEmailOpen] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  // 가입하려던 이메일이 이미 있으면 비밀번호 찾기로 보내면서 그 이메일을 채워 둔다(owner 2026-10-10)
  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const configured = !!getBrowserClient();
  // 가입·비밀번호 재설정은 인증번호 확인 순간 로그인 상태가 되지만, 비밀번호·정보 저장이 끝날 때까지 다음 화면으로 넘어가지 않는다.
  const holdSignIn = useRef(false);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (isRealSession(session) && !holdSignIn.current) onSignedIn();
    });
    // 다른 탭(쏘웰라 등)에서 로그인하고 돌아온 경우
    const recheck = () => {
      if (holdSignIn.current) return;
      void getRealSession().then((s) => s && onSignedIn());
    };
    window.addEventListener("focus", recheck);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("focus", recheck);
    };
  }, [onSignedIn]);

  async function oauth(provider: "kakao" | "naver") {
    setError(null);
    beforeRedirect?.(); // 카카오·네이버 화면으로 갔다 돌아와도 진행 중인 테스트를 이어가게
    const r = await signInWithOAuth(provider, oauthRedirect);
    if (!r.ok) setError(r.error ?? "로그인하지 못했어요.");
  }

  const go = (m: Mode) => {
    setError(null);
    setMode(m);
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="big whitespace-pre-line break-keep" tabIndex={-1}>
        {mode === "signup" ? "계정 만들기" : mode === "reset" ? "비밀번호 찾기" : title ?? "결과를 저장하고 보려면 로그인해 주세요."}
      </h1>
      {/* 안내말은 문장마다 줄을 바꿔 보여 준다(owner 2026-10-10 — DB 문장은 그대로, 화면에서만 줄바꿈) */}
      <p className="small whitespace-pre-line">
        {(mode !== "signin" ? "쏠 웰니스 하우스(쏘웰라·디저트·아스트로 테스트)와 같은 계정이에요. 한 번 가입하면 모든 곳에서 쓸 수 있어요." : subtitle ?? "한 번 로그인하면 결과를 언제든 다시 볼 수 있어요.").replace(/([.!?])\s+/g, "$1\n")}
      </p>
      {mode === "signin" && art}
      {!configured && <p className="err">설정 오류로 로그인을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.</p>}

      {mode !== "reset" && (
        <div className="stack" style={{ marginTop: 0 }}>
          <button className="btn block kakao" type="button" disabled={!configured} onClick={() => oauth("kakao")}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#191919" d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.86 5.35 4.67 6.77l-.95 3.48c-.08.3.26.54.52.37l4.15-2.75c.53.07 1.07.11 1.61.11 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
            </svg>
            {mode === "signup" ? "회원가입 없이 10초만에 카카오로 로그인하기" : start ? "5초만에 빠르게 카카오로 시작하기" : "카카오로 계속하기"}
          </button>
          <button className="btn block naver" type="button" disabled={!configured} onClick={() => oauth("naver")}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path fill="#fff" d="M9.5 0v7.2L4.6 0H0v14h4.5V6.8L9.4 14H14V0z" />
            </svg>
            {mode === "signup" || !start ? "네이버로 계속하기" : "네이버로 시작하기"}
          </button>
          {mode === "signin" && !emailOpen && (
            <button className="btn block ghost" type="button" onClick={() => setEmailOpen(true)}>
              {start ? "이메일로 시작하기" : "이메일로 계속하기"}
            </button>
          )}
        </div>
      )}

      {mode === "signin" && !emailOpen && error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      {mode === "signin" && emailOpen && <SignInForm configured={configured} error={error} setError={setError} onForgot={() => go("reset")} />}
      {mode === "signup" && (
        <SignUpForm
          configured={configured}
          error={error}
          setError={setError}
          prefill={prefill}
          onDuplicate={(email) => {
            setResetEmail(email);
            go("reset");
          }}
          onStart={() => (holdSignIn.current = true)}
          onDone={(ok) => {
            holdSignIn.current = false;
            if (ok) onSignedIn();
          }}
        />
      )}
      {mode === "reset" && (
        <ResetForm
          initialEmail={resetEmail ?? undefined}
          configured={configured}
          error={error}
          setError={setError}
          onStart={() => (holdSignIn.current = true)}
          onDone={(ok) => {
            holdSignIn.current = false;
            if (ok) onSignedIn(); // 새 비밀번호로 로그인된 상태
          }}
        />
      )}

      <p className="text-center text-sm text-cream/80">
        {mode === "signin" ? (
          <>
            아직 계정이 없으신가요?{" "}
            <button type="button" className="underline" onClick={() => go("signup")}>
              회원가입하기
            </button>
          </>
        ) : (
          <button type="button" className="underline" onClick={() => go("signin")}>
            로그인 화면으로
          </button>
        )}
      </p>
      {mode === "signin" && belowButtons}
      {mode === "signin" && onBack && (
        <div className="footer-ctrl" style={{ justifyContent: "center" }}>
          <button type="button" className="linkish" onClick={onBack}>
            결과로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
}

type FormProps = { configured: boolean; error: string | null; setError: (e: string | null) => void };

function SignInForm({ configured, error, setError, onForgot }: FormProps & { onForgot: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await signInWithEmail(email.trim(), password);
    setBusy(false);
    if (!r.ok) setError(r.error ?? "로그인하지 못했어요.");
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={submit} onKeyDown={blockImeEnter}>
      <input className={field} type="email" autoComplete="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="이메일" />
      <input className={field} type="password" autoComplete="current-password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="비밀번호" />
      {error && <p className="text-sm text-cream">{error}</p>}
      <button type="submit" className={primary} disabled={busy || !configured}>
        {busy ? "로그인 중…" : "이메일로 로그인"}
      </button>
      <button type="button" className={`${linkBtn} self-center`} onClick={onForgot}>
        비밀번호를 잊으셨나요?
      </button>
    </form>
  );
}

function SignUpForm({
  configured, error, setError, prefill, onDuplicate, onStart, onDone,
}: FormProps & { prefill?: { birthDate?: string; nickname?: string }; onDuplicate: (email: string) => void; onStart: () => void; onDone: (ok: boolean) => void }) {
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState(prefill?.nickname ?? "");
  const [birthDate, setBirthDate] = useState(prefill?.birthDate ?? "");
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [password, setPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeSensitive, setAgreeSensitive] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function sendOtp() {
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    const avail = await checkEmailAvailable(email.trim());
    if (!avail.available) {
      // 이미 있는 계정: 가입을 막고 비밀번호 찾기로 안내(이메일을 채워서). 문구는 ResetForm이 보여 준다.
      setBusy(false);
      onDuplicate(email.trim());
      return;
    }
    const r = await sendSignupOtp(email.trim(), { display_name: name.trim(), birth_date: birthDate });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "인증번호를 보내지 못했어요.");
    setOtpSent(true);
  }

  async function searchAddress() {
    try {
      const r = await openAddressSearch();
      setAddress(`(${r.zonecode}) ${r.address}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "주소 검색을 열지 못했어요.");
    }
  }

  const ready = name.trim() && birthDate && otpSent && otp.trim() && isPasswordValid(password) && agreeTerms && agreeSensitive;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) {
      if (!ready) setError("필수 항목(이름·생년월일·이메일 인증·비밀번호·필수 동의)을 모두 채워 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    onStart();
    const v = await verifySignupOtp(email.trim(), otp.trim());
    if (!v.ok) {
      setBusy(false);
      onDone(false);
      return setError(v.error ?? "인증하지 못했어요.");
    }
    const f = await finishSignup({
      password,
      displayName: name.trim(),
      birthDate,
      nickname: nickname.trim(),
      phone: phone.trim(),
      address: addressDetail.trim() ? `${address} ${addressDetail.trim()}` : address,
      marketingConsent: agreeMarketing,
    });
    setBusy(false);
    if (!f.ok) {
      onDone(false);
      return setError(f.error ?? "가입을 마치지 못했어요.");
    }
    onDone(true);
  }

  const check = "mt-0.5 h-4 w-4 shrink-0";
  return (
    <form className="flex flex-col gap-2" onSubmit={submit} onKeyDown={blockImeEnter}>
      <input className={field} placeholder="이름 (실명)" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-label="이름" />
      <input className={field} placeholder="닉네임 (선택, 비우면 이름이 표시돼요)" value={nickname} onChange={(e) => setNickname(e.target.value)} aria-label="닉네임" />
      <label className="flex flex-col gap-1 text-xs text-cream/80">
        생년월일
        <input className={field} type="date" value={birthDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setBirthDate(e.target.value)} />
      </label>
      <input
        className={field}
        type="email"
        autoComplete="email"
        placeholder="이메일"
        value={email}
        aria-label="이메일"
        onChange={(e) => {
          setEmail(e.target.value);
          if (otpSent) {
            setOtpSent(false); // 이메일이 바뀌면 받은 인증번호는 쓸 수 없다
            setOtp("");
          }
        }}
      />
      {!otpSent ? (
        <button type="button" className="w-full rounded-full border border-gold px-6 py-3 text-gold disabled:opacity-40" disabled={!email.trim() || busy || !configured} onClick={() => void sendOtp()}>
          {busy ? "보내는 중…" : "인증번호 받기"}
        </button>
      ) : (
        <div className="flex flex-col gap-1.5 rounded-xl border border-cream/30 p-3">
          <p className="text-xs text-cream/80">{email}로 인증번호를 보내드렸어요.</p>
          <input className={`${field} tracking-widest`} inputMode="numeric" placeholder="인증번호" value={otp} onChange={(e) => setOtp(e.target.value)} aria-label="인증번호" />
          <button type="button" className={`${linkBtn} self-start text-xs`} disabled={busy} onClick={() => void sendOtp()}>
            인증번호 다시 받기
          </button>
        </div>
      )}
      <input className={field} type="tel" autoComplete="tel" placeholder="휴대전화번호 (선택)" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="휴대전화번호" />
      <div className="flex gap-1.5">
        <input className={`${field} min-w-0 flex-1`} readOnly placeholder="주소 (선택)" value={address} aria-label="주소" />
        <button type="button" className="shrink-0 rounded-xl border border-cream/40 px-3 text-sm text-cream" onClick={() => void searchAddress()}>
          주소 검색
        </button>
      </div>
      {address && <input className={field} placeholder="상세주소 (동/호수 등)" value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} aria-label="상세주소" />}
      <input className={field} type="password" autoComplete="new-password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="비밀번호" />
      <PasswordRules pw={password} />

      <label className="mt-1 flex items-start gap-2 text-xs leading-5 text-cream/90">
        <input type="checkbox" className={check} checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />
        <span>
          <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="underline">개인정보 처리방침</a>과{" "}
          <a href={TERMS_URL} target="_blank" rel="noreferrer" className="underline">이용약관</a>, 일부 개인 데이터의 국외이전에 동의합니다. (필수)
        </span>
      </label>
      <label className="flex items-start gap-2 text-xs leading-5 text-cream/90">
        <input type="checkbox" className={check} checked={agreeSensitive} onChange={(e) => setAgreeSensitive(e.target.checked)} />
        <span>
          테스트 응답 등 <a href={SENSITIVE_URL} target="_blank" rel="noreferrer" className="underline">민감정보의 수집·이용</a>에 동의합니다. (필수)
        </span>
      </label>
      <label className="flex items-start gap-2 text-xs leading-5 text-cream/90">
        <input type="checkbox" className={check} checked={agreeMarketing} onChange={(e) => setAgreeMarketing(e.target.checked)} />
        <span>(선택) 마케팅 정보 활용에 동의합니다.</span>
      </label>

      {error && <p className="text-sm text-cream">{error}</p>}
      <button type="submit" className={primary} disabled={busy || !configured}>
        {busy ? "가입하는 중…" : "가입 완료"}
      </button>
    </form>
  );
}

function ResetForm({ configured, error, setError, onStart, onDone, initialEmail }: FormProps & { onStart: () => void; onDone: (ok: boolean) => void; initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    const r = await requestPasswordReset(email.trim());
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "인증번호를 보내지 못했어요.");
    setSent(true);
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !isPasswordValid(password) || busy) return;
    setBusy(true);
    setError(null);
    onStart();
    const r = await confirmPasswordReset(email.trim(), code.trim(), password);
    setBusy(false);
    if (!r.ok) {
      onDone(false);
      return setError(r.error ?? "비밀번호를 바꾸지 못했어요.");
    }
    setDone(true);
  }

  if (done)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-cream">비밀번호를 바꿨어요. 새 비밀번호로 이어갈게요.</p>
        <button type="button" className={primary} onClick={() => onDone(true)}>
          계속하기
        </button>
      </div>
    );

  return !sent ? (
    <form className="flex flex-col gap-2" onSubmit={request} onKeyDown={blockImeEnter}>
      {initialEmail && (
        <p className="rounded-2xl border border-gold px-4 py-3 text-sm leading-relaxed text-cream">
          ‘{initialEmail}’ 이메일로 이미 가입된 아이디가 있는 것 같아요. 비밀번호가 기억나지 않으면 여기서 새로 정할 수 있어요.
        </p>
      )}
      <p className="text-sm text-cream/80">가입한 이메일로 인증번호를 보내드려요. 아이디는 이메일 주소예요 — 이메일이 기억나지 않으면 contact@ssolwellness.com으로 문의해 주세요.</p>
      <input className={field} type="email" autoComplete="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="이메일" />
      {error && <p className="text-sm text-cream">{error}</p>}
      <button type="submit" className={primary} disabled={!email.trim() || busy || !configured}>
        {busy ? "보내는 중…" : "인증번호 받기"}
      </button>
    </form>
  ) : (
    <form className="flex flex-col gap-2" onSubmit={confirm} onKeyDown={blockImeEnter}>
      <p className="text-xs text-cream/80">{email}로 인증번호를 보내드렸어요.</p>
      <input className={`${field} tracking-widest`} inputMode="numeric" placeholder="인증번호" value={code} onChange={(e) => setCode(e.target.value)} aria-label="인증번호" />
      <input className={field} type="password" autoComplete="new-password" placeholder="새 비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="새 비밀번호" />
      <PasswordRules pw={password} />
      {error && <p className="text-sm text-cream">{error}</p>}
      <button type="submit" className={primary} disabled={!code.trim() || !isPasswordValid(password) || busy}>
        {busy ? "바꾸는 중…" : "비밀번호 바꾸기"}
      </button>
    </form>
  );
}
