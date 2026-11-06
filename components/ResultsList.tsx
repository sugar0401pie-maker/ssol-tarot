"use client";

// 내 결과(/results) — 첫 화면 [이전 결과 보기]와 하단 '내 결과'가 오는 곳(owner 2026-10-21, 아스트로 /results와 같은 역할).
// 로그인해야 볼 수 있다(아니면 로그인 화면을 거쳐 돌아옴). 목록에는 날짜·카드 세 장만 — 고민 글은 보여 주지 않는다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, type ResultCard } from "@/lib/client/api";
import { cardImg } from "@/lib/client/cardImage";
import { getRealSession } from "@/lib/supabase/browser";
import { Stars } from "./Cards";
import PageFoot from "./PageFoot";
import { localePath, type Locale } from "@/lib/i18n/locale";
import { uiText } from "@/lib/i18n/ui";

type Item = { id: string; nickname: string; createdAt: string; paid?: boolean; locale?: Locale; cards: ResultCard[] };

const fmtDate = (iso: string, dateLocale: string) =>
  new Date(iso).toLocaleDateString(dateLocale, { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });

// 영문판(/en/results, 2026-11-06)은 같은 목록에 영어 문구. 각 결과는 만든 언어의 결과 주소로 연다.
export default function ResultsList({ locale = "ko" }: { locale?: Locale }) {
  const T = uiText(locale).results;
  const rev = uiText(locale).result.reversed;
  const L = (path: string) => localePath(path, locale);
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!(await getRealSession())) {
        router.replace(`${L("/login")}?next=${L("/results")}`);
        return;
      }
      try {
        const r = await api<{ results: Item[] }>("/api/tarot/results");
        if (alive) setItems(r.results);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return router.replace(`${L("/login")}?next=${L("/results")}`);
        if (alive) setErr(e instanceof ApiError ? e.message : uiText(locale).retryLater);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 언어는 화면마다 고정
  }, [router]);

  return (
    <main className="night-bg relative flex min-h-dvh flex-col overflow-x-hidden">
      <Stars />
      <div className="relative z-[1] mx-auto w-full max-w-md flex-1 px-6 pb-10 pt-7">
        <Link href={L("/")} className="text-[13px] text-moon/80">
          {T.home}
        </Link>
        <h1 className="mt-6 font-serif text-[24px] font-bold text-gold-soft">{T.title}</h1>
        <p className="mt-1 text-[14px] text-moon/80">{T.sub}</p>

        {err && <p className="mt-8 text-[14px] text-gold-soft" role="alert">{err}</p>}
        {!err && items === null && <p className="mt-8 text-[14px] text-moon/70">{T.loading}</p>}
        {items && items.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-5 text-center">
            <p className="text-[15px] text-moon/85">{T.empty}</p>
            <Link href={`${L("/")}?start=1`} className="btn-night block w-full rounded-full py-3.5 text-center text-[15px] font-medium">
              {T.start}
            </Link>
          </div>
        )}
        {items && items.length > 0 && (
          <ul className="mt-6 flex flex-col gap-3">
            {items.map((it) => (
              <li key={it.id}>
                <Link href={localePath(`/result/${it.id}`, it.locale === "en" ? "en" : "ko")} className="flex items-center gap-4 rounded-2xl border border-gold/40 bg-night-deep/60 p-3">
                  <div className="flex shrink-0 gap-1">
                    {it.cards.map((c) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={c.position}
                        {...cardImg(c.image, "40px")}
                        alt={c.hidden ? `${c.positionName}: ${T.hidden}` : `${c.positionName}: ${c.name}${c.reversed ? ` (${rev})` : ""}`}
                        className={`h-[60px] w-10 rounded-[4px] object-cover ${c.reversed ? "rotate-180" : ""}`}
                        loading="lazy"
                      />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    {/* 결제한 결과는 날짜 위에 둥근 표시(owner 2026-10-22) */}
                    {it.paid && <span className="mb-1 inline-block rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-bold text-night-deep">{T.paid}</span>}
                    <p className="text-[12px] text-gold">{fmtDate(it.createdAt, T.dateLocale)}</p>
                    <p className="mt-0.5 truncate font-serif text-[15px] text-moon">{it.cards.map((c) => (c.hidden ? "?" : c.name)).join(" · ")}</p>
                  </div>
                  <span className="text-[13px] text-moon/70" aria-hidden>›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <PageFoot locale={locale} />
    </main>
  );
}
