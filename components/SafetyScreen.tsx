"use client";

import Link from "next/link";
import { clean } from "@/lib/client/text";
import type { Copy } from "./TarotFlow";

export function SafetyScreen({ copy }: { copy: Pick<Copy, "safety"> }) {
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
        <p className="mt-4 text-[15px] leading-relaxed">{s.urgent_body}</p>
        <ul className="mt-6 flex flex-col gap-3">
          {s.urgent_contacts.map((c) => {
            const label = (
              <span>
                <span className="block text-[15px] font-bold text-card-line">{c.name}</span>
                {clean(c.note) && <span className="block text-[12px] text-ink/60">{clean(c.note)}</span>}
              </span>
            );
            // 링크가 있으면(카카오톡 마들랜) 새 창으로, 아니면 전화 걸기
            if (c.url)
              return (
                <li key={c.name}>
                  <a href={c.url} target="_blank" rel="noreferrer" className={box}>
                    {label}
                    <span className="text-[14px] font-bold text-navy">열기 ›</span>
                  </a>
                </li>
              );
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
        {s.urgent_emergency && (
          <a href="tel:119" className="mt-5 block text-center text-[15px] font-bold text-card-line">
            {s.urgent_emergency}
          </a>
        )}
        <Link href="/" className="mt-6 block w-full rounded-full border border-navy py-3.5 text-center text-[15px] text-navy">
          처음으로
        </Link>
      </div>
    </main>
  );
}
