import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyReportText, isWorryExportDay, utmTop } from "./dailyReport.ts";
import { buildFunnel } from "./funnel.ts";
import { ANALYSIS_HEADER, EXPORT_HEADER, analysisRow } from "./exportRows.ts";
import { buildXlsx } from "./xlsx.ts";
import { deflateRawSync, inflateRawSync } from "node:zlib";

test("고민 엑셀은 월·목에만", () => {
  assert.equal(isWorryExportDay("2026-11-23"), true); // 월
  assert.equal(isWorryExportDay("2026-11-26"), true); // 목
  assert.equal(isWorryExportDay("2026-11-24"), false);
});

test("광고 소재 상위: 방문 많은 순, 같은 소재끼리 합침", () => {
  const top = utmTop([
    { source: "x", campaign: "a", content: "1", metric: "visit", value: 3 },
    { source: "x", campaign: "a", content: "1", metric: "paid", value: 1 },
    { source: "meta", campaign: "b", content: "", metric: "visit", value: 9 },
  ]);
  assert.deepEqual(top.map((t) => t.key), ["meta / b", "x / a / 1"]);
  assert.equal(top[1].paid, 1);
});

test("메일 본문은 숫자만 — 제목에 시작·결제", () => {
  const rows = [{ day: "2026-11-18", metric: "started", value: 100 }, { day: "2026-11-18", metric: "paid", value: 7 }];
  const r = dailyReportText({ day: "2026-11-18", funnel: buildFunnel(rows, "2026-11-18"), recent: [], utm: [] });
  assert.match(r.subject, /시작 100 · 결제 7/);
  assert.match(r.text, /테스트 시작: 100/);
});

test("분석용 칸에는 닉네임·이메일·로그인 수단이 없다", () => {
  for (const h of ["닉네임", "이메일", "로그인 수단"]) assert.equal(ANALYSIS_HEADER.includes(h as never), false);
  assert.equal(ANALYSIS_HEADER.length, EXPORT_HEADER.length - 3);
  const row = EXPORT_HEADER.map((h) => h);
  assert.deepEqual(analysisRow(row), ANALYSIS_HEADER);
});

test("압축 엑셀: 내용을 풀면 원래 시트와 같다", () => {
  const raw = buildXlsx("t", ["a"], [["고민"]]);
  const z = buildXlsx("t", ["a"], [["고민"]], [], (b) => new Uint8Array(deflateRawSync(b)));
  assert.ok(z.length < raw.length);
  // 첫 파일([Content_Types].xml)을 풀어 비교
  const dv = new DataView(z.buffer, z.byteOffset);
  assert.equal(dv.getUint16(8, true), 8);
  const csize = dv.getUint32(18, true);
  const nlen = dv.getUint16(26, true);
  const body = inflateRawSync(z.subarray(30 + nlen, 30 + nlen + csize)).toString();
  assert.match(body, /^<\?xml/);
});
