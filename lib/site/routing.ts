// 한국어 사이트(tarot.)와 영문 사이트(en.tarot.) 사이 주소 고르기(owner 2026-11-08).
// 두 사이트는 GitHub 저장소·Vercel 프로젝트만 따로이고 코드·Supabase는 같다 — 어느 사이트인지는 접속한 주소(host)로 정한다.
// proxy.ts가 이 순수 함수만 부른다(테스트: routing.test.ts).
//   영문 사이트: 영문 화면은 /en 아래에 있으므로 다른 주소는 /en…으로 보낸다(화면 코드가 주소의 /en으로 언어를 알아본다).
//                영문판이 닫혀 있으면(EN_PAGES_HIDDEN) 한국어 사이트로 보낸다.
//   한국어 사이트: 해외 IP가 첫 화면(/, /about)으로 들어오면 영문 사이트로 — 단 '한국어로 보기'(?lang=ko)를 누른 기기(쿠키)와
//                검색 로봇은 보내지 않는다(검색엔진은 미국 IP라 보내면 한국어 페이지가 검색에서 사라짐).
//                결과·결제·로그인 같은 다른 주소는 보내지 않는다(해외에 있는 한국어 사용자의 결과·결제가 끊기지 않게).
export const KO_HOST = "tarot.ssolwellnesshouse.com";
export const EN_HOST = "en.tarot.ssolwellnesshouse.com";
export const LANG_COOKIE = "tarot_lang";

const BOT = /bot|crawl|spider|slurp|yeti|daum|facebookexternalhit|kakaotalk-scrap|preview|lighthouse|headless/i;
const isEnPath = (p: string) => p === "/en" || p.startsWith("/en/");
/** 영문 사이트에서 첫 화면으로 보낼 한국어 첫 화면 주소 */
const GEO_ENTRY = new Set(["/", "/about"]);

export type RouteInput = {
  host: string;
  pathname: string;
  search: string; // "?a=b" 또는 ""
  country: string | null; // Vercel x-vercel-ip-country (모르면 null)
  langCookie: string | null;
  userAgent: string;
  method: string;
  enOpen: boolean; // 영문판 공개 여부(!EN_PAGES_HIDDEN)
};
export type RouteResult =
  | { kind: "next" }
  | { kind: "redirect"; url: string; status: 307 | 308; setLangKo?: boolean; noStore?: boolean };

const withSearch = (search: string, drop?: string) => {
  if (!drop || !search) return search;
  const q = new URLSearchParams(search);
  q.delete(drop);
  const s = q.toString();
  return s ? `?${s}` : "";
};

export function routeRequest(r: RouteInput): RouteResult {
  if (r.method !== "GET" && r.method !== "HEAD") return { kind: "next" };
  const host = r.host.toLowerCase().split(":")[0];

  if (host === EN_HOST) {
    if (!r.enOpen) {
      // 영문판 닫힘 → 한국어 사이트 첫 화면(영문 결과·결제 주소도 한국어판에선 열리지 않으므로 첫 화면으로)
      return { kind: "redirect", url: `https://${KO_HOST}/?lang=ko`, status: 307, noStore: true };
    }
    if (isEnPath(r.pathname)) return { kind: "next" };
    if (r.pathname === "/about" || r.pathname === "/legal") return { kind: "redirect", url: `/en${r.search}`, status: 307 };
    return { kind: "redirect", url: `/en${r.pathname === "/" ? "" : r.pathname}${r.search}`, status: 308 };
  }

  if (host !== KO_HOST) return { kind: "next" }; // localhost·*.vercel.app 미리보기는 그대로

  // '한국어로 보기' — 이 기기는 앞으로 영문 사이트로 보내지 않는다
  const q = new URLSearchParams(r.search);
  if (q.get("lang") === "ko") {
    return { kind: "redirect", url: `${r.pathname}${withSearch(r.search, "lang")}`, status: 307, setLangKo: true, noStore: true };
  }
  if (!r.enOpen) return { kind: "next" }; // 영문판 닫힘: 아무도 보내지 않음(/en은 레이아웃이 한국어 첫 화면으로)
  // 예전 영문 주소(tarot./en/…)는 영문 사이트의 같은 주소로
  if (isEnPath(r.pathname)) return { kind: "redirect", url: `https://${EN_HOST}${r.pathname}${r.search}`, status: 308 };
  // 해외 IP의 첫 방문
  if (
    GEO_ENTRY.has(r.pathname) &&
    r.country &&
    r.country.toUpperCase() !== "KR" &&
    r.langCookie !== "ko" &&
    !BOT.test(r.userAgent)
  ) {
    return { kind: "redirect", url: `https://${EN_HOST}/en${withSearch(r.search, "lang")}`, status: 307, noStore: true };
  }
  return { kind: "next" };
}

/** 영문 화면의 '한국어로 보기' 주소 */
export const KO_SWITCH_URL = `https://${KO_HOST}/?lang=ko`;
