"use client";

// 카카오톡 카드 공유(그림·제목·버튼) — 쏠 아스트로 하우스(components/share/kakaoShare.ts)와 같은 방법.
// 카카오 JavaScript SDK + JavaScript 키(NEXT_PUBLIC_KAKAO_JS_KEY, 공개돼도 되는 키). 키가 없거나, 카카오 개발자센터에
// 이 사이트 도메인이 등록되지 않았거나, SDK를 못 불러오면 false — 그때는 기기 공유창·링크 복사로 넘어간다.
const JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
const SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";

interface KakaoSdk {
  isInitialized(): boolean;
  init(key: string): void;
  Share: { sendDefault(settings: Record<string, unknown>): void };
}
declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

let loading: Promise<KakaoSdk | null> | null = null;

function loadKakao(): Promise<KakaoSdk | null> {
  if (!JS_KEY) return Promise.resolve(null);
  loading ??= new Promise((resolve) => {
    const ready = () => {
      const k = window.Kakao;
      if (!k) return resolve(null);
      try {
        if (!k.isInitialized()) k.init(JS_KEY);
        resolve(k);
      } catch {
        resolve(null);
      }
    };
    if (window.Kakao) return ready();
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = ready;
    s.onerror = () => {
      loading = null; // 다음에 다시 시도
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** 공유 창을 열 때 미리 불러 둔다(버튼을 누른 순간 바로 카카오톡이 열리게). */
export function preloadKakao(): void {
  void loadKakao();
}

/** 카드 보내기. 됐으면 true. */
export async function shareKakaoCard(c: { title: string; description: string; imageUrl: string; url: string; button: string }): Promise<boolean> {
  const k = await loadKakao();
  if (!k) return false;
  try {
    const link = { mobileWebUrl: c.url, webUrl: c.url };
    k.Share.sendDefault({
      objectType: "feed",
      content: { title: c.title, description: c.description, imageUrl: c.imageUrl, imageWidth: 800, imageHeight: 800, link },
      buttons: [{ title: c.button, link }],
    });
    return true;
  } catch {
    return false;
  }
}
