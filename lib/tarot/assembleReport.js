// v1.8 결과·리포트 조립 — 카드 3장을 각각 따로 설명합니다.
//   1 오늘 당신에게 온 세 장(무료) / 2 첫 번째 카드(무료) / 3 두 번째 카드(무료)
//   4 세 번째 카드(유료) / 5 세 장이 함께 들려주는 이야기(유료, 짧은 AI + DB) / 6 웰니스 처방(유료, DB) / 7 이번 주 실천 카드(유료, DB 규칙)
//   8 쏘웰라 안내(무료)
// 역방향 카드는 reversed 해석을 쓰고 "(역방향)"을 붙입니다. 깊이 읽기·감정 문장·마무리 문장·실천 이유는
// DB(상담사 검수 문장)가 채워지면 자동으로 들어가고, 아직 없으면 그 줄만 빠집니다.
import { EURO_RO, EUL_REUL, EUN_NEUN, GWA_WA, I_GA } from "./josa.js";
import { filterPractices } from "./safety.js";

const nameOf = (list, code) => list.find((x) => x.code === code);
const title = (data, no) => data.report_sections.find((s) => s.no === no).title;
const orient = (p) => (p.reversed ? " (역방향)" : "");
export const coreOf = (p) => (p.reversed ? p.card.reversed.core : p.card.core);
export const readingOf = (p) => (p.reversed ? p.card.reversed.positions[p.position] : p.card.positions[p.position]);
const deepOf = (p) => {
  const d = p.reversed ? p.card.deep_reversed : p.card.deep; // DB 작성 후 채워짐: { now: [단락...], hold: [...], step: [...] }
  return d && d[p.position] ? d[p.position] : [];
};

// (v2.3) 결과 화면에는 해석 근거 이론을 노출하지 않음. 상담사 검수·내부 참고용으로만 남겨 둔 함수
export function theoriesFor(picks) {
  const out = [];
  picks.forEach(({ card }) => { const t = card.theories.find((x) => !out.includes(x)); if (t) out.push(t); });
  return out;
}

// 고민 읽기 한 문장 (cls=null이면 고민 미작성 모드)
export function readingSentence({ name, cls, data }) {
  if (!cls) return `${name}님이 마음속으로 떠올린 고민을 세 장의 카드로 비춰 봤어요. 카드마다 그 고민의 다른 면을 보여 주니, 읽으면서 떠오르는 장면을 함께 떠올려 보세요.`;
  const dom = nameOf(data.domains, cls.domain);
  const [e1, e2] = cls.emotions.map((c) => nameOf(data.emotions, c).name);
  const need = nameOf(data.needs, cls.need).name;
  const phrase = cls.self_focus && dom.phrase_self ? dom.phrase_self : dom.phrase;
  const feel = e2 ? `그 안에서 ${e1}${GWA_WA(e1)} ${e2}${I_GA(e2)} 함께 느껴지고` : `그 안에서 ${e1}${I_GA(e1)} 가장 크게 느껴지고`;
  return `${name}님이 들려준 이야기는 ${phrase}${EURO_RO(phrase)} 읽혔어요. ${feel}, 지금 가장 필요한 것은 '${need}'에 가까워 보여요.`;
}

