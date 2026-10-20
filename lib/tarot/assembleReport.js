// v4.0 변경(이 파일): ① 주의(watch) 단계 삭제(S2) — comboReading은 safety.level과 상관없이 점수대로, buildSafetyNotice는 watch 박스 없음
//   ② '관계 속 두려움'(safety.fear, S4-5) 안내 박스 추가(데이터에 copy.safety.fear_box가 없으면 코드 기본 문구) · D 입력에 fear_flag
//   ③ parseLinks·validateHeadline·validateLead에 { v4: true } 선택 — v4 금지어(V1: FORBIDDEN_V4)로 검사. 기본값은 기존 v3 그대로
//   ⑤ 데이터 copy.result.pages·blur_samples가 11쪽 기준이 되어, buildPages(10쪽)는 쪽 번호 대신 key(cards…sowella)로 제목·teaser·블러를 찾음
//   ④ v4 11쪽 조립은 pagesV4.js(buildPagesV4)가 이 파일의 buildPages() 결과(10쪽)를 받아 바꿈. 검증은 validateV4.js
// v3.0 결과 조립 — 과거–현재–미래 3장 스프레드, 넘겨 보기 10쪽
//   1 오늘 당신에게 온 세 장(카드 뜻은 여기서 한 번만)
//   2 지나온 길 · 3 지금의 흐름 · 4 앞으로의 열쇠  — 제목 = 그 자리가 답하는 질문, 굵은 첫 문장 = 답 (분석)
//   5 세 장이 함께 들려주는 이야기(두 문단, 메인 문구·첫 줄만 무료) · 6 내 고민에 대어 보면(예시 장면) · 7 해결의 흐름(읽기 지도·이유·풀리고 있다는 신호)  (분석, 제안 없음)
//   8 그래서, 이렇게 해 보세요 · 9 이번 주 실천 카드  (제안 — 앞 분석의 어느 자리에서 나왔는지 굵게 밝힘)
//   10 쏘웰라 안내
// 한 정보는 한 곳에서만: 카드 뜻(1쪽) / 자리 해석(2~4쪽) / 세 장 엮기(5쪽) / 고민 장면(6쪽) / 속도와 근거(7쪽) / 제안(8~9쪽)
// 내부 자리 키 now·hold·step은 그대로 두고 뜻만 바뀜: now=지나온 길, hold=지금의 흐름, step=앞으로의 열쇠
import { EURO_RO, EUL_REUL, GWA_WA, I_GA, EUN_NEUN, EY } from "./josa.js";

const nameOf = (list, code) => list.find((x) => x.code === code);
const orient = (p) => (p.reversed ? " (역방향)" : "");
const side = (p) => (p.reversed ? p.card.reversed : p.card);
export const readingOf = (p) => side(p).positions[p.position];
export const fragOf = (p) => side(p).frag[p.position];
export const askOfCard = (p) => side(p).asks_pos[p.position];
const basicOf = (p) => side(p).basic;
export const coreOf = (p) => side(p).core; // AI 입력 참고용(화면에는 안 나옴)
const needOf = (card) => card.match.needs[0];
const positionOf = (data, code) => data.positions.find((x) => x.code === code);

// 문단 첫 문장만 굵게 — "**첫 문장.** 나머지" (한 문장뿐이면 그대로)
export const boldFirst = (t) => { const m = String(t || "").match(/^(.+?[.?!])(\s+[\s\S]+)$/); return m ? `**${m[1]}**${m[2]}` : t; };

// 고민 읽기 한 문장 (cls=null이면 고민 미작성 모드)
export function readingSentence({ name, cls, data }) {
  if (!cls) return `${name}님이 마음속으로 떠올린 고민을 세 장의 카드로 비춰 봤어요. 지나온 길, 지금의 흐름, 앞으로의 열쇠 순서로 읽어 볼게요.`;
  const dom = nameOf(data.domains, cls.domain);
  const [e1, e2] = cls.emotions.map((c) => nameOf(data.emotions, c).name);
  const need = nameOf(data.needs, cls.need).name;
  const phrase = cls.self_focus && dom.phrase_self ? dom.phrase_self : dom.phrase;
  const feel = e2 ? `그 안에서 ${e1}${GWA_WA(e1)} ${e2}${I_GA(e2)} 함께 느껴지고` : `그 안에서 ${e1}${I_GA(e1)} 가장 크게 느껴지고`;
  return `${name}님이 들려준 이야기는 ${phrase}${EURO_RO(phrase)} 읽혔어요. ${feel}, 지금 가장 필요한 것은 '${need}'에 가까워 보여요.`;
}

