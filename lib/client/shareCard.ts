// 공유 카드 내용(순수 함수, 테스트 있음). 카드 이름·그림만 담는다 — 고민 원문·닉네임·해석 문장·결과 주소는 넣지 않는다
// (결과 주소는 본인만 열 수 있어 공유하지 않고, 사이트 첫 화면 주소를 공유한다).
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tarot.ssolwellnesshouse.com";

export type ShareCopy = { kakao_title: string; kakao_desc: string; kakao_desc_decision: string; button: string };

/** 카카오 카드 그림: 세 번째 카드(앞으로의 열쇠). /images/tarot/card-14-between.webp → /images/tarot/kakao/card-14-between(-rev).jpg */
export function kakaoImagePath(cardImage: string, reversed: boolean): string {
  const file = cardImage.split("/").pop()!.replace(/\.webp$/, "");
  return `/images/tarot/kakao/${file}${reversed ? "-rev" : ""}.jpg`;
}

export type ShareChannel = "kakao" | "link_copy" | "device" | "naver_blog" | "x" | "instagram" | "youtube";

export function shareUrl(channel: ShareChannel, site = SITE_URL): string {
  return `${site}/?utm_source=${channel}&utm_medium=share`;
}

export function shareCard(c: ShareCopy, third: { name: string; image: string; reversed: boolean }, decision: boolean, site = SITE_URL) {
  return {
    title: c.kakao_title.replace("{card}", third.name),
    description: decision ? c.kakao_desc_decision : c.kakao_desc,
    imageUrl: site + kakaoImagePath(third.image, third.reversed),
    url: shareUrl("kakao", site),
    button: c.button,
  };
}

/** 공유 이미지·글에 들어가는 글자(카드 이름·위치·사이트만 — 공유 카드 규칙 copy.share_card.rule). */
export function shareImageTexts(third: { name: string; reversed: boolean; positionName: string }) {
  return {
    name: third.name,
    line: `내 ${third.positionName}${third.reversed ? " · 역방향" : ""}`,
    foot: `쏠 타로 하우스 · ${SITE_URL.replace(/^https?:\/\//, "")}`,
  };
}

/** SNS 글(카드 이름 + 첫 화면 안내). 고민·닉네임 없음. */
export function shareMessage(c: ShareCopy, third: { name: string }, decision: boolean): string {
  return `${c.kakao_title.replace("{card}", third.name)}\n${(decision ? c.kakao_desc_decision : c.kakao_desc).replace("\n", " ")}`;
}