// v2.1: 카드 섹션 = 카드명·핵심 → (감정 문장) → 위치 해석 → 고민 연결 한 줄 → "혹시 이렇진 않나요?" 2개 → (깊이 읽기)
// v2.2: 카드명·핵심 → 어떤 카드인가요(원래 타로 자리의 뜻 + 쏠 타로식 해석) → (감정 문장) → 위치 해석 → 연결 한 줄 → 마음에 묻는 질문 2개
function cardSection(no, p, { data, links, emotionLine }) {
  const out = [`### ${no}. ${title(data, no)}`, "", `${p.card.name} — ${p.card.character}${orient(p)}`, coreOf(p), "",
    "어떤 카드인가요", `${p.card.about_when} ${p.card.about_origin}`, ""];
  if (emotionLine) out.push(emotionLine, "");
  out.push(readingOf(p), "");
  const l = links && links[p.position];
  if (l && l.line) out.push(l.line, "");
  const baseAsks = p.reversed && p.card.reversed.asks ? p.card.reversed.asks : p.card.asks; // v2.5: 역방향 전용 기본 질문
  const asks = l && l.asks && l.asks.length ? l.asks : baseAsks; // AI 맞춤 질문, 없으면 카드 기본 질문
  const headings = data.copy.asks_headings || ["혹시 이렇진 않나요?"];
  if (asks && asks.length) { out.push(headings[(no - 2) % headings.length]); asks.forEach((q) => out.push(`• ${q}`)); out.push(""); }
  const deep = deepOf(p);
  if (deep.length) { out.push("조금 더 들여다보기"); deep.forEach((para) => out.push(para, "")); } // v2.3: 깊이 읽기 소제목
  return out.join("\n").trim();
}

export function buildFreeSections({ name, cls, picks, data, links = null }) {
  // v2.2: 결과 맨 위에 카드 3장 이미지(누르면 확대) — 화면에서는 이미지 줄, 텍스트 결과에서는 표시 한 줄
  const s1 = [`### 1. ${title(data, 1)}`, "", `[카드 이미지 3장: ${picks.map((p) => p.card.image.file + (p.reversed ? "(180도 회전)" : "")).join(" · ")} — ${data.copy.result_cards.hint}]`, ""];
  picks.forEach((p) => s1.push(`• ${p.positionName} — ${p.card.name} (${p.card.character}${p.reversed ? " · 역방향" : ""})`));
  s1.push("", readingSentence({ name, cls, data }), "", "세 장 한눈에 보기");
  picks.forEach((p, i) => {
    s1.push("", `• ${i + 1}. ${p.positionName} · ${p.card.name}${orient(p)}`, p.card.about_when);
    if (p.reversed) s1.push(`이번에는 역방향으로 나왔어요. 역방향은 나쁜 뜻이 아니라, 이 카드의 힘이 평소와 다른 방향으로 흐르고 있다는 뜻이에요. ${coreOf(p)}`);
  });
  const e1 = cls && data.emotion_lines ? data.emotion_lines[cls.emotions[0]] : null; // DB: 감정 8개 × 1문장
  return {
    section1: s1.join("\n"),
    section2: cardSection(2, picks[0], { data, links, emotionLine: e1 ? e1.replace("{name}", name) : null }),
    section3: cardSection(3, picks[1], { data, links }),
  };
}

// 결제 전 잠금 미리보기: 4번은 제목 + 세 번째 카드 이름(이미 뒤집어 본 카드라 공개) + 고정 한 줄, 5~7번은 제목 + 고정 한 줄
export function buildLockedPreview(data, picks = null) {
  return data.report_sections.filter((x) => !x.access.startsWith("무료")).map((x) => ({
    no: x.no, title: x.title, teaser: x.teaser,
    ...(x.no === 4 && picks ? { card: `${picks[2].card.name} — ${picks[2].card.character}${orient(picks[2])}` } : {}),
  }));
}

// 7번 규칙: 오늘 = 세 번째 카드 실천 중 가장 짧은 것(같으면 뒤쪽) / 3일 안에 = 남은 것 중 10분 이상 첫 번째(없으면 남은 첫 번째)
//          이번 주 = 두 번째 카드의 '이번 주' 실천, 없으면 세 번째 카드의 남은 것
const minutes = (t) => (/이번 주/.test(t) ? 10080 : /오늘 밤|하루/.test(t) ? 60 : parseInt(t, 10) || 30);
export function weekPlan(picks, safety) {
  const step = filterPractices(picks[2].card, safety);
  const hold = filterPractices(picks[1].card, safety);
  let today = step[0];
  step.forEach((p) => { if (minutes(p.time) <= minutes(today.time)) today = p; });
  const rest = step.filter((p) => p !== today);
  const three = rest.find((p) => minutes(p.time) >= 10) || rest[0] || today;
  const week = hold.find((p) => /이번 주/.test(p.time)) || rest.find((p) => p !== three) || three;
  return { today, three, week };
}

