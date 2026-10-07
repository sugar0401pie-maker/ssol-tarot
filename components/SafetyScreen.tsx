"use client";

import Link from "next/link";
import { clean } from "@/lib/client/text";
import type { Copy } from "./TarotFlow";

export function SafetyScreen({ copy }: { copy: Pick<Copy, "safety"> }) {
  // 위기 신호: 카드·결제 화면으로 넘어가지 않는다. 아침 화면, 신비 연출 없이 연락처가 먼저 보이게(디자인 가이드 5장).
  const s = copy.safety;
  return (
    <main className="dawn-bg flex min-h-dvh flex-col items-center px-6 py-14">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-[22px] font-bold leading-snug text-card-line">{s.urgent_title}</h1>
        <p className="mt-4 text-[15px] leading-relaxed">{s.urgent_body}</p>
        <ul className="mt-6 flex flex-col gap-3">
          {s.urgent_contacts.map((c) => {
            const first = c.number.split("/")[0].trim();
            return (
              <li key={c.name}>
                <a href={`tel:${first.replace(/[^0-9]/g, "")}`} className="flex items-center justify-between rounded-2xl border border-card-line/30 bg-white px-4 py-4">
                  <span>
                    <span className="block text-[15px] font-bold text-card-line">{c.name}</span>
                    {clean(c.note) && <span className="block text-[12px] text-ink/60">{clean(c.note)}</span>}
                  </span>
                  <span className="text-[18px] font-bold text-navy">{c.number}</span>
                </a>
              </li>
            );
          })}
        </ul>
        <a href="https://ssolwellness.com" target="_blank" rel="noreferrer" className="mt-6 block w-full rounded-full bg-navy py-3.5 text-center text-[15px] font-medium text-white">
          {s.urgent_cta}
        </a>
        <Link href="/" className="mt-3 block w-full rounded-full border border-navy py-3.5 text-center text-[15px] text-navy">
          처음으로
        </Link>
      </div>
    </main>
  );
}