// ---- 7쪽 해결의 흐름: 점수 + 그렇게 읽은 이유(코드) ----
//   점수 = 카드별 해결 기운 × 자리 가중치(1·1·2) + 2·3번 같은 성격 + 바꿀 수 없는 것 + 역방향 개수 + 번호 흐름 (+ 고민 보정)
export function comboScore({ picks, data, cls = null, worryText = "" }) {
  const C = data.combo, R = C.rules, rel = new Set(C.release_reversed);
  const mom = (p) => { const m = C.momentum[String(p.card.no)]; return p.reversed ? (rel.has(p.card.no) ? m + 1 : m - 1) : m; };
  const parts = []; // [code, 점수, 카드 이름]
  const add = (code, v, c = null) => { if (v) parts.push([code, v, c]); return v || 0; };
  let s = 0;
  [["past", "now", 0], ["present", "hold", 1], ["future", "step", 2]].forEach(([k, w, i]) => {
    const v = mom(picks[i]) * R.position_weight[w];
    s += add(v > 0 ? `${k}_pos` : `${k}_neg`, v, picks[i].card.name);
  });
  const nh = needOf(picks[1].card), ns = needOf(picks[2].card);
  if (nh === ns) s += add("same_need", R.same_need_bonus);
  if (nh === "LETGO") s += add("hold_letgo", R.hold_unchangeable);
  const nr = picks.filter((p) => p.reversed).length;
  if (nr === 0) s += add("reversed_none", R.reversed_none); else if (nr >= 2) s += add("reversed_many", R.reversed_many);
  const [a, b, c] = picks.map((p) => p.card.no);
  if (a < b && b < c) s += add("ascending", R.ascending); else if (a > b && b > c) s += add("descending", R.descending);
  const text = String(worryText || "");
  let deadline = false, otherLocus = false;
  if (cls) {
    if (cls.need === ns) s += add("need_match", R.worry.need_match);
    if ((picks[2].card.match.domains || []).includes(cls.domain)) s += add("domain_match", R.worry.domain_match);
    if (cls.duration === "chronic" || R.chronic_words.some((w) => text.includes(w))) s += add("chronic", R.worry.chronic);
    deadline = cls.urgency === "deadline" || R.deadline_words.some((w) => text.includes(w));
    otherLocus = cls.locus === "other" || cls.locus === "circumstance";
  }
  s = Math.round(s * 10) / 10;
  const pace = s >= R.thresholds.near ? "near" : s <= R.thresholds.slow ? "slow" : "step";
  return { score: s, pace, parts, presentNeed: nh, futureNeed: ns, deadline, otherLocus };
}

// 이렇게 읽은 이유({c}=카드 이름, {c:이}·{c:은}=그 이름에 맞는 조사만): 점수에 가장 크게 들어간 항목 3개(같으면 앞 순서), 화면에는 원래 순서대로
export function reasonLines(sc, data, max = 3) {
  const R = data.combo.reasons;
  const top = sc.parts.map((x, i) => [x, i]).sort((A, B) => Math.abs(B[0][1]) - Math.abs(A[0][1]) || A[1] - B[1]).slice(0, max).sort((A, B) => A[1] - B[1]);
  return top.map(([[code, , c]]) => R[code].replace(/\{c:([가-힣]+)\}/g, (_, j) => JOSA[j](c)).replaceAll("{c}", c || ""));
}

// v3.2 5쪽 세 장이 함께 들려주는 이야기 — 첫 번째·두 번째 카드 중심(그동안 어떻게 해 왔고 → 그것이 지금 어떻게 이어지는지)
//   AI(story, 두 문단: 그동안의 행동 / 지금의 작용) 또는 묶음 조합 문장 story_p1[과거_현재]
//   세 번째 카드(앞으로의 열쇠)가 앞의 두 장과 겹치는 점·달라지는 점은 7쪽 '앞으로의 열쇠가 바꾸는 것'으로
export function comboStory({ picks, data, story = null }) {
  const C = data.combo, [n0, n1] = picks.map((p) => needOf(p.card));
  return story || C.story_p1[`${n0}_${n1}`];
}
export function comboKey({ picks, data, key = null }) {
  const C = data.combo, [n0, n1, n2] = picks.map((p) => needOf(p.card));
  return key || `${C.key_vs_present[`${n1}_${n2}`]} ${C.key_vs_past[`${n0}_${n2}`]}`;
}