// v2.2 6번 처방: 고민 영역 × 필요 처방 1개 + 세 번째 카드가 가리키는 필요 처방 1개(고민과 다른 필요), 고민 미작성이면 카드의 필요 2개
export function prescriptionsFor({ cls, picks, data, safety }) {
  const bank = data.prescriptions;
  const ok = (r) => r && !(safety.violence && r.approach);
  const step = picks[2].card;
  const out = [];
  if (cls) { const r = bank.by_domain_need[`${cls.domain}_${cls.need}`]; if (ok(r)) out.push(r); }
  const needs = [...step.match.needs, ...picks[1].card.match.needs, "REST", "CHOOSE"];
  for (const n of needs) {
    if (out.length >= 2) break;
    if (cls && n === cls.need) continue;
    const r = bank.by_need[n];
    if (ok(r) && !out.includes(r)) out.push(r);
  }
  return out;
}

export function buildPaidSections({ name, picks, data, links = null, safety, story = null, apply = null, cls = null }) {
  const s4 = cardSection(4, picks[2], { data, links });
  const [c1, c2, c3] = picks.map((p) => p.card.name);
  const step = picks[2];
  const s5 = [`### 5. ${title(data, 5)}`, "",
    `${c1}에서 시작해 ${c2}${EUL_REUL(c2)} 지나 ${c3}${EURO_RO(c3)} 이어지는 흐름이에요.`,
    story || storyFallback({ name, picks, data, cls }),
    "", closingOf(step) || `이 세 장이 함께 건네는 말은 이것이에요. ${coreOf(step)}`,
    "", "내 고민에 대어 보면",
    apply || applyFallback({ name, picks, data, cls })];
  const rx = prescriptionsFor({ cls, picks, data, safety });
  const s6 = [`### 6. ${title(data, 6)}`, "", `세 번째 카드 '${step.card.name}'${EUL_REUL(step.card.name)} 바탕으로, ${name}님의 고민에 맞춰 고른 처방이에요. 아래 7번의 실천 카드와 함께 써 보세요.`, ""];
  rx.forEach((r) => s6.push(`• ${r.title}`, `${r.how} ${r.why}`, ""));
  const w = weekPlan(picks, safety);
  const s7 = [`### 7. ${title(data, 7)}`, "",
    ...[["오늘", w.today], ["3일 안에", w.three], ["이번 주", w.week]].flatMap(([k, p]) => [`• ${k}: ${p.title} (${p.time})`, `${p.how}${p.why ? " " + p.why : ""}`, ""]),
    `이 실천은 정답이 아니라 ${name}님에게 맞는 방법을 찾는 작은 실험이에요. 해 보면서 마음에 걸린 장면이 생기면, 쏘웰라와 이어서 이야기해 볼 수 있어요.`];
  return { section4: s4, section5: s5.join("\n").trim(), section6: s6.join("\n").trim(), section7: s7.join("\n") };
}

// v2.5: 세 번째 카드가 역방향이면 역방향 마무리 문장
const closingOf = (p) => (p.reversed && p.card.reversed.closing ? p.card.reversed.closing : p.card.closing);

