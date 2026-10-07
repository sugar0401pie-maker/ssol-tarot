"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, loadKey, ApiError, type ResultResponse } from "@/lib/client/api";
import { getAccessToken } from "@/lib/supabase/browser";
import { clean, fill } from "@/lib/client/text";
import type { Copy } from "./TarotFlow";
import { CardZoom } from "./CardZoom";
import { ReportText } from "./ReportText";
import { SafetyScreen } from "./SafetyScreen";
import { Stars } from "./Cards";
import { WaitNotice } from "./WaitNotice";

// 결과 페이지(스펙 7.5): 카드 3장 사진 → 무료 1~3번 → (안전 안내 박스) → 잠금 구간(4번 카드명 + 5~8번 제목·고정 한 줄) → 결제 카드.
// 유료 본문은 서버가 보내지 않으므로 블러는 "가려진 본문"이 아니라 고정 한 줄 위에 씌운 장식이다.

const SOWELLA_URL = "https://app.ssolwellnesshouse.com";

type Ready = Extract<ResultResponse, { status: "ready" }>;

export default function ResultView({ id, copy }: { id: string; copy: Omit<Copy, "cta_chat"> }) {
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
  return <ReadyView id={id} r={res as Ready} copy={copy} />;
}

function ReadyView({ id, r, copy }: { id: string; r: Ready; copy: Omit<Copy, "cta_chat"> }) {
  const headings = copy.asks_headings;
  return (
    <main className="dawn-bg min-h-dvh pb-40">
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-8 px-5 pt-10">
        <h1 className="text-center font-serif text-[24px] font-bold text-card-line">{fill(copy.result.headline, { nickname: r.nickname })}</h1>
        <CardZoom cards={r.cards} hint={copy.result_cards.hint} />

        {r.free.map((text, i) => (
          <section key={i} className="rounded-3xl bg-white px-5 py-6 shadow-sm">
            <ReportText text={text} subheadings={headings} card={i === 0 ? undefined : r.cards[i - 1]} />
          </section>
        ))}

        {r.notice && (
          <section className="rounded-3xl border border-card-line/20 bg-dawn-peach px-5 py-5" role="note">
            {r.notice.split("\n\n").map((p, i) => (
              <p key={i} className="text-[15px] leading-relaxed">
                {clean(p)}
              </p>
            ))}
            {r.noticeContacts && (
              <ul className="mt-3 flex flex-col gap-1.5 text-[14px]">
                {r.noticeContacts.map((c) => (
                  <li key={c.name}>
                    <a className="font-bold text-navy underline" href={`tel:${c.number.split("/")[0].replace(/[^0-9]/g, "")}`}>
                      {c.name} {c.number}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* 잠금 구간: 제목 + 고정 한 줄만(본문 데이터 없음) */}
        <div className="flex flex-col gap-4">
          {r.locked.map((l) => (
            <section key={l.no} className="relative overflow-hidden rounded-3xl bg-white px-5 py-6 shadow-sm">
              <h2 className="font-serif text-[18px] font-bold text-card-line">
                {l.no}. {l.title}
              </h2>
              {l.card && <p className="mt-2 font-serif text-[16px] font-bold text-card-line">{l.card}</p>}
              <p className="mt-2 select-none text-[15px] leading-relaxed blur-[3px]" aria-hidden>
                {l.teaser}
              </p>
              <span className="sr-only">{l.teaser} — 리포트에서 열려요</span>
            </section>
          ))}
        </div>

        <section className="rounded-3xl bg-night px-5 py-7 text-center text-moon">
          <h2 className="font-serif text-[20px] font-bold text-gold-soft">{copy.result.paywall_title}</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-moon/90">{copy.result.paywall_body}</p>
          <p className="mt-4 font-serif text-[18px] font-bold">{copy.result.paywall_price}</p>
          {/* TODO: 실제 연동 — 토스 결제(1,900원) + 결제 후 유료 리포트(4~8번, D 프롬프트) 생성. 결제 전 유료 본문은 만들지 않는다. */}
          <button type="button" disabled className="btn-night mt-4 w-full rounded-full py-3.5 text-[15px] font-bold opacity-60">
            결제는 준비 중이에요
          </button>
        </section>

        <SaveAndRetry id={id} saved={r.saved} copy={copy} nickname={r.nickname} />

        <p className="text-[12px] leading-relaxed text-ink/60">{copy.disclaimer}</p>
      </div>
    </main>
  );
}

function SaveAndRetry({ id, saved: initiallySaved, copy, nickname }: { id: string; saved: boolean; copy: Omit<Copy, "cta_chat">; nickname: string }) {
  const [saved, setSaved] = useState(initiallySaved);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      if (!(await getAccessToken())) {
        // 로그인 화면은 아직 이 앱에 없다(owner가 따로 만들 예정) → 같은 계정을 쓰는 쏘웰라에서 로그인하면 쿠키가 공유된다.
        setMsg("쏘웰라 계정으로 로그인하면 이 결과가 마이페이지에 저장돼요. 로그인한 뒤 이 화면으로 돌아와 다시 눌러 주세요.");
        return;
      }
      await api(`/api/tarot/session/${id}/claim`, { key: loadKey(id), body: {} });
      setSaved(true);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {saved ? (
        <p className="text-center text-[14px] text-card-line">내 계정에 저장된 결과예요. 쏘웰라 마이페이지에서 다시 볼 수 있어요.</p>
      ) : (
        <button type="button" disabled={busy} onClick={save} className="w-full rounded-full border border-navy py-3.5 text-[15px] text-navy disabled:opacity-60">
          {copy.result.save}
        </button>
      )}
      {msg && (
        <p className="text-center text-[13px] leading-relaxed text-ink/70">
          {msg}{" "}
          <a href={SOWELLA_URL} target="_blank" rel="noreferrer" className="text-navy underline">
            쏘웰라에서 로그인하기
          </a>
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          try {
            const p = JSON.parse(sessionStorage.getItem("ssol_tarot_profile") ?? "null");
            sessionStorage.setItem("ssol_tarot_again", JSON.stringify({ nickname: p?.nickname ?? nickname, experience: p?.experience ?? "returning" }));
          } catch {
            /* 무시 — 처음부터 시작 */
          }
          router.push("/");
        }}
        className="w-full rounded-full bg-navy py-3.5 text-[15px] text-white"
      >
        {copy.result.retry}
      </button>
    </div>
  );
}
