import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChatSummary, CHAT_SUMMARY_MAX } from "./chatSummary.ts";

test("고민 원문·결과 정보가 맨 위, 쪽마다 한 줄 '[번호. 제목] 본문'(굵게·목록 기호 제거)", () => {
  const s = buildChatSummary(
    [
      { page: 1, title: "오늘 당신에게 온 세 장", body: "**굵은 문장.** 다음 문장\n\n◦ 선택지: A / B" },
      { page: 5, title: "세 장이 함께", free: "## 메인\n\n리드" },
      { page: 6, title: "잠긴 쪽", body: null },
    ],
    { worryText: "이직할까요?\n고민돼요", nickname: "민준", createdAt: "2026-10-26T01:00:00Z", paid: false },
  );
  const lines = s.split("\n");
  assert.equal(lines[0], "[고민 원문] 이직할까요? 고민돼요");
  assert.match(lines[1], /^\[결과 정보\] 쏠 타로 하우스 · 2026-10-26 · 닉네임 민준 · 무료 결과/);
  assert.equal(lines[2], "[1. 오늘 당신에게 온 세 장] 굵은 문장. 다음 문장 선택지: A / B");
  assert.equal(lines[3], "[5. 세 장이 함께] 메인 리드");
  assert.equal(lines.length, 4, "본문이 없는 쪽은 넣지 않음");
});

test("고민을 건너뛴 경우와 길이 상한", () => {
  const long = "가".repeat(3000);
  const s = buildChatSummary(
    [1, 2, 3, 4].map((n) => ({ page: n, title: `쪽${n}`, body: long })),
    { worryText: null, nickname: null, createdAt: "2026-10-26", paid: true },
  );
  assert.match(s, /^\[고민 원문\] \(고민을 적지 않고 카드를 뽑음\)/);
  assert.match(s, /결제한 전체 리포트/);
  assert.ok(s.length <= CHAT_SUMMARY_MAX, `${s.length}자`);
  assert.ok(s.endsWith("…"));
});