// v2.5: AI 실패·고민 미작성 대체 문장 DB(data.fallbacks) — 고민 영역별 2개, 세 카드 번호 합으로 고정 선택
function pickFallback(kind, { name, picks, data, cls }) {
  const bank = data && data.fallbacks && data.fallbacks[kind];
  if (!bank) return null;
  const list = (cls && bank[cls.domain]) || bank.NONE;
  if (!list || !list.length) return null;
  const t = list[picks.reduce((a, p) => a + p.card.no, 0) % list.length];
  const [c1, c2, c3] = picks.map((p) => p.card.name);
  return t.replaceAll("{name}", name).replaceAll("{c1}", c1).replaceAll("{c2}", c2).replaceAll("{c3}", c3);
}
export function storyFallback(args) {
  return pickFallback("story", args) || "마음속에 품은 고민이 지금 어디에 머물러 있고, 무엇에 붙잡혀 있으며, 어디로 나아갈 수 있는지 세 장이 차례로 비춰 주고 있어요.";
}

// 고민 미작성·AI 실패 시 5번 "내 고민에 대어 보면" 대체 문장
export function applyFallback({ name, picks, data = null, cls = null }) {
  const fb = pickFallback("apply", { name, picks, data, cls });
  if (fb) return fb;
  const [a, b, c] = picks.map(coreOf);
  return `${name}님이 마음속에 떠올린 고민에 이 흐름을 대어 보면, 지금은 '${a}'에 가까운 마음일 수 있어요. 그 마음을 붙잡고 있는 것은 '${b}'라는 점일 수 있습니다. 그래서 다음 한 걸음은 '${c}'에서 시작해 보면 좋겠어요. 아래 처방과 실천 카드 중 가장 손이 가는 것 하나부터 골라 보세요.`;
}

// v2.2: 8번 쏘웰라 안내는 유료 리포트 마지막에. 위기·폭력 안내는 결제와 상관없이 무료 구간 끝에(buildSafetyNotice).
export function buildSection8({ data }) {
  const c = data.copy;
  return [`### 8. ${title(data, 8)}`, "", c.cta_chat.body, `[${c.cta_chat.button}]`].join("\n");
}

export function buildSafetyNotice({ data, safety }) {
  const c = data.copy, out = [];
  if (safety.level === "watch") out.push(c.safety.watch_box);
  if (safety.violence) out.push(c.safety.violence_box);
  return out.length ? out.join("\n\n") : null;
}

export function mergeReport({ free, paid = null, section8 = null, notice = null }) {
  const parts = [free.section1, free.section2, free.section3];
  if (notice) parts.push(notice);
  if (paid) parts.push(paid.section4, paid.section5, paid.section6, paid.section7);
  if (paid && section8) parts.push(section8);
  return parts.join("\n\n");
}

// ---- 저비용 AI ①: 카드별 고민 연결 한 줄 (3장째를 뽑는 순간 백그라운드, 고민 미작성이면 호출 안 함) ----
export function buildLinkUserBlock({ name, worryText, cls, picks, data }) {
  if (!worryText || !cls) return null;
  const dom = nameOf(data.domains, cls.domain);
  const lines = ["<user_data>", `name=${name}`, `worry_text="""${String(worryText).trim()}"""`, `domain=${dom.name}`,
    `emotions=${cls.emotions.map((c) => nameOf(data.emotions, c).name).join(", ")}`, `need=${nameOf(data.needs, cls.need).name}`,
    ...(cls.self_focus ? ["self_focus=true"] : []), "<cards>"];
  picks.forEach((p) => lines.push(`[${p.position}] ${p.positionName} · ${p.card.name} — ${p.card.character} / 방향: ${p.reversed ? "역방향" : "정방향"} / 핵심: ${coreOf(p)} / 이 위치의 해석: ${readingOf(p)}`));
  lines.push("</cards>", "</user_data>");
  return lines.join("\n");
}

// v2.0 공통 규칙(ai-prompts-tarot-v2.md 0장)을 코드로 확인: 예언·역방향 부정어·진단·과거 추측·판정·관계 지시·학자 이름·영어·별표
const FORBIDDEN = ["운명", "예언", "반드시", "게 될 거예요", "게 될 것입니다", "진단", "최악", "**",
  "불길", "나쁜 카드", "경고", "어릴 때부터", "오랫동안 당신", "회피형", "불안형", "헤어지", "참아야", "더 참아"];
