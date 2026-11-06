// 영문판(lib/tarot-en/README.md) — 한국어 원본 lib/tarot/pagesV4.js를 복사해 화면 문장만 영어로(고정 문구는 데이터 copy.result.v4가 먼저). 계산·쪽 구성은 원본과 같다.
// v4.2(2026-10-23 CSO): 넘겨 보기 10쪽 — 옛 8쪽(앞으로 이렇게 바뀔 거예요)을 뺌. 8 처방 · 9 이번 주 실천 · 10 쏘웰라
//   ③ 5쪽 카드별 이유 = 이유 문장 DB(lean.cards[i].reason) 우선 → 무료·유료 해석이 같음(C reasons는 DB 없을 때만)
//   ② 결정형 7쪽 맨 위 = E1 direction.flow(결론 쪽으로 풀려 가는 흐름). DB 속도 문단(결론과 엇갈릴 수 있음)은 결정형에서 쓰지 않음
//   ⑤ 8쪽 처방은 머리말·결론 headline 없이 처방부터 · ① 9쪽 '오늘'은 DB(today_practices, 앞으로의 열쇠 카드)
// v4.0 (새로) 넘겨 보기 11쪽 조립 — 결정형 고민에 방향 제시(규칙 R1~R12)
//   입력 base = 기존 buildPages()(v3.3, 10쪽) 결과. 그 위에 v4 시안 후처리(proto/p36/post.py)와 같은 일을 일반화해서 함:
//   1 세 장 + 고민 틀 상자 + '약 6개월' 안내 · 2~4 카드 쪽(그대로) · 5 세 장이 함께(결정형: teaser + 카드별 한 줄 / 블러 아래 결론)
//   6 내 고민에 대어 보면('예를 들어' 앞 문단 나눔) · 7 해결의 흐름(결정형: 카드가 가리키는 방향 블록 / 비결정형: 이번 주 계획)
//   8 앞으로 이렇게 바뀔 거예요(새 쪽) · 9 처방(결정형: 결론 headline·lead를 여기로) · 10 이번 주 실천 · 11 쏘웰라
//   모든 쪽: 문단 첫 문장 굵게 + 쪽마다 ~요/~니다 50:50(seed = 쪽 번호, 카드 설명 says는 쪽 번호 + 1)
//   결정형 = frame.worry_type === "decision" 이고 lean(점수표 계산 결과)이 있을 때. 그 밖은 비결정형 경로.
//   v4.0-b: 고정 문구는 데이터 copy.result.v4 우선(없으면 V4_COPY), 8쪽 제목·teaser는 copy.result.pages(key=change), 결제 전 8쪽 블러는 blur_samples.pages["8"]
//   비결정형 + E: 7쪽 = 흐름 머리 + '이렇게 읽은 이유' + 이번 주 계획(열쇠가 바꾸는 것은 8쪽 E.change가 맡음)
//   계획 머리말: 변화형 표(job/start/move)는 side별, 관계형 표는 "‘{선택지}’ 쪽으로 정했다면…", 비결정형은 "이번 주에 이것부터" (PLAN_HEADS)
//   v4.1: 새 고민 틀(A2 v4.6) — 결정형 = 표가 있고 options_ranked가 2개 이상(decision.isDecisionFrame, worry_type은 원래 모양 그대로).
//     mode rank: 결론은 lean.option(카드 +면 1순위, −면 2순위). 계획 머리말은 표와 상관없이 "‘{선택지}’ 쪽으로 정했다면…".
//     관계형 표(approach·reunion·progress·continue·newlove) + express·boundary도 "‘{선택지}’ 쪽으로 정했다면, 이번 주에 이것부터".
//     safety.level === "watch"면 마지막 쪽(11쪽) 맨 아래 작은 글씨 한 줄 "※ {copy.safety.watch_note}"(굵게·말투 변환 제외 — 돈 안내와 같은 처리)
//     + 쪽 객체에 fineprint 칸(결제 전에도 렌더러가 맨 아래에 그림). 결과·방향은 그대로.
//   E(7~10쪽 AI)가 없으면(고민 미작성·AI 실패) 8쪽 = 기존 열쇠 문단 + 기존 신호(DB), 9·10쪽 = 기존 DB 처방·실천, 계획 블록 없음.
import { balance, boldFirstLines } from "./endings.js";
import { cleanOption, reasonFallback, cardSide, STRENGTH_WORD, isDecisionFrame } from "./decision.js";
import { watchNoteFor } from "../tarot/safety.js";
import { GWA_WA } from "./josa.js";

