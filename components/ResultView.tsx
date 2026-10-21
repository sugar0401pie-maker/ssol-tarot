"use client";

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, loadKey, ApiError, type ResultResponse, type ResultPage, type ResultCard } from "@/lib/client/api";
import { getAccessToken } from "@/lib/supabase/browser";
import { clean } from "@/lib/client/text";
import { cardImg } from "@/lib/client/cardImage";
import { parseBlocks, parseInline, type Block, type Inline, type ParseOpts } from "@/lib/client/pageBlocks";
import type { Copy } from "./TarotFlow";
import { SafetyScreen } from "./SafetyScreen";
import { ShareSheet } from "./ShareSheet";
import { SceneArt } from "./SceneArt";
import { RESULT_PAGE_SCENE, type SceneArtMap } from "@/lib/client/sceneArt";
import { Stars } from "./Cards";
import { WaitNotice } from "./WaitNotice";

// 결과 넘겨 보기 11쪽(v4.0). 화면 모양은 owner 시안 docs/design/result-swipe-preview-v4.html과 똑같이 맞춘다
// (CSS: app/result/[id]/result-v4.css, 줄 → 블록 규칙: lib/client/pageBlocks.ts).
// 결제 전 6~11쪽과 5쪽 결론 부분은 서버가 본문을 보내지 않는다 — 블러 아래 글은 데이터의 고정 예시(blur_samples)다.

type ViewCopy = Omit<Copy, "cta_chat">;
type Ready = Extract<ResultResponse, { status: "ready" }>;

// 쏘웰라 채팅(같은 계정) — 11쪽 버튼. 결제 연동 전에는 11쪽이 잠겨 있어 아직 보이지 않는다.
const SOWELLA_URL = "https://app.ssolwellnesshouse.com/chat";

export default function ResultView({ id, copy, opts }: { id: string; copy: ViewCopy; opts: ParseOpts }) {
  const [res, setRes] = useState<ResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");

  useEffect(() => {
    try {
      const p = JSON.parse(sessionStorage.getItem("ssol_tarot_profile") ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장된 닉네임으로 대기 문구를 한 번 채움
      if (p?.nickname) setNickname(p.nickname);
    } catch {
      /* 무시 */
    }
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const r = await api<ResultResponse>(`/api/tarot/session/${id}/result`, { key: loadKey(id) });
        if (stop) return;
        setRes(r);
        if (r.status === "preparing") timer = setTimeout(load, 1000);
      } catch (e) {
        if (stop) return;
        setError(
          e instanceof ApiError && e.status === 403
            ? "이 결과는 카드를 뽑은 브라우저나, 결과를 저장한 계정으로 로그인해야 볼 수 있어요."
            : e instanceof ApiError
              ? e.message
              : "잠시 후 다시 시도해 주세요.",
        );
      }
    };
    load();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id]);

  if (error) {
    return (
      <main className="dawn-bg flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-[15px] leading-relaxed">{error}</p>
        <Link href="/" className="rounded-full bg-navy px-6 py-3 text-[15px] text-white">
          처음으로
        </Link>
      </main>
    );
  }
  if (!res || res.status === "preparing") {
    return (
      <main className="night-bg relative flex min-h-dvh items-center justify-center px-6">
        <Stars />
        <WaitNotice nickname={nickname || "당신"} message={copy.loading.message} elapsedLabel={copy.loading.elapsed} />
      </main>
    );
  }
  if (res.status === "safety") return <SafetyScreen copy={copy} />;
  if (res.status === "drawing") {
    return (
      <main className="dawn-bg flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-[15px]">아직 카드를 다 뽑지 않았어요.</p>
        <Link href="/" className="rounded-full bg-navy px-6 py-3 text-[15px] text-white">
          처음으로
        </Link>
      </main>
    );
  }
  return <Swipe id={id} r={res as Ready} copy={copy} opts={opts} />;
}

// 쪽이 잠겨 있는지(시안 LOCK.unpaid = 6~11쪽). 5쪽은 일부 무료라 점 표시는 열린 쪽으로 둔다.
const isLocked = (p: ResultPage, paid: boolean) => !paid && p.page >= 6;