const SCHOLARS_KO = ["프랭클", "셀리그먼", "네프", "헤이스", "리네한", "엘리스", "길버트", "칙센트미하이", "반두라", "프레드릭슨", "페니베이커", "위니컷", "스나이더", "브리지스", "워든"];
const APPROACH = ["나-전달법", "먼저 연락", "먼저 다가가", "마음을 전해", "솔직하게 말해 보"];
const ruleOk = (t, { violence = false } = {}) => !FORBIDDEN.some((w) => t.includes(w)) && !SCHOLARS_KO.some((w) => t.includes(w))
  && !/[A-Za-z]{3,}/.test(t) && !(violence && APPROACH.some((w) => t.includes(w)));

// 출력 형식(v2.2): {"now":{"line":"...","asks":["...?","...?"]}, "hold":{...}, "step":{...}} — asks는 "혹시"로 시작하지 않아도 됨
// line 규칙을 어기면 전체 실패(null). asks만 어기면 그 카드는 asks를 비워 기본 질문(card.asks)으로 대체.
export function parseLinks(raw, { violence = false } = {}) {
  let obj;
  try { obj = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return null; }
  if (!obj) return null;
  const out = {};
  for (const k of ["now", "hold", "step"]) {
    const v = typeof obj[k] === "string" ? { line: obj[k] } : obj[k];
    if (!v || typeof v.line !== "string") return null;
    const t = v.line.trim();
    if (t.length < 15 || t.length > 90 || !/(요|다)\.$/.test(t) || !ruleOk(t, { violence })) return null;
    const asks = Array.isArray(v.asks) ? v.asks.map((q) => String(q).trim()) : [];
    // v2.2: 질문 모양은 자유롭게(모두 '혹시 ~않나요?'일 필요 없음), 물음표로 끝나고 90자 이내
    const asksOk = asks.length === 2 && asks.every((q) => /\?$/.test(q) && q.length >= 15 && q.length <= 90 && ruleOk(q, { violence }));
    out[k] = { line: t, asks: asksOk ? asks : [] };
  }
  return out;
}

// ---- 저비용 AI ②: 5번 "세 장이 함께 들려주는 이야기" 한 문단 (결제 후, 고민 미작성이면 호출 안 함) ----
export function buildStoryUserBlock({ name, worryText, cls, picks, data, safety }) {
  const link = buildLinkUserBlock({ name, worryText, cls, picks, data });
  if (!link) return null;
  return link.replace("</user_data>", `crisis_level=${safety.level}\nviolence_flag=${safety.violence}\n</user_data>`);
}

// v2.2: D 출력 = {"story": "...", "apply": "..."} — apply는 "내 고민에 대어 보면" 3~5문장, 150~550자
export function validateApply(raw, { violence = false } = {}) {
  const t = String(raw || "").trim();
  const n = (t.match(/[^.?]+[.?](?=\s|$)/g) || []).length;
  return t.length >= 150 && t.length <= 550 && n >= 3 && n <= 5 && /(요|다)\.$/.test(t) && ruleOk(t, { violence }) ? t : null;
}

export function validateStory(raw, { violence = false } = {}) {
  const t = String(raw || "").trim();
  const sentences = (t.match(/[^.]+\.(?=\s|$)/g) || []).length;
  return t.length >= 80 && t.length <= 400 && sentences >= 2 && sentences <= 4 && /(요|다)\.$/.test(t) && ruleOk(t, { violence }) ? t : null;
}

// v2.2: D 응답(JSON 문자열 또는 객체)을 story·apply로 나눠 각각 검증. 실패한 쪽만 null → 서버가 고정 문장으로 대체
export function parseStoryApply(raw, { violence = false } = {}) {
  let o = raw;
  if (typeof raw === "string") { try { o = JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim()); } catch { return { story: null, apply: null }; } }
  return { story: validateStory(o && o.story, { violence }), apply: validateApply(o && o.apply, { violence }) };
}