export const V4_COPY = {
  frame_title: "**What we'll keep in view**",
  six_months: "This tarot reading looks at about six months ahead.",
  summary_title: "Putting your three cards together",
  direction_title: "Where the cards point",
  decide_title: "How to tell which way it goes",
  plan_head: { stay: "If you've decided to stay, here's where to start this week", move: "If you've decided to move on, here's where to start this week", relation: "If you've decided on ‘{option}’, here's where to start this week", none: "Here's where to start this week" },
  change_title: "How things will change from here",
  change_signs: "Changes you may notice",
  practice_intro: "These are small practices that bring the page 8 suggestions into this week.",
  teaser7_decision: "Where the cards point, how things ease in that direction, and your plan for this week",
  teaser7_plan: "How fast things ease and why, and what to do this week",
  teaser7_plain: "How fast things ease and why we read it that way",
  teaser8: "What the third card changes, and three changes you may notice soon",
};
// 계획 블록 머리말(R11) — 렌더러는 이 줄들을 소제목으로 그림
export const CHANGE_TABLES = ["job", "start", "move"]; // 그 밖(관계형 5개 + express·boundary)은 ‘{선택지}’ 머리말
export const RELATION_TABLES = ["approach", "reunion", "progress", "continue", "newlove", "express", "boundary"];
export const PLAN_HEADS = V4_COPY.plan_head;
export function planHead(lean, heads = PLAN_HEADS) {
  if (!lean) return heads.none;
  if (lean.forecast && heads.forecast) return heads.forecast; // v4.3
  if (lean.mode !== "rank" && (CHANGE_TABLES.includes(lean.table) || !lean.table)) return heads[lean.side];
  return heads.relation.replaceAll("{option}", lean.option);
}
// 렌더러 소제목(굵게·크게 그리는 고정 줄). 계획 머리말은 관계형에서 선택지 이름이 들어가므로 PLAN_HEAD_RE로도 확인
export const PLAN_HEAD_RE = /where to start this week$/;
export const SUBHEADS = [V4_COPY.summary_title, V4_COPY.direction_title, V4_COPY.decide_title, V4_COPY.change_signs, PLAN_HEADS.stay, PLAN_HEADS.move, PLAN_HEADS.none,
  "What The Key Ahead changes", "Why we read it this way", "If you notice changes like these, things are starting to ease", "How we read your three cards", "Your tendencies, through the cards", "Shall we sit with these questions?"];
const FLOW_DEFAULT = { key: "What The Key Ahead changes", reasons: "Why we read it this way", signs: "If you notice changes like these, things are starting to ease" };

// R7 5쪽 첫 문구(결론을 숨김) — 2안 끝말 "한쪽을 골랐어요" → "한 방향으로 정리됩니다"(owner 2026-10-22 사용자 피드백: 직관적이지 않음) — C의 teaser가 없거나 검증에 걸렸을 때 코드가 채움. 닉네임·duration·선택지 이름으로 일반화
export function teaserFallback({ strength, name, frame }) {
  const dur = frame && frame.duration ? String(frame.duration).trim() : "";
  if (strength === "strong" || strength === "clear")
    return { headline: `Your question, ${name}, and three cards that answered`, lead: `For the question you've held onto ${dur ? `for ${dur}` : "for so long"}, the three cards gave a clearer answer than you might expect.` };
  const opts = (frame && frame.options ? frame.options : []).map(cleanOption);
  const listed = opts.length >= 2 ? opts.slice(0, -1).map((o) => `‘${o}’`).join(", ") + ` or ‘${opts[opts.length - 1]}’` : "the two options";
  return { headline: `After ${dur ? dur : "a long time"} of asking, the three cards settle on one direction`, lead: `Whether it's ${listed} comes out at the end of the story the three cards tell, one by one.` };
}

// ① 9쪽 '오늘' 실천 — 앞으로의 열쇠 카드(번호_up/rev)로 DB에서. ‘{결론}’은 결론 선택지(없으면 '이 고민을 푸는')
export function todayFromDb(data, keyCard, lean = null) {
  const T = data && data.today_practices && data.today_practices.items;
  if (!T || !keyCard || keyCard.no == null) return null;
  const x = T[`${keyCard.no}_${keyCard.reversed ? "rev" : "up"}`];
  if (!x) return null;
  const fill = (t) => (lean ? String(t).replaceAll("{conclusion}", lean.option) : String(t).replace(/toward ‘\{conclusion\}’/g, "toward working this out").replaceAll("{conclusion}", "this worry"));
  return { title: fill(x.title), how: fill(x.how), time: x.time, why: fill(x.why), from_db: true };
}
const concl = (lean) => `**Put together, the three cards ${STRENGTH_WORD[lean.strength] ? STRENGTH_WORD[lean.strength] + " " : ""}point to ‘${lean.option}’.**`;
const trimJoin = (L) => L.join("\n").trim();