// 세 장 읽기 지도(5쪽) — 카드마다 힘의 방향(해결 기운 × 정·역), 번호 흐름. 같은 방향이어도 자리마다 다른 말
export function forceOf(p, data) {
  const C = data.combo, m = C.momentum[String(p.card.no)];
  const v = p.reversed ? (C.release_reversed.includes(p.card.no) ? m + 1 : m - 1) : m;
  return v > 0 ? "up" : v < 0 ? "down" : "flat";
}
export function readingMap(picks, data) {
  const L = data.copy.result.force_labels;
  const [a, b, c] = picks.map((p) => p.card.no);
  return { cards: picks.map((p, i) => { const f = forceOf(p, data); return { position: p.positionName, name: p.card.name, reversed: !!p.reversed, force: f, label: L[f][i % L[f].length] }; }),
    order: a < b && b < c ? "ascending" : a > b && b > c ? "descending" : null };
}
const mapLine = (m) => `[[읽기 지도: ${m.cards.map((x) => `${x.position} ${x.name}${x.reversed ? "(역방향)" : ""} — ${x.label}`).join(" → ")}${m.order ? ` / 번호 ${m.order === "ascending" ? "오름차순" : "내림차순"}` : ""}]]`;

export function comboReading({ name = "", picks, data, cls = null, safety = { level: "none", violence: false }, worryText = "", apply = null, story = null, key = null, storyHead = null, applyHead = null }) {
  const C = data.combo, CR = data.copy.result, sc = comboScore({ picks, data, cls, worryText });
  const RT = CR.flow_titles;
  let paceKey = sc.pace; // v4: 주의(watch) 단계 삭제(S2) — 안전 신호가 말투·흐름 판정을 바꾸지 않음
  if (cls && cls.qtype && cls.qtype !== "worry" && C.pace[`${paceKey}_q`]) paceKey = `${paceKey}_q`; // 질문형
  const pc = C.pace[paceKey];
  const bold = (t) => `**${t}**`;
  const map = readingMap(picks, data);
  const headFb = fillFrame(CR.story_head_frame, { now: fragOf(picks[0]), hold: fragOf(picks[1]) });
  // 5쪽: 굵은 요약 → 읽기 지도 → 이야기(1·2번 카드)
  const story5 = [bold(storyHead || headFb), "", CR.flow_titles.map, mapLine(map), "", comboStory({ picks, data, story })].join("\n");
  // 6쪽: 굵은 요약 → 카드로 본 나의 성향(지나온 길 카드, DB) → 그동안의 고민을 실제 장면에(AI 또는 대체 문단)
  const apply6 = [bold(applyHead || C.apply_head[sc.futureNeed]), "", CR.tendency_title, boldFirst(side(picks[0]).tendency), "",
    apply || C.apply_fallback[`${cls ? cls.domain : "NONE"}_${sc.futureNeed}`]].join("\n");
  // 7쪽: 흐름 판정 → 앞으로의 열쇠가 바꾸는 것(3번 카드가 1·2번과 겹치는/달라지는 점) → 이렇게 읽은 이유 → 풀리고 있다는 신호
  const flow = [bold(`${pc.title}.`), "", pc.body];
  if (sc.deadline) flow.push("", C.tone.deadline);
  if (sc.otherLocus) flow.push("", C.tone.other_locus);
  flow.push("", RT.key, comboKey({ picks, data, key }));
  flow.push("", RT.reasons, ...reasonLines(sc, data).map((t) => `◦ ${t}`));
  flow.push("", RT.signs, ...side(picks[2]).signs.map((t) => `◦ ${t}`));
  return { parts: { story: story5, apply: apply6, flow: flow.join("\n") }, score: sc, paceKey, map };
}