function Swipe({ id, r, copy, opts }: { id: string; r: Ready; copy: ViewCopy; opts: ParseOpts }) {
  const rail = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState<{ src: string; alt: string; reversed: boolean } | null>(null);
  const [saved, setSaved] = useState(r.saved);
  const [msg, setMsg] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const closeShare = useCallback(() => setSharing(false), []);
  // 결과 쪽 맨 위 장면 그림 목록(빌드 때 만든 정적 목록). 못 받으면 그림 없이 그대로.
  const [sceneArt, setSceneArt] = useState<SceneArtMap | null>(null);
  useEffect(() => {
    fetch("/api/scene-art")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setSceneArt(j))
      .catch(() => setSceneArt(null));
  }, []);
  const router = useRouter();
  const n = r.pages.length;

  const go = useCallback(
    (k: number) => {
      const el = rail.current;
      if (!el) return;
      el.scrollTo({ left: Math.max(0, Math.min(n - 1, k)) * el.clientWidth });
    },
    [n],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(idx + 1);
      if (e.key === "ArrowLeft") go(idx - 1);
      if (e.key === "Escape") setZoom(null);
    };
    const onResize = () => go(idx);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [go, idx]);

  // 스크롤 이벤트는 1초에 수십 번 온다 — 한 화면 그리기에 한 번만 계산(쪽 번호가 같으면 React가 다시 그리지 않음).
  const ticking = useRef(false);
  function onScroll() {
    const el = rail.current;
    if (!el || ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      ticking.current = false;
      setIdx(Math.round(el.scrollLeft / el.clientWidth));
    });
  }

  async function save() {
    setMsg(null);
    if (saved) {
      setMsg("내 계정에 저장된 결과예요. 쏘웰라 마이페이지에서 다시 볼 수 있어요.");
      return;
    }
    try {
      if (!(await getAccessToken())) {
        // 로그인 안 돼 있으면 로그인 화면으로 — 로그인 뒤 이 결과로 돌아와 다시 누르면 저장된다.
        router.push(`/login?next=${encodeURIComponent(`/result/${id}`)}`);
        return;
      }
      await api(`/api/tarot/session/${id}/claim`, { key: loadKey(id), body: {} });
      setSaved(true);
      setMsg("내 계정에 저장했어요. 쏘웰라 마이페이지에서 다시 볼 수 있어요.");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "잠시 후 다시 시도해 주세요.");
    }
  }

  function retry() {
    try {
      const p = JSON.parse(sessionStorage.getItem("ssol_tarot_profile") ?? "null");
      sessionStorage.setItem("ssol_tarot_again", JSON.stringify({ nickname: p?.nickname ?? r.nickname, experience: p?.experience ?? "returning" }));
    } catch {
      /* 무시 — 처음부터 시작 */
    }
    router.push("/");
  }

  // 쪽 본문(줄 해석 포함)은 결과가 바뀔 때만 다시 그린다 — 넘길 때마다 11쪽을 다시 해석하지 않게.
  const ctx: Ctx = useMemo(() => ({ r, copy, opts, openZoom: setZoom }), [r, copy, opts]);

  return (
    <div className="tv4">
      <div className="phone">
        <div className="dots" aria-hidden>
          {r.pages.map((p, k) => (
            <i key={p.page} className={`${k === idx ? "on" : ""} ${isLocked(p, r.paid) ? "lock" : ""}`} />
          ))}
        </div>
        <div className="rail" ref={rail} onScroll={onScroll}>
          {r.pages.map((p) => (
            <section className="page" key={p.page} aria-label={`${p.page} / ${n} ${p.title}`}>
              <header className="ph">
                <span className="no">
                  {p.page} / {n}
                </span>
                <h1>{p.title}</h1>
              </header>
              <div className="pbody">
                {sceneArt && RESULT_PAGE_SCENE[p.page] && (
                  <SceneArt map={sceneArt} id={RESULT_PAGE_SCENE[p.page]!} className="scene" sizes="(max-width: 400px) 92vw, 364px" />
                )}
                <PageBody p={p} ctx={ctx} />
                {p.page >= 4 && (
                  <>
                    <div className="sharerow">
                      <button type="button" className="btn line sm" onClick={() => setSharing(true)}>
                        공유하기
                      </button>
                      <button type="button" className="btn line sm" onClick={save}>
                        저장하기
                      </button>
                    </div>
                    {msg && (
                      <p className="toast" role="status">
                        {msg}
                      </p>
                    )}
                  </>
                )}
                <div className="navrow">
                  {p.page > 1 && (
                    <button type="button" className="btn line" onClick={() => go(p.page - 2)}>
                      {p.back || copy.result.back_button}
                    </button>
                  )}
                  {p.next && (
                    <button type="button" className="btn fill" onClick={() => go(p.page)}>
                      {p.next} →
                    </button>
                  )}
                </div>
                {p.page === n && (
                  <button type="button" className="btn line" onClick={retry}>
                    {copy.result.retry}
                  </button>
                )}
                {(p.page === 1 || p.page === n) && <p className="fineprint">{copy.disclaimer}</p>}
              </div>
            </section>
          ))}
        </div>
        <div className="nav">
          <button type="button" aria-label="이전 페이지" disabled={idx === 0} onClick={() => go(idx - 1)}>
            ‹
          </button>
          <span>
            {idx + 1} / {n}
          </span>
          <button type="button" aria-label="다음 페이지" disabled={idx === n - 1} onClick={() => go(idx + 1)}>
            ›
          </button>
        </div>
      </div>
      {r.cards[2] && (
        <ShareSheet open={sharing} onClose={closeShare} copy={copy.share_card} third={r.cards[2]} decision={Boolean(r.decision)} />
      )}
      <button type="button" className={`zoom ${zoom ? "on" : ""}`} onClick={() => setZoom(null)} aria-label="크게 보기 닫기" tabIndex={zoom ? 0 : -1}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 시안과 같은 단순 확대(고정 크기 이미지) */}
        {zoom && <img {...cardImg(zoom.src, "min(70vw, 300px)")} alt={zoom.alt} className={zoom.reversed ? "rev180" : ""} />}
      </button>
    </div>
  );
}

