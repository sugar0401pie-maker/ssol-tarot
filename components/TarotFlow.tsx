"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { initialState, next, type FlowAction, type FlowStateBase } from "@/lib/tarot/flow.js";
import { api, saveKey, ApiError, type PickResponse } from "@/lib/client/api";
import { fill } from "@/lib/client/text";
import { CardBack, CardFace, CardCaption, FrameCorners, Stars } from "./Cards";
import { SceneArt } from "./SceneArt";
import { MysticOrbit, RotatingLine } from "./Mystic";
import type { SceneArtMap, SceneId } from "@/lib/client/sceneArt";
import { WaitNotice } from "./WaitNotice";
import type { Friend } from "./IntroCardSpin";
import { IntroCardSpin } from "./IntroCardSpin";
import { DrawBoard } from "./DrawBoard";
import { SafetyScreen } from "./SafetyScreen";

// 시작 흐름 → 셔플 → 뽑기 → (대기). 화면 이동 규칙은 패키지 원본 상태 기계(lib/tarot/flow.js의 next)를 그대로 쓴다.
// 결과는 /result/[id]로 넘어간다(이 앱은 서브도메인이라 루트가 테스트 시작).

export type Copy = (typeof import("@/data/tarot_data.json"))["copy"];
export type FlowProps = { copy: Omit<Copy, "cta_chat">; pickCount: number; friends: Friend[]; sceneArt?: SceneArtMap };

type FlowState = FlowStateBase;
type Action = FlowAction;

const SHUFFLE_MIN_MS = 6000; // 스펙 7.4는 최소 3초. 3초마다 바뀌는 안내(owner 2026-10-20)가 두 줄은 보이도록 6초. 움직임 줄이기에서도 유지
const AGAIN_KEY = "ssol_tarot_again";

const NO_SCENE_ART: SceneArtMap = {};