// ---- 8쪽 처방 · 9쪽 실천: 분석이 짚은 바로 그 대상을 직접 다룸(논리 점프 없이) ----
//   처방 ① = 앞으로의 열쇠(4쪽) 카드×방향의 key_rx — "앞으로의 열쇠 ‘조각’을 생활로 옮기면"
//   처방 ② = 지금의 흐름(3쪽) 카드×방향의 slow_rx — 3쪽이 짚은 것과 같은 대상 — "지금의 흐름에서 본 ‘slow_short’를 풀려면"
//   실천: 오늘 = ①의 1~5분판(today) · 3일 안에 = ②의 10~20분판(three) · 이번 주 = ①을 되풀이(week)
const directOf = (p) => side(p).direct;
export function prescriptionsFor({ picks, data }) {
  const B = data.copy.result.rx_bridge;
  const br = (key, f) => B[key].replace("{frag}", f).replace("{eul}", EUL_REUL(f));
  const k = directOf(picks[2]), h = directOf(picks[1]);
  return [{ rx: k.key_rx, bridge: br("step", fragOf(picks[2])), from: "step" },
          { rx: h.slow_rx, bridge: br("hold", h.slow_short), from: "hold" }];
}
export function weekPlan(picks) {
  const k = directOf(picks[2]), h = directOf(picks[1]);
  return { today: k.today, three: h.three, week: k.week };
}

// 동어반복 막기: AI 한 줄이 바로 위 DB 해석과 거의 같으면(글자 두 개씩 묶어 겹치는 비율) 그 줄은 싣지 않음
const bigrams = (t) => { const x = String(t).replace(/[^가-힣]/g, ""); const b = new Set(); for (let i = 0; i < x.length - 1; i++) b.add(x.slice(i, i + 2)); return b; };
export function overlap(a, b) { const A = bigrams(a), B = bigrams(b); let n = 0; A.forEach((g) => B.has(g) && n++); return A.size ? n / A.size : 0; }
export const OVERLAP_MAX = 0.5;

