// 언어(locale) — 한국어판은 주소 그대로(/…), 영문판은 /en 아래(/en/…). 화면마다 같은 이름의 주소를 쓴다(owner 2026-11-05).
export type Locale = "ko" | "en";
export const LOCALES: readonly Locale[] = ["ko", "en"] as const;
export const isLocale = (v: unknown): v is Locale => v === "ko" || v === "en";
/** 모르는 값은 한국어(기존 동작) — DB에 locale 칸이 없던 예전 결과도 한국어. */
export const toLocale = (v: unknown): Locale => (v === "en" ? "en" : "ko");

export const prefixOf = (l: Locale) => (l === "en" ? "/en" : "");

/** 한국어 경로("/worry", "/result/x/3")를 그 언어의 주소로. 바깥 주소·#·? 는 건드리지 않음. */
export function localePath(path: string, l: Locale): string {
  if (l === "ko" || !path.startsWith("/") || path.startsWith("//")) return path;
  if (path === "/en" || path.startsWith("/en/") || path.startsWith("/en?") || path.startsWith("/en#")) return path;
  if (path === "/") return "/en";
  if (path.startsWith("/?") || path.startsWith("/#")) return `/en${path.slice(1)}`;
  return `/en${path}`;
}

/** "/en/worry" → { locale: "en", path: "/worry" }, "/worry" → { locale: "ko", path: "/worry" } */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  if (pathname === "/en") return { locale: "en", path: "/" };
  if (pathname.startsWith("/en/")) return { locale: "en", path: pathname.slice(3) };
  return { locale: "ko", path: pathname };
}
