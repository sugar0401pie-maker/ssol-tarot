import type { Metadata } from "next";
import Link from "next/link";
import { EN_BUSINESS as B } from "@/lib/legal/en";
import SiteFooterEn from "@/components/SiteFooterEn";

// Imprint (Impressum) — 기획 08 문서 6장(독일 DDG §5용 사업자 정보). 내용은 lib/legal/en.ts 한 곳.
export const metadata: Metadata = { title: "Imprint — SSOL Tarot House" };
export const dynamic = "force-static";

export default function EnImprintPage() {
  const rows: [string, string][] = [
    ["Business name", B.name],
    ["Representative", B.representative],
    ["Business registration no.", B.businessNo],
    ["Mail-order business registration no.", B.mailOrderNo],
    ["Address", B.address],
    ["Phone", B.phone],
    ["Email", B.email],
  ];
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <Link href="/en" className="text-[13px] text-moon/70">
        ← Back to start
      </Link>
      <h1 className="mt-3 text-[20px] font-bold text-moon">Imprint (Impressum)</h1>
      <div className="mt-5 rounded-2xl bg-card-cream px-5 py-6 text-navy">
        <p className="text-[14px] leading-6 text-navy/85">SSOL Tarot House is a service of {B.name}.</p>
        <dl className="mt-4 space-y-3 text-[14px] leading-6">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="font-semibold">{k}</dt>
              <dd className="text-navy/85">{k === "Email" ? <a href={`mailto:${v}`} className="underline">{v}</a> : v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="page-foot">
        <SiteFooterEn />
      </div>
    </main>
  );
}
