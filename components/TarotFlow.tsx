"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { initialState, next, type FlowAction, type FlowStateBase } from "@/lib/tarot/flow.js";
import { api, saveKey, ApiError, type PickResponse } from "@/lib/client/api";
import { fill } from "@/lib/client/text";
import { CardBack, CardFace, CardCaption, FrameCorners, Stars } from "./Cards";
import { SceneArt } from "./SceneArt";
import { MysticOrbit, RotatingLine } from "./Mystic";
import PageFoot from "./PageFoot";
import { STEP_PATH, stepFromPath, canFollow, entryStep, type Step } from "@/lib/client/steps";
import { getRealSession } from "@/lib/supabase/browser";
import type { SceneArtMap, SceneId } from "@/lib/client/sceneArt";
import { WaitNotice } from "./WaitNotice";
import type { Friend } from "./IntroCardSpin";
import { IntroCardSpin } from "./IntroCardSpin";
import { DrawBoard } from "./DrawBoard";
import { SafetyScreen } from "./SafetyScreen";

// 시작 흐름 → 셔플 → 뽑기 → (대기). 화면 이동 규칙은 패키지 원본 상태 기계(lib/tarot/flow.js의 next)를 그대로 쓴다.
// 결과는 /result/[id]로 넘어간다(이 앱은 서브도메인이라 루트가 테스트 시작).

export type Copy = (typeof import("@/data/tarot_data.json"))["copy"];
export type FlowProps = { copy: Omit<Copy, "cta_chat">; pickCount: number; friends: Friend[]; sceneArt?: SceneArtMap; initialStep?: Step | null };

type FlowState = FlowStateBase;
type Action = FlowAction;

const MIN_WAIT_MS = 3000; // 카드를 다 고른 뒤 대기 화면 최소 시간(owner 2026-10-21)
const SHUFFLE_MIN_MS = 6000; // 스펙 7.4는 최소 3초. 3초마다 바뀌는 안내(owner 2026-10-20)가 두 줄은 보이도록 6초. 움직임 줄이기에서도 유지
const AGAIN_KEY = "ssol_tarot_again";

const NO_SCENE_ART: SceneArtMap = {};
// 섞기·뽑기·다 뽑음·대기는 아래에 누를 것(버튼·22장 보드)이 많아서, 그림 높이를 화면의 약 1/4로 줄여(가운데 기준으로 위아래만 잘림)
// 휴대폰 한 화면 안에서 스크롤 없이 진행할 수 있게 한다. 다른 장면은 그림 비율 그대로.
const COMPACT_SCENES = new Set<string>(["reveal", "loading"]);
// 섞기·뽑기 화면에는 장면 그림을 넣지 않는다(owner 2026-10-21) — 그 그림은 결과 6~8쪽 맨 위에서 쓴다(RESULT_PAGE_SCENE).
const NO_ART_SCENES = new Set<string>(["shuffle", "draw"]);
// 금선 테두리가 있는 화면은 그림을 테두리 안쪽 맨 위에 둔다(Framed의 art).
const FRAMED_SCENES = new Set<string>(["welcome", "experience", "first_time", "worry"]);