type Ctx = { r: Ready; copy: ViewCopy; opts: ParseOpts; openZoom: (z: { src: string; alt: string; reversed: boolean }) => void };

const PageBody = memo(function PageBody({ p, ctx }: { p: ResultPage; ctx: Ctx }) {
  const { r, opts } = ctx;
  if (p.card) return <CardPage p={p} ctx={ctx} />;
  if (p.page === 5 && !r.paid) {
    // 5쪽: 메인 문구·첫 줄·카드별 한 줄까지 무료, 결론부터는 결제 후. 서버가 결론을 보내지 않으므로 블러 아래는
    // 데이터의 5쪽 전용 고정 예시(blur_samples.locked5 — 민준님 예시, 이 사용자 내용 아님).
    const sample = ctx.copy.result.blur_samples.locked5;
    return (
      <>
        <Blocks blocks={parseBlocks(p.free, opts)} ctx={ctx} />
        <Lock blur={sample} ctx={ctx} />
      </>
    );
  }
  if (isLocked(p, r.paid)) {
    return (
      <>
        {p.teaser && <p className="teaser">{p.teaser}</p>}
        <Lock blur={p.blur ?? null} ctx={ctx} />
      </>
    );
  }
  return <Blocks blocks={parseBlocks(p.body, opts)} ctx={ctx} />;
});

function Lock({ blur, ctx }: { blur: string | null; ctx: Ctx }) {
  const c = ctx.copy.result;
  return (
    <div className="lockwrap">
      {/* 고정 예시 문장(이 사용자의 내용 아님) — 화면 읽기 프로그램에는 숨김 */}
      <div className="blurred" aria-hidden>
        <Blocks blocks={parseBlocks(blur, ctx.opts)} ctx={ctx} />
      </div>
      <div className="pay">
        {/* 결정형이면 "세 장이 고른 쪽"이 가장 큰 결제 이유 — 데이터의 _decision 문구 */}
        <b>{ctx.r.decision ? c.paywall_title_decision : c.paywall_title}</b>
        <p>{ctx.r.decision ? c.paywall_body_decision : c.paywall_body}</p>
        <p className="price">{c.paywall_price}</p>
        {/* TODO: 실제 연동 — 토스 결제(1,900원) 후 유료 리포트(D·E 호출) 생성. 결제 전 유료 본문은 만들지 않는다. */}
        <button type="button" className="btn fill" disabled>
          {c.paywall_button}
        </button>
        <small>결제는 준비 중이에요</small>
      </div>
    </div>
  );
}

function CardPage({ p, ctx }: { p: ResultPage; ctx: Ctx }) {
  const c = p.card!;
  const src = `/images/tarot/${c.image}`;
  const alt = `${c.name} — ${c.character}`;
  return (
    <>
      <button type="button" className="card xl" onClick={() => ctx.openZoom({ src, alt, reversed: c.reversed })} aria-label={`${alt} 크게 보기`}>
        {/* 2~4쪽은 처음엔 옆으로 밀려 있는 쪽이라 늦게 불러온다(넘겨 갈 때 받음) */}
        {/* eslint-disable-next-line @next/next/no-img-element -- 최적화 주소는 cardImg(getImageProps)로 직접 넣음 */}
        <img {...cardImg(src, "(max-width: 400px) 92vw, 364px")} alt={alt} loading="lazy" decoding="async" className={c.reversed ? "rev180" : ""} />
      </button>
      <div className="cardinfo">
        <p className="cname">
          <b>{c.name}</b> <span className="ch">{c.reversed ? `${c.character} · 역방향` : c.character}</span>
        </p>
        <p className="kw">
          {c.keywords.map((k) => (
            <span key={k}>#{k}</span>
          ))}
        </p>
        {c.arcana && <p className="arc">원래 타로 카드 · {c.arcana}</p>}
      </div>
      {p.saysTitle && <h3 className="storyhead">{p.saysTitle}</h3>}
      {(p.says ?? []).map((s, i) =>
        c.reversed && i === 0 ? (
          <p key={i} className="revsay">
            <span className="revlab">역방향</span>
            <Inl inline={parseInline(s)} />
          </p>
        ) : (
          <p key={i}>
            <Inl inline={parseInline(s)} />
          </p>
        ),
      )}
      {p.question && <h3 className="storyhead">{p.question}</h3>}
      <Blocks blocks={parseBlocks(p.body, ctx.opts)} ctx={ctx} />
    </>
  );
}

