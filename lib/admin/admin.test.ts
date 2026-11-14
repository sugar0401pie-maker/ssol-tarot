import { test } from "node:test";
import assert from "node:assert/strict";
import { isAdminEmail, ADMIN_EMAILS } from "./access.ts";
import { buildFunnel, recentDays } from "./funnel.ts";
import { addDays, isValidDay, kstDayBounds, kstStamp, kstToday } from "./kstDay.ts";
import { buildXlsx, colName, crc32, xmlText } from "./xlsx.ts";
import { exportRow, providerLabel, EXPORT_HEADER } from "./exportRows.ts";

test("관리자 이메일: seotaiji0124@naver.com 하나만, 빈 목록이면 아무도 안 됨", () => {
  assert.equal(isAdminEmail("seotaiji0124@naver.com"), true);
  assert.equal(isAdminEmail(" SeoTaiji0124@Naver.com "), true);
  assert.equal(isAdminEmail("sugar0401pie@gmail.com"), false);
  assert.equal(isAdminEmail("seotaiji0124@naver.com.evil.com"), false);
  assert.equal(isAdminEmail(""), false);
  assert.equal(isAdminEmail(null), false);
  assert.equal(isAdminEmail("a@b.com", []), false);
  assert.deepEqual([...ADMIN_EMAILS], ["seotaiji0124@naver.com"]);
});

test("한국 시간 날짜", () => {
  assert.equal(kstToday(new Date("2026-11-08T15:30:00Z")), "2026-11-09");
  assert.equal(kstToday(new Date("2026-11-08T14:59:00Z")), "2026-11-08");
  assert.deepEqual(kstDayBounds("2026-11-09"), { start: "2026-11-08T15:00:00.000Z", end: "2026-11-09T15:00:00.000Z" });
  assert.equal(addDays("2026-11-01", -1), "2026-10-31");
  assert.equal(isValidDay("2026-02-30"), false);
  assert.equal(isValidDay("2026-11-09"), true);
  assert.equal(isValidDay("2026-11-09; drop"), false);
  assert.equal(kstStamp("2026-11-08T15:05:00Z"), "2026-11-09 00:05");
});

test("단계 표: 그 날·누적과 전 단계 대비 전환율", () => {
  const rows = [
    { day: "2026-11-08", metric: "visit", value: 100 }, { day: "2026-11-08", metric: "started", value: 50 },
    { day: "2026-11-08", metric: "result", value: 40 }, { day: "2026-11-08", metric: "paid", value: 4 },
    { day: "2026-11-09", metric: "visit", value: 200 }, { day: "2026-11-09", metric: "started", value: 80 },
    { day: "2026-11-09", metric: "result", value: 60 }, { day: "2026-11-09", metric: "paid", value: 3 },
    { day: "2026-11-10", metric: "visit", value: 999 },
  ];
  const f = buildFunnel(rows, "2026-11-09");
  assert.deepEqual(f.map((r) => [r.metric, r.day, r.dayRate, r.total, r.totalRate]), [
    ["visit", 200, null, 300, null],
    ["started", 80, 40, 130, 43.3],
    ["result", 60, 75, 100, 76.9],
    ["paid", 3, 5, 7, 7],
  ]);
  // 앞 단계가 0이면 전환율 없음
  assert.equal(buildFunnel([{ day: "2026-11-01", metric: "started", value: 5 }], "2026-11-01")[1].dayRate, null);
  const rec = recentDays(rows, "2026-11-09", ["2026-11-08", "2026-11-09", "2026-11-10"]);
  assert.equal(rec.length, 2);
  assert.equal(rec[1].values.paid, 3);
});