export default function TarotFlow({ copy, pickCount, friends, sceneArt = NO_SCENE_ART, initialStep = null }: FlowProps) {
  const router = useRouter();
  const pathname = usePathname();
  const flowData = useMemo(() => ({ copy, deck: { pick_count: pickCount } }), [copy, pickCount]);
  const [state, setState] = useState<FlowState>(() => initialState());
  const [session, setSession] = useState<{ id: string; key: string } | null>(null);
  const sessionPromise = useRef<Promise<{ id: string; key: string }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [netError, setNetError] = useState<string | null>(null);
  const [shuffleId, setShuffleId] = useState<string | null>(null);

  const go = useCallback(
    (action: Action) => {
      setState((s) => {
        try {
          return next(s, action, flowData) as FlowState;
        } catch {
          return s; // 허용되지 않는 이동(연타 등)은 무시
        }
      });
    },
    [flowData],
  );

  // "다른 고민으로 다시 해 보기": 닉네임·경험은 그대로, 고민 쓰기부터 새 세션으로.
  useEffect(() => {
    let again: { nickname: string; experience: string } | null = null;
    try {
      const raw = sessionStorage.getItem(AGAIN_KEY);
      if (raw) again = JSON.parse(raw);
      sessionStorage.removeItem(AGAIN_KEY);
    } catch {
      /* 무시 */
    }
    if (again?.nickname) {
      const a = again;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장된 값으로 한 번만 복원
      setState({ ...initialState(), screen: "worry", nickname: a.nickname, experience: a.experience });
      startSession(a.nickname, a.experience);
    }
  }, []);

  // 로그인 화면에서 [타로 보기]로 돌아온 경우(/?start=1): 로그인돼 있으면 바로 시작(주소는 아래 동기화가 /welcome으로).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("start") !== "1") return;
    void getRealSession().then((s) => {
      window.history.replaceState(null, "", "/");
      if (s) go({ type: "START" });
    });
  }, [go]);

  // ---------- 화면마다 자기 주소(owner 2026-10-21) ----------
  // 주소로 바로 들어온 경우(/welcome·/draw 새로고침 등): 고민·카드는 브라우저에 저장해 두지 않으므로 환영 화면부터 다시.
  // 로그인 전이면 로그인 화면을 거친다(로그인해야 이용).
  const [booting, setBooting] = useState(() => entryStep(initialStep) !== "intro");
  useEffect(() => {
    if (!booting) return;
    void getRealSession().then((s) => {
      if (!s) return router.replace(`/login?next=${encodeURIComponent(STEP_PATH.welcome)}`);
      setState({ ...initialState(), screen: "welcome" } as FlowState);
      setBooting(false);
    });
  }, [booting, router]);
  // 화면이 바뀌면 주소를 그 화면 것으로(pushState — 뒤로 가기가 이전 화면 주소로 간다). 결과 화면은 /result/{id}로 따로 이동.
  const screenRef = useRef(state.screen);
  screenRef.current = state.screen;
  useEffect(() => {
    if (booting) return;
    const path = STEP_PATH[state.screen as Step];
    if (path && window.location.pathname !== path) window.history.pushState(null, "", path);
  }, [state.screen, booting]);
  // 뒤로/앞으로 가기로 주소가 바뀐 경우: 고민을 내기 전 단계 안에서 뒤로 가는 것만 따라가고, 그 밖에는 지금 화면 주소로 되돌린다.
  useEffect(() => {
    if (booting) return;
    const cur = screenRef.current as Step;
    const to = stepFromPath(pathname);
    if (!to || to === cur || !STEP_PATH[cur]) return;
    if (canFollow(cur, to)) setState((st) => (to === "intro" ? initialState() : { ...st, screen: to }) as FlowState);
    else window.history.pushState(null, "", STEP_PATH[cur]);
    // 주소가 바뀔 때만 본다(화면 상태가 먼저 바뀐 경우까지 보면 방금 누른 이동을 되돌려 버린다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function startSession(nickname: string, experience: string) {
    const p = api<{ id: string; key: string }>("/api/tarot/session", { body: { nickname, experience } }).then((s) => {
      saveKey(s.id, s.key);
      setSession(s);
      try {
        sessionStorage.setItem("ssol_tarot_profile", JSON.stringify({ nickname, experience }));
      } catch {
        /* 무시 */
      }
      return s;
    });
    sessionPromise.current = p;
    p.catch(() => {
      sessionPromise.current = null;
    });
  }

  async function ensureSession() {
    if (session) return session;
    if (!sessionPromise.current && state.nickname) startSession(state.nickname, state.experience ?? "returning");
    return sessionPromise.current!;
  }

  // 셔플·뽑기·대기 중에 AI 분류가 urgent를 돌려주면 그 자리에서 안전 안내로(flow.js AI_URGENT).
  useEffect(() => {
    if (!session || !["shuffle", "draw", "reveal", "loading"].includes(state.screen)) return;
    let stop = false;
    const t = setInterval(async () => {
      try {
        const st = await api<{ urgent: boolean }>(`/api/tarot/session/${session.id}/status`, { key: session.key });
        if (!stop && st.urgent) go({ type: "AI_URGENT" });
      } catch {
        /* 다음 주기에 다시 */
      }
    }, 2000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [session, state.screen, go]);

  const nickname = state.nickname ?? "";

  async function submitWorry(text: string, skip: boolean) {
    if (!skip) {
      // 길이 검사는 flow.js 규칙을 먼저 적용(10자 미만이면 인라인 안내).
      const probe = next(state, { type: "SUBMIT_WORRY", text, localUrgent: false }, flowData) as FlowState;
      if (probe.error) {
        setState(probe);
        return;
      }
    }
    setBusy(true);
    setNetError(null);
    try {
      const s = await ensureSession();
      const r = await api<{ urgent: boolean }>(`/api/tarot/session/${s.id}/worry`, { key: s.key, body: skip ? { skip: true } : { text } });
      go(skip ? { type: "SKIP_WORRY" } : { type: "SUBMIT_WORRY", text, localUrgent: r.urgent });
    } catch (e) {
      setNetError(e instanceof ApiError ? e.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  // [결과 보기]: 결과가 이미 준비됐어도 신비한 대기 화면(카드·별이 도는 연출 + 안내 문구)을 최소 3초는 보여 준다
  // (owner 2026-10-21 "카드 고르고 나서 돌아가는 건 3초 정도"). 안전 안내(urgent)는 기다리지 않고 바로.
  const loadingSince = useRef(0);
  function seeResult() {
    if (!session) return;
    loadingSince.current = Date.now();
    go({ type: "SEE_RESULT", ready: false });
  }

  // 대기 화면: 0.5초 간격으로 결과 준비 확인, 준비되면 3초를 채운 뒤 결과로
  useEffect(() => {
    if (state.screen !== "loading" || !session) return;
    if (!loadingSince.current) loadingSince.current = Date.now();
    let stop = false;
    let busy = false;
    const check = async () => {
      if (stop || busy) return;
      busy = true;
      try {
        const r = await api<{ status: string }>(`/api/tarot/session/${session.id}/result`, { key: session.key });
        if (stop) return;
        if (r.status === "safety") return go({ type: "AI_URGENT" });
        if (r.status === "ready") {
          stop = true;
          const left = MIN_WAIT_MS - (Date.now() - loadingSince.current);
          setTimeout(() => router.push(`/result/${session.id}`), Math.max(0, left));
        }
      } catch {
        /* 다음 주기 */
      } finally {
        busy = false;
      }
    };
    void check();
    const t = setInterval(check, 500);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [state.screen, session, go, router]);

  const screen = state.screen;

  // 주소로 바로 들어와 로그인 확인 중 — 첫 화면이 잠깐 보였다 바뀌지 않게 빈 밤 화면만
  if (booting) return <main className="night-bg min-h-dvh" />;
  if (screen === "safety") return <SafetyScreen copy={copy} />;

  return (
    <main className="night-bg relative flex min-h-dvh flex-col overflow-x-hidden">
      <Stars />
      {/* 장면 맨 위 그림(그림 파일이 있는 장면만). 장면이 바뀔 때마다 다시 고름 */}
      {!FRAMED_SCENES.has(screen) && !NO_ART_SCENES.has(screen) && (
        <SceneArt
          key={screen}
          map={sceneArt}
          id={screen as SceneId}
          className={COMPACT_SCENES.has(screen) ? "fade-up relative z-[1] mx-auto block h-[clamp(150px,26vh,240px)] w-full max-w-[480px] object-cover" : undefined}
        />
      )}
      {screen === "intro" && <IntroScreen copy={copy} friends={friends} />}
      {screen === "intro" && <PageFoot />}
      {screen === "welcome" && (
        <Framed art={<SceneArt key={screen} map={sceneArt} id={screen as SceneId} className="fade-up relative z-[1] block w-full max-w-[480px] rounded-[12px] object-cover" sizes="(max-width: 480px) 90vw, 440px" />}>
          <WelcomeScreen
            copy={copy}
            error={state.error ?? null}
            onSubmit={(n) => {
              const probe = next(state, { type: "SUBMIT_NICKNAME", nickname: n }, flowData) as FlowState;
              setState(probe);
            }}
          />
        </Framed>
      )}
      {screen === "experience" && (
        <Framed art={<SceneArt key={screen} map={sceneArt} id={screen as SceneId} className="fade-up relative z-[1] block w-full max-w-[480px] rounded-[12px] object-cover" sizes="(max-width: 480px) 90vw, 440px" />}>
          <div className="fade-up flex flex-col items-center gap-3 text-center">
            <Sparkle />
            <h1 className="whitespace-pre-line break-keep font-serif text-[24px] font-bold leading-snug text-gold-soft">{fill(copy.experience.title, { nickname })}</h1>
            <p className="font-serif text-[18px] text-moon">{copy.experience.sub}</p>
            <div className="moonarc mt-3" aria-hidden />
            <div className="mt-8 flex w-full flex-col gap-3">
              {[
                { v: "returning", label: copy.experience.button_returning },
                { v: "first", label: copy.experience.button_first },
              ].map((b, i) => (
                <button
                  key={b.v}
                  type="button"
                  className={`w-full rounded-full py-3.5 text-[15px] font-medium ${i === 0 ? "btn-night" : "btn-night-ghost"}`}
                  onClick={() => {
                    startSession(nickname, b.v);
                    go({ type: "CHOOSE_EXPERIENCE", value: b.v });
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </Framed>
      )}
      {screen === "first_time" && (
        <Framed art={<SceneArt key={screen} map={sceneArt} id={screen as SceneId} className="fade-up relative z-[1] block w-full max-w-[480px] rounded-[12px] object-cover" sizes="(max-width: 480px) 90vw, 440px" />}>
          <div className="fade-up flex flex-col items-center gap-6 text-center">
            <Crescent />
            <p className="whitespace-pre-line text-[16px] leading-relaxed text-moon">{fill(copy.first_time.body, { nickname })}</p>
            <Crescent />
            <button type="button" className="btn-night mt-2 w-full rounded-full py-3.5 text-[15px] font-medium" onClick={() => go({ type: "FIRST_TIME_OK" })}>
              {copy.first_time.button}
            </button>
          </div>
        </Framed>
      )}
      {screen === "worry" && (
        <Framed art={<SceneArt key={screen} map={sceneArt} id={screen as SceneId} className="fade-up relative z-[1] block w-full max-w-[480px] rounded-[12px] object-cover" sizes="(max-width: 480px) 90vw, 440px" />}>
          <WorryScreen copy={copy} nickname={nickname} error={state.error ?? netError} busy={busy} onSubmit={submitWorry} />
        </Framed>
      )}
      {screen === "shuffle" && session && (
        <ShuffleScreen copy={copy} session={session} nickname={nickname} onPick={(shuffleId) => {
          setShuffleId(shuffleId);
          go({ type: "PICK_NOW" });
        }} />
      )}
      {(screen === "draw" || screen === "reveal") && session && shuffleId && (
        <DrawScreen
          copy={copy}
          session={session}
          shuffleId={shuffleId}
          pickCount={pickCount}
          revealed={screen === "reveal"}
          onPicked={() => go({ type: "PICK" })}
          onSeeResult={seeResult}
        />
      )}
      {screen === "loading" && (
        <div className="relative flex flex-1 items-center justify-center px-6">
          <WaitNotice nickname={nickname} message={copy.loading.message} elapsedLabel={copy.loading.elapsed} lines={copy.loading.messages} />
        </div>
      )}
    </main>
  );
}

// ---------------- 화면 조각 ----------------

type C = FlowProps["copy"];

// 금선 테두리 화면. 장면 그림은 테두리 안쪽 맨 위에 둔다(owner 2026-10-21: "이미지는 웹페이지 전체 테두리 안에").
function Framed({ children, art }: { children: React.ReactNode; art?: React.ReactNode }) {
  return (
    <div className="gold-frame relative flex flex-1 flex-col items-center px-[22px] pb-16 pt-[22px]">
      <FrameCorners />
      {art}
      <div className="flex w-full max-w-sm flex-1 flex-col justify-center px-[14px] pt-8">{children}</div>
    </div>
  );
}

function Sparkle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 1 L13.6 10.4 L23 12 L13.6 13.6 L12 23 L10.4 13.6 L1 12 L10.4 10.4 Z" fill="var(--gold)" />
    </svg>
  );
}

function Crescent() {
  return (
    <svg width="40" height="14" viewBox="0 0 40 14" aria-hidden>
      <path d="M2 12 Q20 -6 38 12" fill="none" stroke="var(--gold)" strokeWidth="1.2" strokeDasharray="2 3" />
      <path d="M16 6 a5 5 0 1 0 8 0 a4 4 0 1 1 -8 0" fill="var(--gold)" />
    </svg>
  );
}

function IntroScreen({ copy, friends }: { copy: C; friends: Friend[] }) {
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    void getRealSession().then((s) => setLoggedIn(!!s));
  }, []);
  useEffect(() => {
    fetch("/api/tarot/stats")
      .then((r) => r.json())
      .then((j) => setCount(typeof j.count === "number" ? j.count : null))
      .catch(() => setCount(null));
  }, []);
  return (
    <div className="gold-frame relative flex flex-1 flex-col items-center justify-between px-6 pb-14 pt-14 text-center">
      <FrameCorners />
      {/* 로그인한 사람에게는 '로그인' 링크를 보이지 않는다(하단에 '내 결과 · 로그아웃'이 있음) */}
      {!loggedIn && (
        <Link href="/login" className="absolute right-7 top-7 z-[2] text-[13px] text-moon/80 underline">
          {copy.intro.login}
        </Link>
      )}
      {/* 제목이 맨 위, 그 아래 카드 부채 연출(owner 2026-10-20 — 바다 친구 지나가기 대신) */}
      <div className="fade-up flex w-full flex-col items-center gap-3">
        <p className="text-[13px] tracking-[10px] text-gold" aria-hidden>✦ ✦ ✦</p>
        <h1 className="font-serif text-[30px] font-bold text-gold-soft">{copy.intro.title}</h1>
        <p className="text-[14px] text-moon/90">{copy.intro.sub}</p>
        {/* 카드 부채는 제목 바로 아래(owner 2026-10-21: 플래시를 앞으로) */}
        <IntroCardSpin cards={friends} />
      </div>
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        {count !== null && count > 0 && <p className="text-[12px] text-moon/80">{fill(copy.intro.participants, { count: count.toLocaleString("ko-KR") })}</p>}
        {/* 아스트로 첫 화면처럼 두 버튼(owner 2026-10-21). 로그인해야 이용할 수 있어서, 로그인 전이면 둘 다 로그인 화면을 거친다. */}
        <button type="button" className="btn-night w-full rounded-full py-4 text-[16px] font-bold" onClick={() => router.push(`/login?next=${encodeURIComponent("/?start=1")}`)}>
          {copy.intro.button}
        </button>
        <Link href={loggedIn ? "/results" : "/login?next=/results"} className="btn-night-ghost block w-full rounded-full py-4 text-[16px] font-bold">
          {copy.intro.button_results}
        </Link>
      </div>
    </div>
  );
}

function WelcomeScreen({ copy, error, onSubmit }: { copy: C; error: string | null; onSubmit: (n: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="fade-up flex flex-col items-center gap-3 text-center"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name);
      }}
    >
      <Sparkle />
      <h1 className="whitespace-pre-line font-serif text-[26px] font-bold leading-snug text-gold-soft">{copy.welcome.title}</h1>
      <p className="text-[15px] text-moon/90">{copy.welcome.sub}</p>
      <input
        className="input-night mt-6 w-full px-4 py-3.5 text-center text-[16px]"
        value={name}
        maxLength={copy.welcome.max_len}
        placeholder={copy.welcome.placeholder}
        onChange={(e) => setName(e.target.value)}
        aria-label={copy.welcome.placeholder}
        aria-invalid={Boolean(error)}
      />
      <p className="min-h-5 text-[13px] text-gold-soft" role="alert">{error ?? ""}</p>
      <button type="submit" className="btn-night w-full rounded-full py-3.5 text-[15px] font-medium">
        {copy.welcome.button}
      </button>
    </form>
  );
}

function WorryScreen({
  copy,
  nickname,
  error,
  busy,
  onSubmit,
}: {
  copy: C;
  nickname: string;
  error: string | null;
  busy: boolean;
  onSubmit: (text: string, skip: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [ph, setPh] = useState(0);
  const examples = copy.worry.placeholder_examples;
  useEffect(() => {
    const t = setInterval(() => setPh((i) => (i + 1) % examples.length), 3000);
    return () => clearInterval(t);
  }, [examples.length]);
  return (
    <div className="fade-up flex flex-col gap-3">
      {/* owner 줄바꿈("…고민을 / 편하게 작성해주세요.")이 휴대폰에서 세 줄로 밀리지 않게 화면 폭에 맞춰 글자 크기를 줄인다(최대 22px) */}
      <h1 className="whitespace-pre-line break-keep text-center font-serif text-[clamp(16px,4.8vw,22px)] font-bold leading-snug text-gold-soft">{fill(copy.worry.title, { nickname })}</h1>
      <p className="text-center text-[14px] leading-relaxed text-moon/90">{copy.worry.sub}</p>
      <div className="relative mt-4">
        <textarea
          className="input-night h-40 w-full resize-none px-4 py-3 text-[15px] leading-relaxed"
          value={text}
          maxLength={copy.worry.max_len}
          placeholder={examples[ph]}
          onChange={(e) => setText(e.target.value)}
          aria-label="고민 쓰기"
          aria-invalid={Boolean(error)}
        />
        <span className="absolute bottom-2 right-3 text-[12px] text-ink/50">
          {text.length} / {copy.worry.max_len}
        </span>
      </div>
      <p className="min-h-5 text-[13px] text-gold-soft" role="alert">{error ?? ""}</p>
      <button type="button" disabled={busy} className="btn-night w-full rounded-full py-3.5 text-[15px] font-medium disabled:opacity-60" onClick={() => onSubmit(text, false)}>
        {copy.worry.button_submit}
      </button>
      <button type="button" disabled={busy} className="btn-night-ghost w-full rounded-full py-3.5 text-[14px] disabled:opacity-60" onClick={() => onSubmit("", true)}>
        {copy.worry.button_skip}
      </button>
      <p className="mt-3 text-[12px] leading-relaxed text-moon/70">{copy.worry.footnote}</p>
    </div>
  );
}

function ShuffleScreen({
  copy,
  session,
  nickname,
  onPick,
}: {
  copy: C;
  session: { id: string; key: string };
  nickname: string;
  onPick: (shuffleId: string) => void;
}) {
  const [phase, setPhase] = useState<"mixing" | "done" | "error" | "leaving">("mixing");
  const [shuffleId, setShuffleId] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let alive = true;
    const started = Date.now();
    api<{ shuffleId: string }>(`/api/tarot/session/${session.id}/shuffle`, { key: session.key, body: {} })
      .then(async (r) => {
        const wait = SHUFFLE_MIN_MS - (Date.now() - started);
        if (wait > 0) await new Promise((res) => setTimeout(res, wait));
        if (!alive) return;
        setShuffleId(r.shuffleId);
        setPhase("done");
      })
      .catch(() => alive && setPhase("error"));
    return () => {
      alive = false;
    };
  }, [session, round]);
  const mixing = phase === "mixing";
  // [지금 뽑을게요]: 더미가 아래로 내려가며 사라진 뒤 뽑기 화면으로(스펙 7.4)
  function pickNow(id: string) {
    setPhase("leaving");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => onPick(id), reduce ? 0 : 480);
  }
  return (
    <div className="relative flex flex-1 flex-col items-center justify-between px-6 pb-14 pt-12 text-center">
      <p className="fade-up max-w-sm whitespace-pre-line break-keep font-serif text-[18px] leading-relaxed text-gold-soft">{copy.shuffle.guide}</p>
      {/* 섞는 동안: 더미 둘레로 카드·별이 돌고(신비한 연출, owner 2026-10-20) 카드는 좌우로 갈라졌다 겹치며 금빛 잔상.
          다 섞이면 가지런히 모이고 물결 빛이 한 번 지나간다(스펙 7.4). */}
      <div className={`shuffle-zone ${mixing ? "is-mixing" : ""} ${phase === "done" ? "is-done" : ""} ${phase === "leaving" ? "is-leaving" : ""}`}>
        <MysticOrbit size={320}>
          <div className="relative h-56 w-36" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`shuffle-card absolute inset-0 ${mixing ? (i % 3 === 0 ? "shuffle-left" : i % 3 === 1 ? "shuffle-right" : "shuffle-spin") : ""}`}
                style={{ animationDelay: `${i * 0.12}s`, transform: mixing ? undefined : `translateY(${-i * 2}px)`, transition: "transform .4s" }}
              >
                <CardBack className="w-full" />
              </div>
            ))}
            <span className="shuffle-shine" />
          </div>
        </MysticOrbit>
      </div>
      <div className="flex min-h-[170px] w-full max-w-sm flex-col justify-end gap-3">
        {mixing && <RotatingLine lines={copy.shuffle.messages} nickname={nickname} className="mb-4 font-serif text-[16px] text-moon" />}
        {(phase === "done" || phase === "leaving") && shuffleId && (
          <>
            <p className="fade-up text-[15px] text-moon">{copy.shuffle.done}</p>
            <button type="button" disabled={phase === "leaving"} className="btn-night fade-up w-full rounded-full py-3.5 text-[15px] font-medium" onClick={() => pickNow(shuffleId)}>
              {copy.shuffle.button_pick}
            </button>
            <button
              type="button"
              disabled={phase === "leaving"}
              className="btn-night-ghost fade-up w-full rounded-full py-3.5 text-[15px]"
              onClick={() => {
                setPhase("mixing");
                setShuffleId(null);
                setRound((r) => r + 1);
              }}
            >
              {copy.shuffle.button_reshuffle}
            </button>
          </>
        )}
        {phase === "error" && (
          <button type="button" className="btn-night-ghost w-full rounded-full py-3.5 text-[15px]" onClick={() => { setPhase("mixing"); setRound((r) => r + 1); }}>
            {copy.shuffle.error_retry}
          </button>
        )}
      </div>
    </div>
  );
}