// v3 10쪽의 쪽 번호 → 데이터 copy.result.pages의 key
export const V3_PAGE_KEYS = ["cards", "now", "hold", "step", "story", "apply", "flow", "rx", "practice", "sowella"];
// ---- 넘겨 보기 10쪽 ----
//   카드 쪽(2~4)은 card(정보 상자) · question(제목 아래 큰 질문) · body(굵은 답 + 해석 + 고민 한 줄)로 돌려줌
export function buildPages({ name, cls, picks, data, links = null, safety = { level: "none", violence: false }, story = null, apply = null, key = null, storyHead = null, applyHead = null, paid = false, worryText = "" }) {
  const CR = data.copy.result, PG = CR.pages, NEXT = CR.next_button, BACK = CR.back_button || "돌아가기";
  // v4: 데이터 pages는 11쪽 기준 — 이 함수의 10쪽은 key로 찾음(없으면 같은 번호)
  const sec = (no) => PG.find((x) => x.key === V3_PAGE_KEYS[no - 1]) || PG.find((x) => x.page === no);
  const T = (no) => sec(no).title;
  const pages = [];
  const push = (pg) => pages.push({ ...pg, next: pg.page === 4 ? data.copy.top.cta_button : pg.page < V3_PAGE_KEYS.length ? NEXT : null, back: pg.page > 1 ? BACK : null });

  // 1쪽: 세 장 + 고민 읽기 + 스프레드 안내 + 카드 뜻(여기서 한 번만)
  const p1 = [`[카드 이미지 3장: ${picks.map((p) => p.card.image.file + (p.reversed ? "(180도 회전)" : "")).join(" · ")} — ${data.copy.result_cards.hint}]`, "",
    readingSentence({ name, cls, data }), "", CR.spread_intro, ""];
  picks.forEach((p, i) => {
    const b = basicOf(p);
    p1.push(`${i + 1}. ${p.positionName} · ${p.card.name} — ${p.card.character}${orient(p)}`, `#${b.keywords.join(" #")}`, b.overview, "");
  });
  push({ page: 1, title: T(1), access: "무료", body: p1.join("\n").trim() });

  // 2~4쪽: 자리 해석(분석)
  picks.forEach((p, i) => {
    const pos = positionOf(data, p.position);
    const l = links && links[p.position];
    const line = l && l.line && overlap(l.line, readingOf(p)) <= OVERLAP_MAX ? l.line : null;
    const body = [boldFirst(readingOf(p)), ...(line ? ["", line] : []), ...(i === 2 ? ["", data.copy.top.cta_to_summary] : [])].join("\n");
    // v3.2 '카드는 이렇게 말해요' — 카드 기본 설명(정방향 세 문장) + 역방향이면 역방향 설명을 따로 한 문단. 그다음 자리 질문
    const says = [p.reversed ? p.card.reversed.basic.desc : p.card.basic.desc]; // v3.3 시안: 역방향이면 역방향 설명만
    push({ page: i + 2, title: T(i + 2), access: "무료", question: pos.question, saysTitle: data.copy.result.card_says_title, says,
      card: { position: p.positionName, name: p.card.name, character: p.card.character, reversed: !!p.reversed, keywords: basicOf(p).keywords, arcana: p.card.arcana, image: p.card.image.file },
      body });
  });

  // 5쪽: 무료 = 메인 문구 + 첫 줄 / 블러 아래 = 이야기 + 곱씹어 볼 질문
  const fb = composeTop({ name, picks, data });
  const headline = (links && links.headline) || fb.headline;
  const lead = (links && links.lead) || fb.lead;
  const combo = comboReading({ name, picks, data, cls, safety, worryText, apply, story, key, storyHead, applyHead });
  const askOf = (p) => (links && links[p.position] && links[p.position].ask) || askOfCard(p);
  const free5 = [`## ${headline}`, lead].join("\n\n");
  const locked5 = [combo.parts.story, "", CR.reflect_title, ...picks.map((p) => `◦ ${askOf(p)}`)].join("\n");
  push({ page: 5, title: T(5), access: "일부 무료", combo: combo.score, map: combo.map, free: free5, locked: locked5, body: paid ? [free5, locked5].join("\n\n") : null });

  // 결제 전 6~10쪽: 고정 예시 리포트(blur_samples)를 블러로 — 이 사람의 내용은 결제 확인 전 보내지 않음
  const BL = (no) => (paid ? null : ((CR.blur_samples || {}).pages || {})[String(sec(no).page)] || null); // v4: 블러 예시도 데이터 쪽 번호(11쪽 기준)로
  const lockedPage = (no, body) => push({ page: no, title: T(no), access: "유료", body: paid ? body : null, teaser: sec(no).teaser, blur: BL(no) });
  lockedPage(6, combo.parts.apply);
  lockedPage(7, combo.parts.flow);
  lockedPage(8, paid ? rxPage({ name, cls, picks, data, safety }) : null);
  lockedPage(9, paid ? practicePage({ name, picks, data, safety }) : null);
  lockedPage(10, paid ? [data.copy.cta_chat.body, `[${data.copy.cta_chat.button}]`].join("\n") : null);
  return pages;
}

function rxPage({ picks, data }) {
  const out = [data.copy.result.rx_lead, ""];
  prescriptionsFor({ picks, data }).forEach(({ rx, bridge }) => out.push(`▸ ${bridge}`, `• ${rx.title}`, `${rx.how} ${rx.why}`, ""));
  return out.join("\n").trim();
}
function practicePage({ name, picks, data }) {
  const w = weekPlan(picks);
  return [data.copy.result.practice_lead, "", ...[["오늘", w.today], ["3일 안에", w.three], ["이번 주", w.week]].flatMap(([k, p]) => [`• ${k}: ${p.title} (${p.time})`, `${p.how} ${p.why}`, ""]),
    `이 실천은 정답이 아니라 ${name}님에게 맞는 방법을 찾는 작은 실험이에요. 해 보면서 마음에 걸린 장면이 생기면, 쏘웰라와 이어서 이야기해 볼 수 있어요.`].join("\n");
}

// 메인 문구 줄바꿈: 한 줄을 넘을 때 첫 쉼표 뒤에서 나눔
export const headlineLines = (h) => { const i = h.indexOf(", "); return i > 0 ? [h.slice(0, i + 1), h.slice(i + 2)] : [h]; };

