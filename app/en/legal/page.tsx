import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { EN_DOCS } from "@/lib/legal/en";
import { mdToHtml } from "@/lib/legal/md";
import SiteFooterEn from "@/components/SiteFooterEn";
import "./legal.css";

// 영문 약관·정책(owner 2026-11-08). 원문 = docs/policies/en/*.md(기획 초안, 법률 검토 전) — 문서를 고치면 이 페이지가 다시 빌드될 때 반영.
// 각 문서는 /en/legal#<id>(terms·privacy·worry-consent·health-data·cookies·refund·disclaimer).
export const metadata: Metadata = { title: "Terms & Policies — SSOL Tarot House" };
export const dynamic = "force-static";

function load(file: string, id: string) {
  const md = fs.readFileSync(path.join(process.cwd(), "docs/policies/en", file), "utf8");
  return mdToHtml(md, `${id}-`);
}

export default function EnLegalPage() {
  const docs = EN_DOCS.map((d) => ({ ...d, ...load(d.file, d.id) }));
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <Link href="/en" className="text-[13px] text-moon/70">
        ← Back to start
      </Link>
      <h1 className="mt-3 text-[20px] font-bold text-moon">Terms &amp; Policies</h1>
      <div className="legal-en mt-5 rounded-2xl bg-card-cream px-5 py-6 text-navy">
        <nav className="flex flex-wrap gap-2 text-[13px] font-medium">
          {docs.map((d) => (
            <a key={d.id} href={`#${d.id}`} className="rounded-full bg-navy/10 px-3 py-1.5 text-navy">
              {d.label}
            </a>
          ))}
          <Link href="/en/imprint" className="rounded-full bg-navy/10 px-3 py-1.5 text-navy">
            Imprint
          </Link>
        </nav>
        {docs.map((d) => (
          <section key={d.id} id={d.id} className="mt-10 border-t border-navy/15 pt-8">
            <h2 className="text-[18px] font-bold">{d.title}</h2>
            <div dangerouslySetInnerHTML={{ __html: d.html }} />
          </section>
        ))}
      </div>
      <div className="page-foot">
        <SiteFooterEn />
      </div>
    </main>
  );
}
