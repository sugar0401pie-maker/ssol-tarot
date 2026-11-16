import { test } from "node:test";
import assert from "node:assert/strict";
import { metaPixelId, DEFAULT_META_PIXEL_ID } from "./metaPixel.ts";

test("메타 픽셀 ID: 환경 변수 없으면 owner 픽셀(기본값), 숫자만 — 이상하면 불러오지 않음", () => {
  const old = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
  assert.equal(metaPixelId(), DEFAULT_META_PIXEL_ID);
  assert.equal(DEFAULT_META_PIXEL_ID, "28980812814878410");
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "1234567890123456";
  assert.equal(metaPixelId(), "1234567890123456");
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "abc');alert(1)//";
  assert.equal(metaPixelId(), null);
  if (old === undefined) delete process.env.NEXT_PUBLIC_META_PIXEL_ID; else process.env.NEXT_PUBLIC_META_PIXEL_ID = old;
});
