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

type Item = { id: string; nickname: string; createdAt: string; cards: ResultCard[] };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });

export default function ResultsList() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!(await getRealSession())) {
        router.replace("/login?next=/results");
        return;
      }
      try {
        const r = await api<{ results: Item[] }>("/api/tarot/results");
        if (alive) setItems(r.results);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return router.replace("/login?next=/results");
        if (alive) setErr(e instanceof ApiError ? e.message : "잠시 후 다시 시도해 주세요.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  return (
    <main className="night-bg relative flex min-h-dvh flex-col overflow-x-hidden">
      <Stars />
      <div className="relative z-[1] mx-auto w-full max-w-md flex-1 px-6 pb-10 pt-7">
        <Link href="/" className="text-[13px] text-moon/80">
          ← 처음으로
        </Link>
        <h1 className="mt-6 font-serif text-[24px] font-bold text-gold-soft">내 타로 결과</h1>
        <p className="mt-1 text-[14px] text-moon/80">지금까지 뽑은 카드를 다시 볼 수 있어요.</p>

        {err && <p className="mt-8 text-[14px] text-gold-soft" role="alert">{err}</p>}
        {!err && items === null && <p className="mt-8 text-[14px] text-moon/70">불러오는 중…</p>}
        {items && items.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-5 text-center">
            <p className="text-[15px] text-moon/85">아직 저장된 결과가 없어요.</p>
            <Link href="/?start=1" className="btn-night block w-full rounded-full py-3.5 text-center text-[15px] font-medium">
              타로 보기
            </Link>
          </div>
        )}
        {items && items.length > 0 && (
          <ul className="mt-6 flex flex-col gap-3">
            {items.map((it) => (
              <li key={it.id}>
                <Link href={`/result/${it.id}`} className="flex items-center gap-4 rounded-2xl border border-gold/40 bg-night-deep/60 p-3">
                  <div className="flex shrink-0 gap-1">
                    {it.cards.map((c) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={c.position}
                        {...cardImg(c.image, "40px")}
                        alt={`${c.positionName}: ${c.name}${c.reversed ? " (역방향)" : ""}`}
                        className={`h-[60px] w-10 rounded-[4px] object-cover ${c.reversed ? "rotate-180" : ""}`}
                        loading="lazy"
                      />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-[12px] text-gold">{fmtDate(it.createdAt)}</p>
                    <p className="mt-0.5 truncate font-serif text-[15px] text-moon">{it.cards.map((c) => c.name).join(" · ")}</p>
                  </div>
                  <span className="text-[13px] text-moon/70" aria-hidden>›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <PageFoot />
    </main>
  );
}