// 뽑은 카드: 뒷면으로 아래에서 칸으로 날아든 뒤(0.4초) 앞면으로 뒤집힌다(0.6초) — 디자인 가이드 4장 뽑기
// 처음부터 is-flipped로 그리면 전환이 일어나지 않으므로, 뒷면으로 먼저 그리고 잠시 뒤 뒤집는다.
const SLOT_FLIP_DELAY_MS = 400;
// 보드에서 날아온 카드(owner 2026-10-21 "누르면 카드가 돌돌 돌아가면서 자리로")는 이미 칸에 도착했으니 아래에서 날아들기 없이 곧바로 뒤집는다.
const ARRIVED_FLIP_DELAY_MS = 120;
function SlotFlip({ children, arrived = false }: { children: React.ReactNode; arrived?: boolean }) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), arrived ? ARRIVED_FLIP_DELAY_MS : SLOT_FLIP_DELAY_MS);
    return () => clearTimeout(t);
  }, [arrived]);
  if (arrived) return <div className={`flip-card aspect-[2/3] w-full ${flipped ? "is-flipped" : ""}`}>{children}</div>;
  // 날아들기(투명도 애니메이션)는 바깥 상자에 — 같은 요소에 두면 브라우저가 3D를 평평하게 그려 뒤집어도 뒷면이 보인다.
  return (
    <div className="slot-fly">
      <div className={`flip-card aspect-[2/3] w-full ${flipped ? "is-flipped" : ""}`}>{children}</div>
    </div>
  );
}

