import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { kakaoImagePath, shareCard, shareUrl } from "./shareCard.ts";

const data = JSON.parse(fs.readFileSync(new URL("../../data/tarot_data.json", import.meta.url), "utf8"));
const C = data.copy.share_card;

test("공유 카드 = 세 번째 카드 이름·그림 + 사이트 첫 화면 주소(결과 주소·고민·닉네임 없음)", () => {
  const c = shareCard(C, { name: "물과 뭍 사이", image: "/images/tarot/card-14-between.webp", reversed: false }, true, "https://t.example");
  assert.equal(c.title, "내 앞으로의 열쇠는 ‘물과 뭍 사이’");
  assert.equal(c.imageUrl, "https://t.example/images/tarot/kakao/card-14-between.jpg");
  assert.equal(c.url, "https://t.example/?utm_source=kakao&utm_medium=share");
  assert.equal(c.description, C.kakao_desc_decision);
  assert.ok(!JSON.stringify(c).includes("/result/"));
  assert.equal(shareCard(C, { name: "x", image: "/images/tarot/card-14-between.webp", reversed: false }, false).description, C.kakao_desc);
  assert.equal(shareUrl("link_copy", "https://t.example"), "https://t.example/?utm_source=link_copy&utm_medium=share");
});

test("역방향이면 돌린 그림, 모든 카드의 공유 그림 파일이 있다", () => {
  assert.equal(kakaoImagePath("/images/tarot/card-11-balance.webp", true), "/images/tarot/kakao/card-11-balance-rev.jpg");
  for (const card of data.cards)
    for (const rev of [false, true]) {
      const p = kakaoImagePath(`/images/tarot/${card.image.file}`, rev);
      assert.ok(fs.existsSync(new URL(`../../public${p}`, import.meta.url)), p);
    }
});

test("공유 이미지 글자와 SNS 글: 카드 이름·위치·사이트만", async () => {
  const { shareImageTexts, shareMessage, shareUrl } = await import("./shareCard.ts");
  const t = shareImageTexts({ name: "물과 뭍 사이", reversed: true, positionName: "앞으로의 열쇠" });
  assert.equal(t.name, "물과 뭍 사이");
  assert.equal(t.line, "내 앞으로의 열쇠 · 역방향");
  assert.match(t.foot, /^쏠 타로 하우스 · tarot\.ssolwellnesshouse\.com$/);
  const m = shareMessage({ kakao_title: "내 앞으로의 열쇠는 ‘{card}’", kakao_desc: "고민을 비추는 웰니스 타로,\n나도 세 장을 뽑아 보세요.", kakao_desc_decision: "x", button: "b" }, { name: "물과 뭍 사이" }, false);
  assert.equal(m, "내 앞으로의 열쇠는 ‘물과 뭍 사이’\n고민을 비추는 웰니스 타로, 나도 세 장을 뽑아 보세요.");
  assert.equal(shareUrl("naver_blog", "https://t.example"), "https://t.example/?utm_source=naver_blog&utm_medium=share");
});