function Inl({ inline }: { inline: Inline }) {
  return (
    <>
      {inline.map((s, i) => (s.bold ? <b key={i}>{s.text}</b> : <Fragment key={i}>{s.text}</Fragment>))}
    </>
  );
}

const ARROW = { up: "↗", flat: "→", down: "↘" } as const;

function Blocks({ blocks, ctx }: { blocks: Block[]; ctx: Ctx }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "headline":
            return (
              <h2 key={i} className="headline">
                {b.lines.map((l, j) => (
                  <Fragment key={j}>
                    {j > 0 && <br />}
                    {l}
                  </Fragment>
                ))}
              </h2>
            );
          case "sub":
            return <h4 key={i}>{b.text}</h4>;
          case "sec":
            return (
              <h3 key={i} className="sec">
                {b.text}
              </h3>
            );
          case "sum":
            return (
              <p key={i} className="sum">
                <b>{b.text}</b>
              </p>
            );
          case "list":
            return (
              <ul key={i} className="plain">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inl inline={it} />
                  </li>
                ))}
              </ul>
            );
          case "bridge":
            return (
              <p key={i} className="bridge">
                {b.text}
              </p>
            );
          case "item":
            // 시안은 <ul><li><b>제목</b></li><p>…</p></ul>(목록 점은 제목에만). 같은 모양을 올바른 HTML로.
            return (
              <ul key={i}>
                <li>
                  <b>{b.title}</b>
                </li>
                {b.body && (
                  <li style={{ listStyle: "none", marginBottom: 0 }}>
                    <p>
                      <Inl inline={b.body} />
                    </p>
                  </li>
                )}
              </ul>
            );
          case "fine":
            return (
              <p key={i} className="fineprint">
                {b.text}
              </p>
            );
          case "map":
            return (
              <div key={i} className="rmap">
                <div className="mrow">
                  {b.cells.map((c, j) => (
                    <Fragment key={j}>
                      {j > 0 && <span className="marr">›</span>}
                      <div className={`mcell ${c.dir}`}>
                        <span className="mpos">{c.position}</span>
                        <b>{c.name}</b>
                        <span className="mrev">{c.reversed ? "역방향" : "정방향"}</span>
                        <span className="mforce">
                          {ARROW[c.dir]} {c.force}
                        </span>
                      </div>
                    </Fragment>
                  ))}
                </div>
              </div>
            );
          case "button":
            return (
              <a key={i} className="btn fill" href={SOWELLA_URL}>
                {b.text}
              </a>
            );
          case "strip":
            return <Strip key={i} cards={ctx.r.cards} ctx={ctx} />;
          case "mini":
            return (
              <div key={i} className="mini">
                <span className="pos">{b.position}</span>
                <b>{b.name}</b> <small>{b.reversed ? `${b.character} · 역방향` : b.character}</small>
              </div>
            );
          case "kw":
            return (
              <p key={i} className="kw">
                {b.tags.map((t) => (
                  <span key={t}>#{t}</span>
                ))}
              </p>
            );
          default:
            return (
              <p key={i}>
                <Inl inline={b.inline} />
              </p>
            );
        }
      })}
    </>
  );
}

function Strip({ cards, ctx }: { cards: ResultCard[]; ctx: Ctx }) {
  return (
    <>
      <div className="strip">
        {cards.map((c) => {
          const alt = `${c.name} — ${c.character}`;
          return (
            <button type="button" key={c.id} className="card sm" onClick={() => ctx.openZoom({ src: c.image, alt, reversed: c.reversed })} aria-label={`${alt} 크게 보기`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img {...cardImg(c.image, "(max-width: 400px) 30vw, 120px")} alt={alt} fetchPriority="high" className={c.reversed ? "rev180" : ""} />
              {c.reversed && <span className="revtag" style={{ display: "block" }}>역방향</span>}
            </button>
          );
        })}
      </div>
      <p className="hint">{ctx.copy.result_cards.hint}</p>
      {ctx.r.notice && (
        <div className="notice" role="note">
          {ctx.r.notice.split("\n\n").map((t, i) => (
            <p key={i}>{clean(t)}</p>
          ))}
        </div>
      )}
    </>
  );
}