// 메인 문구·첫 줄 조각 조립(고민 미작성·AI 실패 때) — {now}=지나온 길, {hold}=지금의 흐름, {step}=앞으로의 열쇠 조각
const JOSA = { "을": EUL_REUL, "은": EUN_NEUN, "이": I_GA, "으로": EURO_RO, "과": GWA_WA, "이에요": EY };
function fillFrame(frame, vals) {
  return frame.replace(/\{(\w+)(?::([가-힣]+))?\}/g, (_, k, j) => { const v = vals[k]; return j ? v + JOSA[j](v) : v; });
}
export function composeTop({ name, picks, data }) {
  const vals = { name, now: fragOf(picks[0]), hold: fragOf(picks[1]), step: fragOf(picks[2]) };
  const seed = picks.reduce((a, p) => a + p.card.no + (p.reversed ? 7 : 0), 0);
  const hf = data.copy.top.headline_frames, lf = data.copy.top.lead_frames;
  const i = seed % hf.length; // 메인 문구·첫 줄은 같은 번호의 짝으로
  return { headline: fillFrame(hf[i], vals), lead: fillFrame(lf[i % lf.length], vals) };
}

// v4: '관계 속 두려움'(S4-5) 안내 — 권유는 하되 '내가 안전하다고 느낄 때'를 조건으로(AI 쪽 규칙). 데이터 문구가 없을 때 쓰는 기본값
export const FEAR_BOX_DEFAULT = "상대의 반응이 무서워 하고 싶은 말을 꺼내기 어렵다면, 무엇이든 내가 안전하다고 느낄 때 하는 것이 먼저예요. 혼자 감당하기 버거울 때는 여성긴급전화 1366(24시간)에서 이야기 나눌 수 있어요.";
export function buildSafetyNotice({ data, safety }) {
  const c = data.copy, out = [];
  // v4: watch 박스 없음(S2 삭제)
  if (safety.violence) out.push(c.safety.violence_box);
  else if (safety.fear) out.push(c.safety.fear_box || FEAR_BOX_DEFAULT);
  return out.length ? out.join("\n\n") : null;
}

// 연애 세부 유형 — 상황 이름 + 결과 AI가 질문에 답하지 않고 옮겨 말할 방향(reframe_hint), 주의
function qsubLines(cls, data, name) {
  const q = cls.qsub && (data.love_qsub || []).find((x) => x.code === cls.qsub);
  if (!q) return [];
  return [`qsub=${q.name}`, `reframe_hint=${q.reframe.replace(/\{name\}/g, name)}`, ...(q.caution ? [`caution=${q.caution}`] : [])];
}

// ---- 저비용 AI ①(C): 자리별 고민 한 줄 + 곱씹어 볼 질문 + 메인 문구·첫 줄 (3장째를 뽑는 순간, 고민 미작성이면 호출 안 함) ----
export function buildLinkUserBlock({ name, worryText, cls, picks, data }) {
  if (!worryText || !cls) return null;
  const dom = nameOf(data.domains, cls.domain);
  const lines = ["<user_data>", `name=${name}`, `worry_text="""${String(worryText).trim()}"""`, `domain=${dom.name}`,
    `emotions=${cls.emotions.map((c) => nameOf(data.emotions, c).name).join(", ")}`, `need=${nameOf(data.needs, cls.need).name}`,
    ...(cls.self_focus ? ["self_focus=true"] : []), ...(cls.qtype && cls.qtype !== "worry" ? [`qtype=${cls.qtype}`] : []), ...qsubLines(cls, data, name), "<cards>"];
  picks.forEach((p) => lines.push(`[${p.position}] ${p.positionName}(${positionOf(data, p.position).question}) · ${p.card.name} — ${p.card.character} / 방향: ${p.reversed ? "역방향" : "정방향"} / 성격: ${nameOf(data.needs, needOf(p.card)).name} / 카드 뜻: ${basicOf(p).overview} / 이 자리의 해석: ${readingOf(p)}`));
  lines.push("</cards>", "</user_data>");
  return lines.join("\n");
}
export function buildStoryUserBlock({ name, worryText, cls, picks, data, safety }) {
  const link = buildLinkUserBlock({ name, worryText, cls, picks, data });
  if (!link) return null;
  return link.replace("</user_data>", `crisis_level=${safety.level}\nviolence_flag=${safety.violence}\n${safety.fear ? "fear_flag=true\n" : ""}</user_data>`);
}