test("엑셀 파일: zip 머리·열 이름·글자 이스케이프", () => {
  assert.equal(colName(0), "A");
  assert.equal(colName(25), "Z");
  assert.equal(colName(26), "AA");
  assert.equal(crc32(new TextEncoder().encode("hello")), 0x3610a686);
  assert.equal(xmlText('<a&"b">\u0001'), "&lt;a&amp;&quot;b&quot;&gt;");
  const f = buildXlsx("시트", ["가", "나"], [["=1+1", 3], [null, "x"]]);
  assert.deepEqual([...f.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const s = new TextDecoder().decode(f);
  assert.ok(s.includes('t="inlineStr"') && s.includes("=1+1") && !s.includes("<f>"), "수식으로 넣지 않음");
});

test("엑셀 한 줄: 로그인 수단·결제·영역", () => {
  assert.equal(providerLabel(null, null), "로그인 안 함");
  assert.equal(providerLabel({ email: "a@b.com", provider: "custom:naver" }, "u1"), "네이버");
  assert.equal(providerLabel(null, "u1"), "계정 없음(탈퇴 등)");
  const s = { id: "s1", created_at: "2026-11-08T15:05:00Z", user_id: "u1", nickname: "해달", experience: "first", worry_text: "이직할까요", frame: { area: "CAR", sub_id: "LV-WHEN", table: "job" }, safety_level: "none", result_status: "ready", paid_at: "2026-11-08T15:10:00Z", report_status: "ready" };
  const r = exportRow(s, { email: "a@b.com", provider: "kakao" }, { session_id: "s1", amount: 990, currency: "KRW", paid_at: "2026-11-08T15:10:00Z" }, { "LV-WHEN": { name: "인연이 언제 올지" } });
  assert.equal(r.length, EXPORT_HEADER.length);
  assert.deepEqual([r[0], r[4], r[5], r[6], r[8], r[9], r[10], r[14], r[16]], ["2026-11-09 00:05", "a@b.com", "카카오", "처음", 5, "직장", "인연이 언제 올지 (LV-WHEN)", "결제", 990]);
  const comp = exportRow({ ...s, user_id: null }, null, null);
  assert.equal(comp[14], "무료 열람(관리자 지정)");
  assert.equal(comp[5], "로그인 안 함");
  assert.equal(exportRow(s, null, { session_id: "s1", amount: 199, currency: "USD", paid_at: null })[16], 1.99);
});

test("관리자 입장 암호: 요약값과 맞는 암호만 통과(시험용 암호로)", async () => {
  const { checkAdminPassword } = await import("./password.ts");
  const { scryptSync } = await import("node:crypto");
  const salt = "testsalt";
  const hash = scryptSync("open-sesame", salt, 32).toString("hex");
  assert.equal(checkAdminPassword("open-sesame", salt, hash), true);
  assert.equal(checkAdminPassword("Open-sesame", salt, hash), false);
  assert.equal(checkAdminPassword("", salt, hash), false);
  assert.equal(checkAdminPassword(undefined, salt, hash), false);
  assert.equal(checkAdminPassword("x".repeat(500), salt, hash), false);
  assert.equal(checkAdminPassword("wrong"), false); // 실제 요약값에도 엉뚱한 암호는 통과 못 함
});

import { utmSummaryRows, UTM_HEADER } from "./exportRows.ts";
test("광고 소재별 집계: 날짜 × 소재로 묶고 빈 값은 '없음', 달러는 센트를 달러로", () => {
  const rows = utmSummaryRows([
    { day: "2026-11-14", source: "x", campaign: "nov", content: "", metric: "visit", value: 10 },
    { day: "2026-11-14", source: "x", campaign: "nov", content: "", metric: "paid", value: 2 },
    { day: "2026-11-14", source: "x", campaign: "nov", content: "", metric: "paid_krw", value: 1980 },
    { day: "2026-11-14", source: "x", campaign: "nov", content: "", metric: "paid_usd_cents", value: 199 },
    { day: "2026-11-13", source: "x", campaign: "", content: "a", metric: "started", value: 3 },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0][0], "2026-11-13");
  assert.deepEqual(rows[0].slice(1, 4), ["x", "없음", "a"]);
  assert.deepEqual(rows[1], ["2026-11-14", "x", "nov", "없음", 10, 0, 0, 0, 0, 2, 1980, 1.99]);
  assert.equal(rows[1].length, UTM_HEADER.length);
});