function frameBox(frame, VC = V4_COPY) {
  if (!frame) return null;
  const out = [VC.frame_title];
  const dec = isDecisionFrame(frame);
  if (dec && frame.options && frame.options.length) out.push(`◦ Options: ${frame.options.map(cleanOption).join(" / ")}`);
  if (frame.core_question) out.push(`◦ What you're really asking: ${frame.core_question}`);
  if (dec) {
    if (frame.hidden_question) out.push(`◦ The question to untangle first: ${frame.hidden_question}`);
    if (frame.deadline) out.push(`◦ Deadline: ${frame.deadline}`);
  }
  return out.length > 1 ? out.join("\n") : null;
}

// 기존 7쪽(해결의 흐름)을 머리·열쇠·이유·신호로 나눔
function splitFlow(body, T) {
  const L = String(body || "").split("\n");
  const at = (t) => L.indexOf(t);
  const i = at(T.key), j = at(T.reasons), k = at(T.signs);
  const end = L.length;
  const seg = (a, ...nexts) => (a < 0 ? [] : L.slice(a, Math.min(...nexts.filter((x) => x > a), end)));
  return { pre: L.slice(0, [i, j, k].filter((x) => x >= 0).reduce((a, b) => Math.min(a, b), end)), key: seg(i, j, k), reasons: seg(j, k), signs: seg(k), all: L };
}
const dropTrailingBlank = (L) => { const x = L.slice(); while (x.length && !x[x.length - 1].trim()) x.pop(); return x; };

const copyOf = (data) => {
  const d = (data && data.copy && data.copy.result && data.copy.result.v4) || {};
  return { ...V4_COPY, ...d, plan_head: { ...V4_COPY.plan_head, ...(d.plan_head || {}) } };
};
function planLines(plan, head) {
  return plan ? [head, `◦ When: ${plan.when}`, `◦ Where: ${plan.where}`, `◦ What: ${plan.how}`, ""] : [];
}