export default function TarotFlow({ copy, pickCount, friends, sceneArt = NO_SCENE_ART }: FlowProps) {
  const router = useRouter();
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

  async function seeResult() {
    if (!session) return;
    try {
      const r = await api<{ status: string }>(`/api/tarot/session/${session.id}/result`, { key: session.key });
      if (r.status === "safety") return go({ type: "AI_URGENT" });
      if (r.status === "ready") return router.push(`/result/${session.id}`);
    } catch {
      /* 대기 화면에서 다시 확인 */
    }
    go({ type: "SEE_RESULT", ready: false });
  }

  // 대기 화면: 1초 간격으로 결과 준비 확인
  useEffect(() => {
    if (state.screen !== "loading" || !session) return;
    let stop = false;
    const t = setInterval(async () => {
      try {
        const r = await api<{ status: string }>(`/api/tarot/session/${session.id}/result`, { key: session.key });
        if (stop) return;
        if (r.status === "safety") go({ type: "AI_URGENT" });
        else if (r.status === "ready") router.push(`/result/${session.id}`);
      } catch {
        /* 다음 주기 */
      }
    }, 1000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [state.screen, session, go, router]);

  const screen = state.screen;

  if (screen === "safety") return <SafetyScreen copy={copy} />;

  return (
    <main className="night-bg relative flex min-h-dvh flex-col overflow-x-hidden">
      <Stars />
      {/* 장면 맨 위 그림(그림 파일이 있는 장면만). 장면이 바뀔 때마다 다시 고름 */}
      <SceneArt key={screen} map={sceneArt} id={screen as SceneId} />
      {screen === "intro" && <IntroScreen copy={copy} friends={friends} onStart={() => go({ type: "START" })} />}
      {screen === "welcome" && (
        <Framed>
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
        <Framed>
          <div className="fade-up flex flex-col items-center gap-3 text-center">
            <Sparkle />
            <h1 className="font-serif text-[24px] font-bold leading-snug text-gold-soft">{fill(copy.experience.title, { nickname })}</h1>
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
        <Framed>
          <div className="fade-up flex flex-col items-center gap-6 text-center">
            <Crescent />
            <p className="text-[16px] leading-relaxed text-moon">{fill(copy.first_time.body, { nickname })}</p>
            <Crescent />
            <button type="button" className="btn-night mt-2 w-full rounded-full py-3.5 text-[15px] font-medium" onClick={() => go({ type: "FIRST_TIME_OK" })}>
              {copy.first_time.button}
            </button>
          </div>
        </Framed>
      )}
      {screen === "worry" && (
        <Framed>
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

function Framed({ children }: { children: React.ReactNode }) {
  return (
    <div className="gold-frame relative flex flex-1 flex-col items-center justify-center px-9 py-16">
      <FrameCorners />
      <div className="w-full max-w-sm">{children}</div>
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

function IntroScreen({ copy, friends, onStart }: { copy: C; friends: Friend[]; onStart: () => void }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/tarot/stats")
      .then((r) => r.json())
      .then((j) => setCount(typeof j.count === "number" ? j.count : null))
      .catch(() => setCount(null));
  }, []);
  return (
    <div className="gold-frame relative flex flex-1 flex-col items-center justify-between px-6 pb-14 pt-14 text-center">
      <FrameCorners />
      <Link href="/login" className="absolute right-7 top-7 z-[2] text-[13px] text-moon/80 underline">
        {copy.intro.login}
      </Link>
      {/* 제목이 맨 위, 그 아래 카드 부채 연출(owner 2026-10-20 — 바다 친구 지나가기 대신) */}
      <div className="fade-up flex w-full flex-col items-center gap-3">
        <p className="text-[13px] tracking-[10px] text-gold" aria-hidden>✦ ✦ ✦</p>
        <h1 className="font-serif text-[30px] font-bold text-gold-soft">{copy.intro.title}</h1>
        <p className="text-[14px] text-moon/90">{copy.intro.sub}</p>
      </div>
      <IntroCardSpin cards={friends} />
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        {count !== null && count > 0 && <p className="text-[13px] text-moon/80">{fill(copy.intro.participants, { count: count.toLocaleString("ko-KR") })}</p>}
        <button type="button" className="btn-night w-full rounded-full py-4 text-[16px] font-bold" onClick={onStart}>
          {copy.intro.button}
        </button>
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
      <h1 className="font-serif text-[26px] font-bold leading-snug text-gold-soft">{copy.welcome.title}</h1>
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
      <h1 className="text-center font-serif text-[22px] font-bold leading-snug text-gold-soft">{fill(copy.worry.title, { nickname })}</h1>
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
      <p className="fade-up max-w-sm font-serif text-[18px] leading-relaxed text-gold-soft">{copy.shuffle.guide}</p>
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
  const takenSlots = picks.map((p) => p.slot);

  async function choose(slot: number) {
    // 애니메이션·요청이 끝날 때까지 다음 입력은 받지 않는다(중복 선택 방지).
    if (pending !== null || picks.length >= pickCount || takenSlots.includes(slot)) return;
    setPending(slot);
    setErr(null);
    try {
      const r = await api<PickResponse>(`/api/tarot/session/${session.id}/pick`, { key: session.key, body: { shuffleId, slot } });
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(10);
      setPicks((p) => [...p, r]);
      onPicked();
      await new Promise((res) => setTimeout(res, 650)); // 뒤집기 0.6초
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "잠시 후 다시 눌러 주세요.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="relative flex flex-1 flex-col items-center px-4 pb-10 pt-10">
      <p className="mb-5 max-w-sm text-center font-serif text-[17px] leading-relaxed text-gold-soft">
        {revealed ? copy.reveal.done : copy.pick.guide}
      </p>
      {/* 슬롯 3개: 지나온 길 / 지금의 흐름 / 앞으로의 열쇠 */}
      <div className={`grid w-full max-w-sm grid-cols-3 gap-3 transition-all duration-500 ${revealed ? "mt-4 scale-105" : ""}`}>
        {copy.pick.slot_labels.map((label, i) => {
          const p = picks[i];
          return (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <span className="text-[12px] text-gold">{label}</span>
              <div className="flip-scene relative w-full">
                {p ? (
                  <div className="relative">
                    <span className="dawn-glow" aria-hidden />
                    <div className="flip-card is-flipped aspect-[2/3] w-full" style={{ animation: "none" }}>
                      <div className="flip-face">
                        <CardBack className="w-full" />
                      </div>
                      <div className="flip-face flip-front">
                        <CardFace image={p.card.image} name={p.card.name} character={p.card.character} reversed={p.reversed} className="w-full" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-[2/3] w-full rounded-[6%] border border-dashed border-gold/70" />
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
