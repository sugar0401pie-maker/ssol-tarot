// AI 출력(3번 본문 ~ 7번) 자동 검증. 실패하면 1회 재생성, 그래도 실패하면 저장하지 않고 운영 알림.
// 사용: node validateReport.js <ai_output.md> [--violence]
// 어미 판별은 휴리스틱이라 경계 사례는 사람이 확인합니다(디저트 테스트 validate_report.py와 같은 방식).
import fs from "node:fs";

export const AI_TITLES = {
  3: "세 장이 함께 들려주는 이야기",
  4: "지금의 마음, 조금 더 깊이",
  5: "나를 붙잡는 것의 정체",
  6: "다음 한 걸음을 위한 웰니스 처방",
  7: "이번 주 실천 카드",
};
export const LEN_MIN = 2200, LEN_MAX = 3500;
const FORBIDDEN = [
  "운명", "예언", "반드시", "게 될 거예요", "게 될 것입니다", "될 운명", "천생연분", "최악",
  "헤어지세요", "헤어져야", "헤어지는 게", "더 참아", "참아야 해요", "우울증", "불안장애", "공황장애", "ADHD",
  "진단", "어릴 때부터", "오랫동안 당신", "회피형", "불안형", "**",
];
const SCHOLARS_KO = ["프랭클", "셀리그먼", "네프", "헤이스", "리네한", "엘리스", "길버트", "칙센트미하이", "골위처", "반두라", "프레드릭슨", "페니베이커", "위니컷", "매스텐", "스나이더", "듀가스", "브리지스", "워든", "맥아담스", "존슨", "카밧진", "젠들린"];
const APPROACH_WORDS = ["나-전달법", "먼저 연락", "먼저 다가가", "마음을 전해", "솔직하게 말해 보"];

export function splitSections(text) {
  const parts = text.split(/\n(?=### \d+\.)/);
  const secs = {};
  for (const p of parts) {
    const m = p.match(/^### (\d+)\. (.+)/);
    if (m) secs[Number(m[1])] = { title: m[2].trim(), lines: p.split("\n").slice(1).filter((x) => x.trim()) };
  }
  return secs;
}
const sentences = (par) => (par.replace(/[?!]/g, ".").match(/[^.]+\.(?=\s|$)/g) || []);
const ending = (s) => { const t = s.trim().replace(/[.'"”’)]+$/, ""); return t.endsWith("니다") ? "다" : t.endsWith("요") ? "요" : "?"; };

export function validate(text, { violence = false } = {}) {
  const res = [];
  const add = (name, ok, detail = "") => res.push({ name, ok, detail });
  const secs = splitSections(text);
  const nums = Object.keys(secs).map(Number).sort((a, b) => a - b);

  const bad = [];
  [3, 4, 5, 6, 7].forEach((n) => {
    if (!secs[n]) bad.push(`${n}번 없음`);
    else if (secs[n].title !== AI_TITLES[n]) bad.push(`${n}번 제목 불일치: ${secs[n].title}`);
  });
  const extra = nums.filter((n) => !(n in AI_TITLES));
  if (extra.length) bad.push(`AI가 쓰면 안 되는 섹션: ${extra.join(",")} (1·2·8번은 서버 조립)`);
  add("헤더 3~7번·제목", bad.length === 0, bad.join("; "));

  const body = text.slice(Math.max(0, text.search(/^### 3\./m)));
  const n = body.replace(/^### .*$/gm, "").replace(/\s+/g, "").length;
  add(`분량 ${LEN_MIN}~${LEN_MAX}자(공백·헤더 제외)`, n >= LEN_MIN && n <= LEN_MAX, `${n}자`);

  const hits = FORBIDDEN.filter((w) => body.includes(w));
  add("금지 표현(예언·단정·진단·관계 지시·별표)", hits.length === 0, hits.join(", "));

  const latin = (body.match(/[A-Za-z]{3,}/g) || []);
  const ko = SCHOLARS_KO.filter((w) => body.includes(w));
  add("학자 이름·영어 이론명 미사용", latin.length === 0 && ko.length === 0, [...latin, ...ko].join(", "));

  const s6 = secs[6] ? secs[6].lines.filter((l) => l.startsWith("• ")).length : 0;
  add("6번 처방 3개 이상(• 줄)", s6 >= 3, `${s6}개`);

  const s7 = secs[7] ? secs[7].lines.filter((l) => l.startsWith("• ")) : [];
  const order = ["• 오늘", "• 3일 안에", "• 이번 주"];
  const ok7 = s7.length === 3 && s7.every((l, i) => l.startsWith(order[i]));
  add("7번 실천 카드 3장(오늘 / 3일 안에 / 이번 주 순서)", ok7, s7.map((l) => l.slice(0, 8)).join(" | "));

  const pars = body.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p && !p.startsWith("###") && !p.startsWith("• "));
  const longPars = pars.filter((p) => sentences(p).length > 5).length;
  add("문단당 5문장 이하", longPars === 0, `초과 ${longPars}개`);

  const ends = pars.flatMap(sentences).map(ending).filter((e) => e !== "?");
  const da = ends.filter((e) => e === "다").length, yo = ends.length - da;
  let run = 1, maxRun = 1;
  for (let i = 1; i < ends.length; i++) { run = ends[i] === ends[i - 1] ? run + 1 : 1; maxRun = Math.max(maxRun, run); }
  const ratioOk = ends.length > 0 && Math.max(da, yo) / ends.length <= 0.65;
  add("어미 균형(한쪽 65% 이하, 같은 어미 3연속 없음)", ratioOk && maxRun < 3, `입니다체 ${da} / 요체 ${yo}, 최대 연속 ${maxRun}`);

  if (violence) {
    const ap = APPROACH_WORDS.filter((w) => body.includes(w));
    add("폭력·통제 신호: 다가가기 실천 없음", ap.length === 0, ap.join(", "));
  }
  return { ok: res.every((r) => r.ok), results: res };
}

if (process.argv[1] && process.argv[1].endsWith("validateReport.js")) {
  const file = process.argv[2];
  const out = validate(fs.readFileSync(file, "utf8"), { violence: process.argv.includes("--violence") });
  out.results.forEach((r) => console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  — " + r.detail : ""}`));
  process.exit(out.ok ? 0 : 1);
}