// 보드에서 누른 카드 뒷면이 두 바퀴 돌면서 칸 크기로 커지며 날아간다(0.65초). 화면에 고정된 복제본이라 보드·칸 배치에 영향 없음.
function CardFlight({ from, to, done }: { from: DOMRect; to: DOMRect; done: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return done();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const k = to.width / from.width;
    const a = el.animate(
      [
        { transform: "translate(0, 0) rotate(0deg) scale(1)" },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) rotate(360deg) scale(${(1 + k) / 2 + 0.15})`, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) rotate(720deg) scale(${k})` },
      ],
      { duration: 650, easing: "cubic-bezier(0.3, 0.7, 0.3, 1)", fill: "forwards" },
    );
    a.onfinish = () => done();
    return () => a.cancel();
    // 한 번 날리고 끝(새 비행은 key로 새로 만든다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none fixed z-[60] drop-shadow-[0_0_14px_rgba(227,198,142,0.6)]" style={{ left: from.left, top: from.top, width: from.width, transformOrigin: "50% 50%" }}>
      <CardBack className="w-full" />
    </div>
  );
}

function DrawScreen({
  copy,
  session,
  shuffleId,
  pickCount,
  revealed,
  onPicked,
  onSeeResult,
}: {
  copy: C;
  session: { id: string; key: string };
  shuffleId: string;
  pickCount: number;
  revealed: boolean;
  onPicked: () => void;
  onSeeResult: () => void;
}) {
  const [picks, setPicks] = useState<PickResponse[]>([]);
  const [pending, setPending] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flight, setFlight] = useState<{ from: DOMRect; to: DOMRect; done: () => void } | null>(null);
  const [arrived, setArrived] = useState<number[]>([]);
  const takenSlots = picks.map((p) => p.slot);

  async function choose(slot: number) {
    // 애니메이션·요청이 끝날 때까지 다음 입력은 받지 않는다(중복 선택 방지).
    if (pending !== null || picks.length >= pickCount || takenSlots.includes(slot)) return;
    setPending(slot);
    setErr(null);
    // 누르자마자 그 카드가 돌면서 칸으로 날아간다(owner 2026-10-21 — 예전엔 서버 응답을 기다리는 동안 아무 변화가 없어 멈춘 것처럼 보였다).
    // 날아가는 동안 서버에 뽑기를 요청하고, 둘 다 끝나면 칸에서 앞면으로 뒤집는다. 무엇이 나올지는 여전히 서버만 안다.
    const index = picks.length;
    const fromEl = [...document.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`)].find((el) => el.getClientRects().length > 0);
    const toEl = document.querySelector<HTMLElement>(`[data-target="${index}"]`);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let landed: Promise<void> = Promise.resolve();
    if (fromEl && toEl && !reduce) {
      const from = fromEl.getBoundingClientRect();
      const to = toEl.getBoundingClientRect();
      landed = new Promise<void>((done) => setFlight({ from, to, done }));
    }
    try {
      const [r] = await Promise.all([api<PickResponse>(`/api/tarot/session/${session.id}/pick`, { key: session.key, body: { shuffleId, slot } }), landed]);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(10);
      const flew = Boolean(fromEl && toEl && !reduce);
      if (flew) setArrived((a) => [...a, index]);
      setFlight(null);
      setPicks((p) => [...p, r]);
      onPicked();
      await new Promise((res) => setTimeout(res, (flew ? ARRIVED_FLIP_DELAY_MS : SLOT_FLIP_DELAY_MS) + 650)); // 뒤집기 0.6초
    } catch (e) {
      setFlight(null);
      setErr(e instanceof ApiError ? e.message : "잠시 후 다시 눌러 주세요.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="relative flex flex-1 flex-col items-center px-4 pb-10 pt-10">
      {flight && <CardFlight key={`${flight.from.left}-${flight.from.top}`} {...flight} />}
      <p className="mb-5 max-w-sm text-center font-serif text-[17px] leading-relaxed text-gold-soft">
        {revealed ? copy.reveal.done : copy.pick.guide}
      </p>
      {/* 다 뽑으면 보드는 사라지고 세 장이 가운데로 모이며 ✦✦✦와 새벽빛(디자인 가이드 4장 "다 뽑음") */}
      {revealed && (
        <p className="fade-up mb-1 text-[14px] tracking-[0.5em] text-gold" aria-hidden>
          ✦✦✦
        </p>
      )}
      {/* 슬롯 3개: 지나온 길 / 지금의 흐름 / 앞으로의 열쇠 */}
      <div className={`relative grid w-full max-w-sm grid-cols-3 gap-3 transition-all duration-500 ${revealed ? "reveal-trio mt-4 scale-105" : ""}`}>
        {revealed && <span className="reveal-dawn" aria-hidden />}
        {copy.pick.slot_labels.map((label, i) => {
          const p = picks[i];
          return (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <span className="text-[12px] text-gold">{label}</span>
              <div className="flip-scene relative w-full" data-target={i}>
                {p ? (
                  <div className="relative">
                    <span className="dawn-glow" aria-hidden />
                    <SlotFlip arrived={arrived.includes(i)}>
                      <div className="flip-face">
                        <CardBack className="w-full" />
                      </div>
                      <div className="flip-face flip-front">
                        <CardFace image={p.card.image} name={p.card.name} character={p.card.character} reversed={p.reversed} className="w-full" />
                      </div>
                    </SlotFlip>
                  </div>
                ) : (
                  <div className="flex aspect-[2/3] w-full items-center justify-center rounded-[6%] border border-dashed border-gold/70">
                    {/* 빈 칸: 점선 금테 + 초승달(디자인 가이드 4장) */}
                    <svg viewBox="0 0 24 24" className="h-6 w-6 text-gold/70" aria-hidden>
                      <path d="M15.5 3.5a8.5 8.5 0 1 0 5 15.4A7 7 0 1 1 15.5 3.5z" fill="currentColor" />
                    </svg>
                  </div>
                )}
              </div>
              {p && (p.reversed ? <CardCaption name={p.card.name} reversed dark /> : <span className="fade-up text-center font-serif text-[12px] text-moon">{p.card.name}</span>)}
            </div>
          );
        })}
      </div>
      {!revealed && (
        <>
          <p className="mt-4 text-[13px] text-moon/80">{fill(copy.pick.counter, { picked: picks.length })}</p>
          <DrawBoard count={22} taken={takenSlots} pending={pending} onChoose={choose} />
          <p className="min-h-5 text-[13px] text-gold-soft" role="alert">{err ?? ""}</p>
        </>
      )}
      {revealed && (
        <div className="mt-10 w-full max-w-sm">
          <button type="button" className="btn-night fade-up w-full rounded-full py-3.5 text-[15px] font-medium" onClick={onSeeResult}>
            {copy.reveal.button}
          </button>
        </div>
      )}
    </div>
  );
}