// 공통 규칙(ai-prompts-tarot-v2.md 0장)을 코드로 확인
const FORBIDDEN = ["운명", "예언", "반드시", "해결될 거예요", "안 될 거예요", "절대", "게 될 거예요", "게 될 것입니다", "진단", "최악", "**",
  "불길", "나쁜 카드", "경고", "어릴 때부터", "오랫동안 당신", "회피형", "불안형", "헤어지", "참아야 해요", "참아야 합니다", "참으세요", "더 참아"];
const SCHOLARS_KO = ["프랭클", "셀리그먼", "네프", "헤이스", "리네한", "엘리스", "길버트", "칙센트미하이", "반두라", "프레드릭슨", "페니베이커", "위니컷", "스나이더", "브리지스", "워든"];
const APPROACH = ["나-전달법", "먼저 연락", "먼저 다가가", "마음을 전해", "솔직하게 말해 보"];
// v4 V1: 남김(반드시·분명히·진단·**·불길·나쁜 카드·경고·어릴 때부터·회피형·불안형) + 새로(직접 종료 권유·'결정은 당신에게')
//   뺌: 운명·예언·해결될 거예요·안 될 거예요·절대·게 될 거예요·게 될 것입니다·헤어지·참아야/참으세요/더 참아·최악
export const FORBIDDEN_V4 = ["반드시", "분명히", "진단", "**", "불길", "나쁜 카드", "경고", "어릴 때부터", "오랫동안 당신", "회피형", "불안형",
  "끝내세요", "헤어지세요", "헤어져야 해요", "헤어져야 합니다", "헤어지는 게 좋", "그만 만나세요", "관계를 끊으세요", "연락을 끊으세요"];
export const DECIDE_YOURSELF = /결정은 .{0,8}(당신|님)(에게|의 몫)|선택은 .{0,8}(당신|님)(에게|의 몫)|스스로 정하세요|둘 다 괜찮아요/;
export const forbiddenHitsV4 = (t) => [...FORBIDDEN_V4.filter((w) => t.includes(w)), ...(DECIDE_YOURSELF.test(t) ? [t.match(DECIDE_YOURSELF)[0]] : [])];
export const APPROACH_WORDS = APPROACH;
const ruleOk = (t, { violence = false, v4 = false } = {}) => !(v4 ? forbiddenHitsV4(t).length : FORBIDDEN.some((w) => t.includes(w))) && !SCHOLARS_KO.some((w) => t.includes(w))
  && !/[A-Za-z]{3,}/.test(t) && !(violence && APPROACH.some((w) => t.includes(w)));
// v3.0 분석 쪽(2~7쪽) AI 문장에는 제안·명령형을 쓰지 않음 — 제안은 8·9쪽 몫
// v3.1 권유 어미만 봄('나눠 보기 어렵게' 같은 서술은 통과 — 시범 실행 오탈락)
const SUGGEST = /(보세요|하세요|보면 좋|하면 좋|해 봐요|보는 건 어떨|보면 어떨|보는 것도 (하나의 )?방법|봅시다|해 보자|보시길|보길 바)/;
const analysisOk = (t, o) => ruleOk(t, o) && !SUGGEST.test(t);

