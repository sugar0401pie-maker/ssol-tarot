import { test } from "node:test";
import assert from "node:assert/strict";
import { aliasOk, userAliases } from "./optionAlias.ts";
import { namesFor, aliasText } from "./reportLines.ts";

const full = ["연봉 높은 회사로 옮기기", "지금 회사에 남아서 승진을 기다리기"];

test("별칭 검사: 2~8자·금지어 없음·원래 말에서 나옴·정식 이름이 짧으면 안 씀", () => {
  assert.equal(aliasOk(full[1], "남아서 승진"), true);
  assert.equal(aliasOk(full[1], "버티기 최고"), false); // 금지어
  assert.equal(aliasOk(full[1], "새 출발"), false); // 원래 말과 겹치는 글자가 없음(새 뜻)
  assert.equal(aliasOk(full[1], "지금 회사에 남아서 승진"), false); // 9자 넘음
  assert.equal(aliasOk(full[1], "남"), false); // 너무 짧음
  assert.equal(aliasOk("이직하기", "이직"), false); // 정식 이름이 이미 짧음
  assert.equal(aliasOk(full[1], 3), false);
});

test("고객이 쓴 선택지(explicit)만, 개수가 맞을 때만, 서로 다른 별칭만", () => {
  const f = { decision_source: "explicit", options_ranked: full, option_aliases: ["연봉 따라 이직", "남아서 승진"] };
  assert.deepEqual(userAliases(f), [{ full: full[0], alias: "연봉 따라 이직" }, { full: full[1], alias: "남아서 승진" }]);
  assert.deepEqual(userAliases({ ...f, decision_source: "implicit" }), []);
  assert.deepEqual(userAliases({ ...f, option_aliases: ["연봉 따라 이직"] }), []);
  // 한쪽이 원래 말과 안 겹치면 그쪽만 빠진다(그 선택지는 정식 이름 그대로)
  assert.deepEqual(userAliases({ ...f, option_aliases: ["남아서 승진", "남아서 승진"] }), [{ full: full[1], alias: "남아서 승진" }]);
  // 같은 별칭이 두 번이면 뒤의 것은 쓰지 않는다
  const two = ["회사에 남아서 승진 기다리기", "회사에 남아서 이직 준비하기"];
  assert.equal(userAliases({ decision_source: "explicit", options_ranked: two, option_aliases: ["회사에 남기", "회사에 남기"] }).length, 1);
});

test("7·10쪽 첫 번째만 정식 이름, 나머지는 별칭", () => {
  const frame = { decision_source: "explicit", options_ranked: full, options: full, option_aliases: ["연봉 따라 이직", "남아서 승진"] };
  const names = namesFor({ frame, lean: { option: full[1], other: full[0], table: "job" } });
  assert.equal(names.length, 2);
  const n = names.find((x) => x.full === full[1])!;
  const t = aliasText(`‘${full[1]}’을 골랐어요. ‘${full[1]}’을 하면서 이번 주에.`, n, true);
  assert.equal(t, `‘${full[1]}’을 골랐어요. ‘남아서 승진’을 하면서 이번 주에.`);
});
