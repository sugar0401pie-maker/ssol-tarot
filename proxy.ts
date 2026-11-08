import { NextResponse, type NextRequest } from "next/server";
import { EN_PAGES_HIDDEN } from "@/lib/i18n/enAccess";
import { LANG_COOKIE, routeRequest } from "@/lib/site/routing";

// 한국어 사이트 ↔ 영문 사이트 주소 고르기(판단은 lib/site/routing.ts — 테스트 있음).
export function proxy(req: NextRequest) {
  const d = routeRequest({
    host: req.headers.get("host") ?? "",
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
    country: req.headers.get("x-vercel-ip-country"),
    langCookie: req.cookies.get(LANG_COOKIE)?.value ?? null,
    userAgent: req.headers.get("user-agent") ?? "",
    method: req.method,
    enOpen: !EN_PAGES_HIDDEN,
  });
  if (d.kind === "next") return NextResponse.next();
  const res = NextResponse.redirect(new URL(d.url, req.url), d.status);
  if (d.noStore) res.headers.set("Cache-Control", "private, no-store");
  if (d.setLangKo) res.cookies.set(LANG_COOKIE, "ko", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: true });
  return res;
}

// 페이지 주소만(API·정적 파일·그림·아이콘 제외)
export const config = {
  matcher: ["/((?!api|_next|images|favicon|icon|apple-icon|opengraph-image|robots.txt|sitemap.xml|.*\\.[a-zA-Z0-9]+$).*)"],
};