// C 출력: {"now":{"line","ask"}, "hold":{...}, "step":{...}, "headline", "lead"}
//   line 규칙을 어기면 전체 실패(null). ask만 어기면 그 자리는 카드 기본 질문(asks_pos)
export const ASK_FORM = { now: /^그동안.*않았나요\?$/, hold: /^혹시 지금.*있지는 않나요\?$/, step: /^앞으로.*어느 쪽에 더 마음을 두고 싶나요\?$/ };
export function parseLinks(raw, { violence = false, v4 = false } = {}) {
  let obj;
  try { obj = typeof raw === "string" ? JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim()) : raw; } catch { return null; }
  if (!obj) return null;
  const out = {};
  for (const k of ["now", "hold", "step"]) {
    const v = typeof obj[k] === "string" ? { line: obj[k] } : obj[k];
    if (!v || typeof v.line !== "string") return null;
    const t = v.line.trim();
    if (t.length < 15 || t.length > 90 || !/(요|다)\.$/.test(t) || !analysisOk(t, { violence, v4 })) return null;
    const a = typeof v.ask === "string" ? v.ask.trim() : "";
    const askOk = a && a.length >= 15 && a.length <= 95 && ruleOk(a, { violence, v4 }) && ASK_FORM[k].test(a);
    out[k] = { line: t, ask: askOk ? a : null };
  }
  out.headline = validateHeadline(obj.headline, { violence, v4 });
  out.lead = validateLead(obj.lead, { violence, v4 });
  return out;
}
export function validateHeadline(raw, { violence = false, v4 = false } = {}) {
  const t = String(raw || "").trim();
  return t.length >= 8 && t.length <= 40 && !/[.!?]$/.test(t) && ruleOk(t, { violence, v4 }) ? t : null;
}
export function validateLead(raw, { violence = false, v4 = false } = {}) {
  const t = String(raw || "").trim();
  const n = (t.match(/[.?!](?=\s|$)/g) || []).length;
  return t.length >= 25 && t.length <= 120 && n === 1 && /(요|다)\.$/.test(t) && ruleOk(t, { violence, v4 }) ? t : null;
}

// D 출력: {"story_head","story","apply_head","apply"} — 모두 분석(제안 없음)
//   story = 지나온 길 → 지금의 흐름 → 앞으로의 열쇠의 인과 2~4문장 / apply = 고민 속 장면에 세 자리를 차례로 대어 본 3~5문장
// v3.1 story = 두 문단(빈 줄로 나눔): 1문단 2~3문장 80~300자(지나온 길↔지금의 흐름) / 2문단 2~4문장 90~350자(앞으로의 열쇠가 겹치는 점·달라지는 점)
const nSent = (t) => (t.match(/[^.?]+[.?](?=\s|$)/g) || []).length;
export function validateStory(raw, { violence = false } = {}) {
  const t = String(raw || "").trim().replace(/\r/g, "");
  const ps = t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  if (ps.length !== 2) return null;
  const [p1, p2] = ps;
  const ok1 = p1.length >= 80 && p1.length <= 300 && nSent(p1) >= 2 && nSent(p1) <= 3;
  const ok2 = p2.length >= 90 && p2.length <= 350 && nSent(p2) >= 2 && nSent(p2) <= 4;
  return ok1 && ok2 && ps.every((x) => /(요|다)\.$/.test(x)) && analysisOk(t, { violence }) ? `${p1}\n\n${p2}` : null;
}
// v3.1 apply = 4~7문장 220~700자, 고민 속 구체적인 장면('예를 들어')을 하나 이상
export function validateApply(raw, { violence = false } = {}) {
  const t = String(raw || "").trim();
  const n = nSent(t);
  return t.length >= 220 && t.length <= 700 && n >= 4 && n <= 7 && /예를 들어|예컨대/.test(t) && /(요|다)\.$/.test(t) && analysisOk(t, { violence }) ? t : null;
}
export function validateHead(raw, { violence = false } = {}) {
  const t = String(raw || "").trim();
  const n = (t.match(/[.?!]/g) || []).length;
  return t.length >= 12 && t.length <= 50 && n === 1 && /(요|다)\.$/.test(t) && analysisOk(t, { violence }) ? t : null;
}
// v3.2 key = 7쪽 '앞으로의 열쇠가 바꾸는 것' — 2~4문장 90~350자, 세 번째 카드가 앞의 두 장과 겹치는 점·달라지는 점(분석)
export function validateKey(raw, { violence = false } = {}) {
  const t = String(raw || "").trim();
  const n = nSent(t);
  return t.length >= 90 && t.length <= 350 && n >= 2 && n <= 4 && /(요|다)\.$/.test(t) && analysisOk(t, { violence }) ? t : null;
}
export function parseStoryApply(raw, { violence = false } = {}) {
  let o = raw;
  if (typeof raw === "string") { try { o = JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim()); } catch { return { story: null, apply: null, key: null, storyHead: null, applyHead: null }; } }
  return { story: validateStory(o && o.story, { violence }), apply: validateApply(o && o.apply, { violence }), key: validateKey(o && o.key, { violence }),
    storyHead: validateHead(o && o.story_head, { violence }), applyHead: validateHead(o && o.apply_head, { violence }) };
}
