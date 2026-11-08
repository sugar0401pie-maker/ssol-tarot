import { test } from "node:test";
import assert from "node:assert/strict";
import { EN_HOST, KO_HOST, routeRequest, type RouteInput } from "./routing.ts";

const base: RouteInput = { host: KO_HOST, pathname: "/", search: "", country: "US", langCookie: null, userAgent: "Mozilla/5.0 iPhone", method: "GET", enOpen: true };
const r = (o: Partial<RouteInput>) => routeRequest({ ...base, ...o });

test("한국어 사이트: 해외 IP의 첫 화면·소개는 영문 사이트로(저장 안 함)", () => {
  assert.deepEqual(r({}), { kind: "redirect", url: `https://${EN_HOST}/en`, status: 307, noStore: true });
  assert.equal((r({ pathname: "/about" }) as { url: string }).url, `https://${EN_HOST}/en`);
  assert.equal((r({ search: "?utm_source=x" }) as { url: string }).url, `https://${EN_HOST}/en?utm_source=x`);
});
test("한국어 사이트: 한국 IP·IP 모름·한국어 선택 쿠키·검색 로봇·POST는 그대로", () => {
  for (const o of [{ country: "KR" }, { country: "kr" }, { country: null }, { langCookie: "ko" }, { userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)" }, { userAgent: "Mozilla/5.0 (compatible; Yeti/1.1; NAVER)" }, { userAgent: "facebookexternalhit/1.1" }, { method: "POST" }])
    assert.deepEqual(r(o), { kind: "next" }, JSON.stringify(o));
});
test("한국어 사이트: 결과·결제·로그인 등 다른 주소는 해외 IP여도 그대로", () => {
  for (const p of ["/result/abc/3", "/checkout/abc", "/checkout/success", "/login", "/results", "/legal", "/worry"]) assert.deepEqual(r({ pathname: p }), { kind: "next" }, p);
});
test("한국어 사이트: ?lang=ko는 쿠키를 심고 그 주소로(다른 쿼리는 유지)", () => {
  assert.deepEqual(r({ search: "?lang=ko" }), { kind: "redirect", url: "/", status: 307, setLangKo: true, noStore: true });
  assert.deepEqual(r({ search: "?lang=ko&a=1" }), { kind: "redirect", url: "/?a=1", status: 307, setLangKo: true, noStore: true });
});
test("한국어 사이트: 예전 /en 주소는 영문 사이트의 같은 주소로", () => {
  assert.deepEqual(r({ pathname: "/en/result/x/4", country: "KR" }), { kind: "redirect", url: `https://${EN_HOST}/en/result/x/4`, status: 308 });
});
test("영문판이 닫혀 있으면 한국어 사이트는 아무도 보내지 않는다", () => {
  assert.deepEqual(r({ enOpen: false }), { kind: "next" });
  assert.deepEqual(r({ enOpen: false, pathname: "/en/worry" }), { kind: "next" });
});
test("영문 사이트: /en 밖의 주소는 /en…으로, 닫혀 있으면 한국어 사이트로", () => {
  const e = (o: Partial<RouteInput>) => r({ host: EN_HOST, ...o });
  assert.deepEqual(e({ pathname: "/en/worry" }), { kind: "next" });
  assert.deepEqual(e({ pathname: "/" }), { kind: "redirect", url: "/en", status: 308 });
  assert.deepEqual(e({ pathname: "/result/x/2", search: "?opened=1" }), { kind: "redirect", url: "/en/result/x/2?opened=1", status: 308 });
  assert.deepEqual(e({ pathname: "/about" }), { kind: "redirect", url: "/en", status: 307 });
  assert.deepEqual(e({ enOpen: false, pathname: "/en/worry" }), { kind: "redirect", url: `https://${KO_HOST}/?lang=ko`, status: 307, noStore: true });
});
test("미리보기 주소(localhost·vercel.app)는 아무 것도 하지 않음", () => {
  assert.deepEqual(r({ host: "localhost:3200" }), { kind: "next" });
  assert.deepEqual(r({ host: "ssol-tarot-abc.vercel.app" }), { kind: "next" });
});
