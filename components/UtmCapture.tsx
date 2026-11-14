"use client";
// 광고 소재(UTM) 받아 두기(owner 2026-11-14). 주소에 utm_source가 있으면 브라우저에 30일 보관하고(새 광고 주소로 오면 바꿈),
// 같은 탭 묶음에서 같은 광고 값은 한 번만 방문으로 센다. 고민·이름 같은 정보는 다루지 않는다. 저장소를 못 쓰면 조용히 넘어간다.
import { useEffect } from "react";
import { UTM_STORE_KEY, utmFromSearch, utmKey } from "@/lib/tarot-glue/utm";

export default function UtmCapture() {
  useEffect(() => {
    const utm = utmFromSearch(window.location.search);
    if (!utm) return;
    try {
      localStorage.setItem(UTM_STORE_KEY, JSON.stringify({ utm, at: Date.now() }));
      const seen = `${UTM_STORE_KEY}_visit:${utmKey(utm)}`;
      if (sessionStorage.getItem(seen)) return;
      sessionStorage.setItem(seen, "1");
    } catch {
      return;
    }
    void fetch("/api/tarot/utm-visit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ utm }), keepalive: true }).catch(() => {});
  }, []);
  return null;
}
