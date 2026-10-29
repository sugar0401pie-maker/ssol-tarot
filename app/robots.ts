import type { MetadataRoute } from "next";
import { STEP_PATH } from "@/lib/client/steps";

// 검색엔진 안내(owner 2026-10-29). 공개 화면(첫 화면·약관)만 검색에 나오게 하고,
// 결과·내 결과·결제·로그인·API와 테스트 중간 화면(주소로 바로 들어오면 첫 단계부터라 검색에 나올 이유가 없음)은 막는다.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tarot.ssolwellnesshouse.com";

export default function robots(): MetadataRoute.Robots {
  const steps = Object.values(STEP_PATH).filter((p) => p !== "/");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/result", "/checkout", "/login", ...steps] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
