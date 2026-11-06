"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clean } from "@/lib/client/text";
import type { Copy } from "./TarotFlow";
import { fillHelplines, helplinesFor, telOf, type Helplines } from "@/lib/safety/helplinesEn";
import type { Locale } from "@/lib/i18n/locale";

// 영문판: 데이터 문구의 {crisis_line} 등을 접속 국가의 번호로(lib/safety/helplinesEn.ts — 전문가 확인 전 초안).
// 국가를 받기 전·실패하면 국제 안내(findahelpline.com, 지역 응급 번호)로 바로 보인다 — 기다리느라 비어 있지 않게.
export function useHelplines(on: boolean): Helplines {
  const [h, setH] = useState<Helplines>(() => helplinesFor(null));
  useEffect(() => {
    if (!on) return;
    fetch("/api/tarot/helplines", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setH(helplinesFor(j?.country ?? null)))
      .catch(() => {});
  }, [on]);
  return h;
}

export function SafetyScreen({ copy, locale = "ko" }: { copy: Pick<Copy, "safety">; locale?: Locale }) {
  const en = locale === "en";
  const h = useHelplines(en);
  const f = (t: string) => (en ? fillHelplines(t, h) : t);
  // 위기 신호: 카드·결제 화면으로 넘어가지 않는다. 아침 화면, 신비 연출 없이 연락처가 먼저 보이게(디자인 가이드 5장).
  const s = copy.safety as Copy["safety"] & {
    urgent_contacts: { name: string; number: string; note: string; url?: string }[];
    urgent_emergency?: string;
    urgent_image?: { src: string; alt: string };
  };
  const box = "flex items-center justify-between rounded-2xl border border-card-line/30 bg-white px-4 py-4";
  return (
    <main className="dawn-bg flex min-h-dvh flex-col items-center px-6 py-14">
      <div className="w-full max-w-sm">
        {s.urgent_image && (
          // owner 2026-11-02: 맨 위 그림(삐삐 메시지 "당신은 웃는 모습이 가장 보기 좋답니다")
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.urgent_image.src} alt={s.urgent_image.alt} width={417} height={417} className="mx-auto mb-6 w-full max-w-[280px] rounded-2xl" />
        )}
        <h1 className="font-serif text-[22px] font-bold leading-snug text-card-line">{s.urgent_title}</h1>
        <p className="mt-4 text-[15px] leading-relaxed">{f(s.urgent_body)}</p>
        <ul className="mt-6 flex flex-col gap-3">
          {s.urgent_contacts.map((c) => {
            const label = (
              <span>
                <span className="block text-[15px] font-bold text-card-line">{c.name}</span>
                {clean(c.note) && <span className="block text-[12px] text-ink/60">{f(clean(c.note))}</span>}
              </span>
            );
            // 링크가 있으면(카카오톡 마들랜) 새 창으로, 아니면 전화 걸기
            if (c.url)
              return (
                <li key={c.name}>
                  <a href={c.url} target="_blank" rel="noreferrer" className={box}>
                    {label}
                    <span className="text-[14px] font-bold text-navy">{en ? "Open ›" : "열기 ›"}</span>
                  </a>
                </li>
              );
            if (en) {
              // 영문판: 번호가 있으면 전화로, 없으면(국제 안내) 글만 — 번호 칸은 줄글이라 작게
              const num = f(c.number);
              const tel = telOf(num);
              const inner = (
                <>
                  {label}
                  <span className="ml-3 max-w-[55%] text-right text-[14px] font-bold text-navy">{num}</span>
                </>
              );
              return <li key={c.name}>{tel ? <a href={`tel:${tel}`} className={box}>{inner}</a> : <div className={box}>{inner}</div>}</li>;
            }
            const first = c.number.split("/")[0].trim();
            return (
              <li key={c.name}>
                <a href={`tel:${first.replace(/[^0-9]/g, "")}`} className={box}>
                  {label}
                  <span className="text-[18px] font-bold text-navy">{c.number}</span>
                </a>
              </li>
            );
          })}
        </ul>
        {en ? (
          // 영문판: 나라별 정신건강 도움 찾기(국제 목록) — 데이터 urgent_cta 문구
          (s as { urgent_cta?: string }).urgent_cta && (
            <a href="https://findahelpline.com" target="_blank" rel="noreferrer" className="mt-5 block text-center text-[15px] font-bold text-card-line underline">
              {(s as { urgent_cta?: string }).urgent_cta}
            </a>
          )
        ) : (
          s.urgent_emergency && (
            <a href="tel:119" className="mt-5 block text-center text-[15px] font-bold text-card-line">
              {s.urgent_emergency}
            </a>
          )
        )}
        <Link href={en ? "/en" : "/"} className="mt-6 block w-full rounded-full border border-navy py-3.5 text-center text-[15px] text-navy">
          {en ? "Back to start" : "처음으로"}
        </Link>
      </div>
    </main>
  );
}
