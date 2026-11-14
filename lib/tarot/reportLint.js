// v2.3.14 리포트 내보내기 전 검사 — 결제 리포트 209건을 읽고 찾은 문제를 기계로 걸러냄. 타로뿐 아니라 사주·점성술·관계 테스트 리포트에도 그대로 쓸 수 있게 일반 규칙으로 씀.
//   lintReport({ pages: [{ page, body }], worryText, options, skipped }) → { block: [...], warn: [...] }
//   block = 내보내지 말고 다시 만들거나 데이터베이스 문장으로 대체 · warn = 기록만(주간 점검)
const WD = /[월화수목금토일]요일/;
export const LINT = {
  internal: /번호\s*(내림|오름)차순|원문 그대로|\{[a-zA-Z_]+\}|undefined|\[object |\bnull\b/,           // 내부 지시·표식·빈 자리표
  deadline_template: /(내년|오늘|내일|이번\s?달[가-힣]*|올해[가-힣 ]*) 답하기 전에/,                                                            // 기한을 틀 문장에 그대로 끼워 어색해짐
  ending: /(합니다|입니다|예요|이에요|해요|어요|아요)요[.!?\s]/,                                                         // 말끝 겹침("합니다요")
  old_timing: /초반\(|중반\(|후반\(/,                                                                                    // 쓰지 않기로 한 시기 말
  overclaim: /분명한 답|뚜렷하게 [가-힣]+ 쪽|반드시|틀림없이|확실히 [가-힣]+(됩니다|돼요|이뤄)/,                         // 단정
  irreversible: /(헤어지자|이별을?\s*(통보|말하)|사표를?\s*내|퇴사 의사를?\s*(밝히|전하|알리)|연락처를?\s*(지우|차단)|차단하세요)/, // 되돌리기 어려운 행동을 실천으로 권함
};
const count = (t, s) => (s ? t.split(s).length - 1 : 0);
export function lintReport({ pages = [], worryText = "", options = [], skipped = false, maxOptionRepeat = 8 } = {}) {
  const block = [], warn = [];
  const text = (n) => pages.filter((p) => (Array.isArray(n) ? n.includes(p.page) : p.page === n)).map((p) => p.body || "").join("\n");
  const all = pages.map((p) => p.body || "").join("\n");
  const wrote = !skipped && String(worryText || "").trim().length > 0;
  if (LINT.internal.test(all)) block.push({ code: "internal_text", at: (all.match(LINT.internal) || [""])[0] });
  if (wrote && !/결국 묻는 것|들려준 이야기/.test(text(3))) block.push({ code: "worry_not_reflected" });      // 고민을 썼는데 3쪽에 고민 읽기·고민 틀이 없음
  if (LINT.ending.test(all)) warn.push({ code: "awkward_ending" });
  if (LINT.deadline_template.test(text(9))) warn.push({ code: "deadline_template" });
  if (LINT.old_timing.test(text(7))) warn.push({ code: "old_timing" });
  if (WD.test(text([7, 8, 9])) && !WD.test(worryText)) warn.push({ code: "weekday_not_in_worry" });
  if (LINT.overclaim.test(text([5, 6, 7]))) warn.push({ code: "overclaim" });
  if (LINT.irreversible.test(text([8, 9]))) warn.push({ code: "irreversible_action" });
  for (const o of options || []) { const n = count(all, o); if (o && o.length >= 6 && n > maxOptionRepeat) warn.push({ code: "option_repeat", option_len: o.length, times: n }); }
  const s5 = text(5), s7 = text(7); // 쪽 사이 같은 문장 되풀이
  const dup = s5.split(/(?<=[.?!요])\s+/).filter((x) => x.length >= 30 && s7.includes(x)).length;
  if (dup >= 2) warn.push({ code: "self_repeat", sentences: dup });
  return { block, warn, ok: block.length === 0 };
}