export function buildPagesV4({ base, frame = null, lean = null, C = null, E = null, name, paid = false, data = null, safety = null }) {
  const T = (data && data.copy && data.copy.result && data.copy.result.flow_titles) || FLOW_DEFAULT;
  const NEXT = (data && data.copy && data.copy.result && data.copy.result.next_button) || "Next";
  const decision = !!(lean && isDecisionFrame(frame));
  const watchNote = watchNoteFor({ data, safety });
  const VC = copyOf(data);
  const PG = (data && data.copy && data.copy.result && data.copy.result.pages) || [];
  const cardsOf = base.filter((p) => p.card).sort((a, b) => a.page - b.page).map((p) => p.card); // 2~4쪽 카드 정보
  const pages = base.map((p) => ({ ...p }));
  const by = (n) => pages.find((p) => p.page === n);
  const orig = {};
  const out = [];

  for (const pg of pages) {
    const n = pg.page;
    if (n === 1 && pg.body) {
      const b = pg.body.split("\n\n");
      let si = b.findIndex((x) => /First, let's|first, let's/.test(x));
      if (si < 0) si = Math.min(2, b.length - 1);
      b[si] = `${b[si]} ${VC.six_months}`;
      const box = frameBox(frame, VC);
      if (box) b.splice(si + 1, 0, box);
      pg.body = b.join("\n\n");
    }
    if (n === 5 && decision) {
      const parts = String(pg.free || "").split("\n\n");
      orig.headline = parts[0]; orig.lead = parts[1];
      const fb = teaserFallback({ strength: lean.strength, name, frame });
      const th = (C && C.teaser_headline) || fb.headline, tl = (C && C.teaser_lead) || fb.lead;
      const reasons = C && Array.isArray(C.reasons) && C.reasons.length === 3 ? C.reasons : null;
      const summ = [VC.summary_title, ...lean.cards.map((c, i) => {
        const cd = cardsOf[i] || {};
        return `◦ ${c.position} ‘${cd.name}’${cd.reversed ? " (reversed)" : ""} — ${c.reason || (reasons ? reasons[i] : reasonFallback(c.meaning, cardSide(c.score)))}`;
      })];
      const free = [`## ${th}`, tl].join("\n\n") + "\n\n" + summ.join("\n");
      const locked = concl(lean) + "\n\n" + (pg.locked || "");
      pg.free = free; pg.locked = locked;
      if (pg.body) pg.body = free + "\n\n" + locked;
    }
    if (n === 6 && pg.body) pg.body = pg.body.replace(/\s+(For example,|Putting the cards together)/g, "\n\n$1"); // 2026-10-22 owner: D가 "카드를 종합하면"으로 시작하도록 바뀜
    if (n === 7) {
      const F = splitFlow(pg.body, T);
      let body7 = null;
      if (pg.body) {
        if (decision && E && E.direction) {
          const d = E.direction;
          // ② 결론 쪽으로 풀려 가는 흐름(E1 flow)이 맨 위. 옛 E(flow 없음)는 흐름 문단 없이 '언제' 한 줄
          const flow = d.flow && d.flow.head ? [`**${d.flow.head}**`, "", d.flow.body, ""] : [];
          const dirs = [VC.direction_title, `**${d.head}**`, `◦ ${d.lean}`, "", d.body, "", ...(d.flow ? [] : [`◦ When: ${d.timing}`, ""]), VC.decide_title, ...d.if_then.map((x) => `◦ ${x}`), "",
            `**The most important question is this: ${d.decide_by}**`, "", ...planLines(d.plan, planHead(lean, VC.plan_head)), ...(lean.small_note ? [`※ ${lean.small_note}`, ""] : [])];
          body7 = trimJoin([...flow, ...dirs]);
        } else if (decision) { // 결정형인데 E 실패: 코드만으로 방향 블록(카드별 한 줄 + 결론), 계획 블록 없음
          const head = `The three cards ${lean.strength === "strong" ? "clearly point to" : lean.strength === "slight" ? "point a little more to" : "point to"} ‘${lean.option}’.`;
          const dirs = [VC.direction_title, `**${head}**`, ...lean.cards.map((c, i) => { const cd = cardsOf[i] || {};
            return `◦ ${c.position} ‘${cd.name}’${cd.reversed ? " (reversed)" : ""} — ${c.reason || (C && C.reasons && C.reasons[i]) || reasonFallback(c.meaning, cardSide(c.score))}`; }), "",
            ...(lean.small_note ? [`※ ${lean.small_note}`, ""] : [])];
          body7 = trimJoin(dirs);
        } else if (E && E.plan) { // 비결정형 + E: 흐름 머리 + 이렇게 읽은 이유 + 이번 주 계획
          body7 = trimJoin([...dropTrailingBlank([...F.pre, ...F.reasons]), "", ...planLines(E.plan, planHead(null, VC.plan_head))]);
        } else { // E 없음(고민 미작성·AI 실패): 7쪽 = DB 해결의 흐름 전체(머리·열쇠·이유·신호) — 옛 8쪽이 없어졌으므로
          body7 = trimJoin(F.all);
        }
      }
      pg.body = paid ? body7 : pg.body;
      pg.teaser = decision ? VC.teaser7_decision : E && E.plan ? VC.teaser7_plan : VC.teaser7_plain;
      out.push(pg);
      continue;
    }
    if (paid && n === 8 && E && Array.isArray(E.rx)) { // ⑤ 머리말·결론 headline 없이 처방부터
      const body = [];
      for (const r of E.rx) body.push(`▸ ${r.bridge}`, `• ${r.title}`, `${r.how} ${r.why}`, "");
      pg.body = trimJoin(body);
    }
    if (paid && n === 9) {
      const L = String(pg.body || "").split("\n");
      const today = todayFromDb(data, cardsOf[2], decision ? lean : null);
      if (E && E.practices) {
        const pr = { ...E.practices, ...(today ? { today } : {}) }, dl = frame && frame.deadline;
        const body = [VC.practice_intro + (dl ? ` They're set up so you'll have what you need in hand before ${dl}.` : ""), ""];
        for (const [k, lab] of [["today", "Today"], ["three", "Within 3 days"], ["week", "This week"]]) { const x = pr[k]; if (x) body.push(`• ${lab}: ${x.title} (${x.time})`, `${x.how} ${x.why}`, ""); }
        body.push(L[L.length - 1]);
        pg.body = body.join("\n");
      }
    }
    out.push(pg);
  }

  if (watchNote) { // v4.1 watch: 마지막 쪽 맨 아래 작은 글씨 한 줄(본문이 있으면 본문 끝에도)
    const last = out[out.length - 1];
    last.fineprint = `※ ${watchNote}`;
    if (last.body) last.body = `${last.body}\n\n※ ${watchNote}`;
  }
  const fails = [];
  for (const pg of out) {
    pg.next = pg.page === out.length ? null : (pg.next || NEXT);
    for (const f of ["body", "free", "locked"]) {
      if (!pg[f]) continue;
      let L = pg[f].split("\n");
      if (![2, 3, 4].includes(pg.page) || f === "body") L = boldFirstLines(L);
      pg[f] = balance(L, pg.page, fails).join("\n");
    }
    if (pg.says) pg.says = balance(boldFirstLines([...pg.says]), pg.page + 1, fails);
  }
  Object.defineProperty(out, "endingFails", { value: fails, enumerable: false }); // 말투를 못 바꾼 문장 끝(확인용)
  return out;
}
