// 카드별 공개 소개 페이지 /cards, /cards/{slug} (owner 2026-11-15 — SEO, "카드마다 따로 페이지", 문장은 검수 완료).
// 문장은 모두 data/tarot_data.json의 카드 데이터에서 가져온다(결과 화면과 같은 문장 — 여기서 새로 쓰지 않음).
// 넣지 않는 것: 결제 리포트에 들어가는 카드별 처방·실천(direct·practices)·성향(tendency)·변화 신호(signs)·깊이 읽기(deep) —
//   무료로 다 풀면 결제 리포트와 겹친다. 자리별 해석(positions)도 결과 화면 고유 문장이라 넣지 않는다.
// "운명"은 화면·메타에 쓰지 않는 원칙(CLAUDE.md 2장)이라 원래 카드 이름 '운명의 수레바퀴'는 '수레바퀴'로 쓴다(카드 데이터 about 문장과 같은 표기).
import data from "../../data/tarot_data.json" with { type: "json" };

type Basic = { keywords?: string[]; desc?: string; overview?: string };
type RawCard = {
  no: number; id: string; arcana: string; name: string; character: string; keywords: string[]; core: string;
  basic?: Basic; about_when?: string; about_origin?: string; asks?: string[];
  image: { file: string };
  reversed?: { core?: string; basic?: Basic; asks?: string[] };
};

export type CardSide = { core: string; keywords: string[]; overview: string; desc: string; asks: string[] };
export type CardPage = {
  no: number; slug: string; name: string; character: string; arcanaKo: string; arcanaEn: string;
  image: string; when: string; origin: string; upright: CardSide; reversed: CardSide;
};

export const CARDS_PATH = "/cards";
const FORBIDDEN = /운명|예언|맞힌다|맞혀/;

export function arcanaParts(arcana: string): { ko: string; en: string } {
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(arcana);
  const ko = (m ? m[1] : arcana).replace(/^운명의\s*/, "");
  return { ko, en: m ? m[2] : "" };
}

export function slugOf(arcanaEn: string): string {
  return arcanaEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const side = (core: string | undefined, b: Basic | undefined, asks: string[] | undefined, fallbackKw: string[]): CardSide => ({
  core: core || "",
  keywords: b?.keywords?.length ? b.keywords : fallbackKw,
  overview: b?.overview || "",
  desc: b?.desc || "",
  asks: asks || [],
});

export const CARD_PAGES: CardPage[] = (data.cards as unknown as RawCard[]).map((c) => {
  const { ko, en } = arcanaParts(c.arcana);
  return {
    no: c.no, slug: slugOf(en) || c.id, name: c.name, character: c.character, arcanaKo: ko, arcanaEn: en,
    image: `/images/tarot/${c.image.file}`,
    when: c.about_when || "", origin: c.about_origin || "",
    upright: side(c.core, c.basic, c.asks, c.keywords),
    reversed: side(c.reversed?.core, c.reversed?.basic, c.reversed?.asks, []),
  };
});

export const cardBySlug = (slug: string) => CARD_PAGES.find((c) => c.slug === slug) || null;
export const neighbors = (c: CardPage) => ({
  prev: CARD_PAGES[(c.no + CARD_PAGES.length - 1) % CARD_PAGES.length],
  next: CARD_PAGES[(c.no + 1) % CARD_PAGES.length],
});

export const cardTitle = (c: CardPage) => `${c.no}번 ${c.name} — 타로 '${c.arcanaKo}' 카드 뜻(정방향·역방향) | 쏠 타로 하우스`;
export const cardH1 = (c: CardPage) => `${c.no}번 ${c.name}`;
export const cardDescription = (c: CardPage) =>
  `타로 ${c.arcanaKo}(${c.arcanaEn}) 카드를 ${c.character}로 그린 쏠 타로 하우스의 '${c.name}'. ${c.upright.overview || c.upright.core}`.slice(0, 160);

// 2026-11-16 owner: '바다 친구들 카드 모아 보기'는 빼고, 타로 리더들이 흔히 쓰는 방식(메이저 22장·셔플·3장 배열)이라는 점을
// 앞에 — "타로, 타로 방식, 타로 셔플, 타로 셔플법" 검색을 겨냥. 셔플 방법 자체는 따로 /tarot-shuffle 페이지(lib/guide/shuffle.ts).
export const INDEX_TITLE = "타로 카드 22장 뜻 — 메이저 아르카나 정방향·역방향 해석 | 쏠 타로 하우스";
export const INDEX_H1 = "타로 카드 22장의 뜻";
export const INDEX_DESC =
  "타로 리더들이 흔히 쓰는 메이저 아르카나 22장(0번 바보부터 21번 세계까지)의 정방향·역방향 뜻을 정리했어요. 셔플한 카드에서 세 장을 골라 과거·현재·미래로 읽는 일반적인 방식 그대로, 카드마다 스스로에게 던져 볼 질문도 함께 볼 수 있어요.";

/** 카드 페이지 구조화 데이터 — 화면에 보이는 글과 같은 값만. 가격·후기는 넣지 않는다. */
export function cardJsonLd(site: string, c: CardPage) {
  const url = `${site}${CARDS_PATH}/${c.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage", "@id": `${url}#page`, url, name: cardTitle(c), description: cardDescription(c), inLanguage: "ko-KR",
        primaryImageOfPage: `${site}${c.image}`, isPartOf: { "@id": `${site}${CARDS_PATH}#page` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "쏠 타로 하우스", item: `${site}/` },
          { "@type": "ListItem", position: 2, name: "카드 22장", item: `${site}${CARDS_PATH}` },
          { "@type": "ListItem", position: 3, name: c.name, item: url },
        ],
      },
    ],
  };
}

export function indexJsonLd(site: string) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage", "@id": `${site}${CARDS_PATH}#page`, url: `${site}${CARDS_PATH}`, name: INDEX_TITLE, description: INDEX_DESC, inLanguage: "ko-KR",
    hasPart: CARD_PAGES.map((c) => ({ "@type": "WebPage", url: `${site}${CARDS_PATH}/${c.slug}`, name: c.name })),
  };
}

/** 이 페이지에 실리는 모든 글(테스트용) */
export function cardTexts(c: CardPage): string[] {
  const s = (x: CardSide) => [x.core, x.overview, x.desc, ...x.keywords, ...x.asks];
  return [cardTitle(c), cardH1(c), cardDescription(c), c.when, c.origin, c.arcanaKo, ...s(c.upright), ...s(c.reversed)];
}
export const hasForbidden = (t: string) => FORBIDDEN.test(t);
