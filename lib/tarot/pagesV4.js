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
import { watchNoteFor } from "./safety.js";
import { GWA_WA } from "./josa.js";

export const V4_COPY = {
  frame_title: "**이번 고민에서 끝까지 함께 볼 것**",
  six_months: "이 타로는 앞으로 약 6개월의 흐름을 봐요.",
  summary_title: "세 장을 종합하면 이렇습니다",
  direction_title: "카드가 가리키는 방향",
  decide_title: "이렇게 결정해 볼까요?",
  plan_head: { stay: "남는 쪽으로 정했다면, 이번 주에 이것부터", move: "옮기는 쪽으로 정했다면, 이번 주에 이것부터", relation: "‘{option}’ 쪽으로 정했다면, 이번 주에 이것부터", none: "이번 주에 이것부터" },
  change_title: "앞으로 이렇게 바뀔 거예요",
  change_signs: "이런 변화가 보일 거예요",
  rx_intro_decision: "7쪽의 방향과 카드 분석에서 바로 이어지는, 이 고민을 위한 처방 두 가지예요.",
  rx_intro_other: "7쪽의 흐름과 카드 분석에서 바로 이어지는, 이 고민을 위한 처방 두 가지예요.",
  practice_intro: "9쪽 처방을 이번 주로 옮긴 작은 실천이에요.",
  teaser7_decision: "카드가 가리키는 방향, 풀리는 속도와 그렇게 읽은 이유",
  teaser7_plan: "풀리는 속도와 그 이유, 이번 주에 할 일",
  teaser7_plain: "풀리는 속도와 그렇게 읽은 이유",
  teaser8: "세 번째 카드가 바꾸는 것과, 곧 보일 변화 세 가지",
};
// 계획 블록 머리말(R11) — 렌더러는 이 줄들을 소제목으로 그림
export const CHANGE_TABLES = ["job", "start", "move"]; // 그 밖(관계형 5개 + express·boundary)은 ‘{선택지}’ 머리말
export const RELATION_TABLES = ["approach", "reunion", "progress", "continue", "newlove", "express", "boundary"];
export const PLAN_HEADS = V4_COPY.plan_head;
export function planHead(lean, heads = PLAN_HEADS) {
  if (!lean) return heads.none;
  if (lean.mode !== "rank" && (CHANGE_TABLES.includes(lean.table) || !lean.table)) return heads[lean.side];
  return heads.relation.replaceAll("{option}", lean.option);
}
// 렌더러 소제목(굵게·크게 그리는 고정 줄). 계획 머리말은 관계형에서 선택지 이름이 들어가므로 PLAN_HEAD_RE로도 확인
export const PLAN_HEAD_RE = /이번 주에 이것부터$/;
export const SUBHEADS = [V4_COPY.summary_title, V4_COPY.direction_title, V4_COPY.decide_title, V4_COPY.change_signs, PLAN_HEADS.stay, PLAN_HEADS.move, PLAN_HEADS.none,
  "앞으로의 열쇠가 바꾸는 것", "이렇게 읽은 이유", "이런 변화가 보이면, 흐름이 풀리고 있는 거예요", "세 장을 이렇게 읽었어요", "카드로 본 나의 성향", "이 질문들을 곱씹어 볼까요?"];
const FLOW_DEFAULT = { key: "앞으로의 열쇠가 바꾸는 것", reasons: "이렇게 읽은 이유", signs: "이런 변화가 보이면, 흐름이 풀리고 있는 거예요" };

// R7 5쪽 첫 문구(결론을 숨김) — 2안 끝말 "한쪽을 골랐어요" → "한 방향으로 정리됩니다"(owner 2026-10-22 사용자 피드백: 직관적이지 않음) — C의 teaser가 없거나 검증에 걸렸을 때 코드가 채움. 닉네임·duration·선택지 이름으로 일반화
export function teaserFallback({ strength, name, frame }) {
  const dur = frame && frame.duration ? String(frame.duration).trim() : "";
  if (strength === "strong" || strength === "clear")
    return { headline: `${name}님의 질문에, 세 장이 답했어요`, lead: `${name}님이 ${dur || "오래"} 붙들어 온 그 질문에, 세 장은 생각보다 분명한 답을 내놓았어요.` };
  const opts = (frame && frame.options ? frame.options : []).map(cleanOption);
  const listed = opts.length >= 2 ? opts.slice(0, -1).map((o, i, a) => (i === a.length - 1 ? `${o}${GWA_WA(o)}` : `${o}, `)).join("") + ` ${opts[opts.length - 1]}` : "두 선택지";
  return { headline: `${dur ? dur.replace(/째$/, "") + "의" : "오랜"} 질문 끝에, 세 장은 한 방향으로 정리됩니다`, lead: `${listed} 중 어느 쪽인지는, 세 장이 하나씩 들려주는 이야기 끝에 나와요.` };
}

const concl = (lean) => `**세 장을 합치면 ‘${lean.option}’ 쪽이 ${STRENGTH_WORD[lean.strength]}.**`;
const trimJoin = (L) => L.join("\n").trim();

function frameBox(frame, VC = V4_COPY) {
  if (!frame) return null;
  const out = [VC.frame_title];
  const dec = isDecisionFrame(frame);
  if (dec && frame.options && frame.options.length) out.push(`◦ 선택지: ${frame.options.map(cleanOption).join(" / ")}`);
  if (frame.core_question) out.push(`◦ 결국 묻는 것: ${frame.core_question}`);
  if (dec) {
    if (frame.hidden_question) out.push(`◦ 먼저 풀어야 할 물음: ${frame.hidden_question}`);
    if (frame.deadline) out.push(`◦ 기한: ${frame.deadline}`);
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
  return plan ? [head, `◦ 언제: ${plan.when}`, `◦ 어디서: ${plan.where}`, `◦ 무엇을: ${plan.how}`, ""] : [];
}

export function buildPagesV4({ base, frame = null, lean = null, C = null, E = null, name, paid = false, data = null, safety = null }) {
  const T = (data && data.copy && data.copy.result && data.copy.result.flow_titles) || FLOW_DEFAULT;
  const NEXT = (data && data.copy && data.copy.result && data.copy.result.next_button) || "다음으로";
  const decision = !!(lean && isDecisionFrame(frame));
  const watchNote = watchNoteFor({ data, safety });
  const VC = copyOf(data);
  const PG = (data && data.copy && data.copy.result && data.copy.result.pages) || [];
  const p8 = PG.find((x) => x.key === "change") || { title: VC.change_title, teaser: VC.teaser8 };
  const blur8 = (((data && data.copy && data.copy.result && data.copy.result.blur_samples) || {}).pages || {})["8"] || null;
  const cardsOf = base.filter((p) => p.card).sort((a, b) => a.page - b.page).map((p) => p.card); // 2~4쪽 카드 정보
  const pages = base.map((p) => ({ ...p }));
  const by = (n) => pages.find((p) => p.page === n);
  const orig = {};
  const out = [];

  for (const pg of pages) {
    const n = pg.page;
    if (n === 1 && pg.body) {
      const b = pg.body.split("\n\n");
      let si = b.findIndex((x) => x.includes("먼저 세 장이"));
      if (si < 0) si = Math.min(2, b.length - 1);
      b[si] = b[si].includes("먼저 세 장이") ? b[si].replace("먼저 세 장이", `${VC.six_months} 먼저 세 장이`) : `${b[si]} ${VC.six_months}`;
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
        return `◦ ${c.position} ‘${cd.name}’${cd.reversed ? "(역방향)" : ""} — ${reasons ? reasons[i] : reasonFallback(c.meaning, cardSide(c.score))}`;
      })];
      const free = [`## ${th}`, tl].join("\n\n") + "\n\n" + summ.join("\n");
      const locked = concl(lean) + "\n\n" + (pg.locked || "");
      pg.free = free; pg.locked = locked;
      if (pg.body) pg.body = free + "\n\n" + locked;
    }
    if (n === 6 && pg.body) pg.body = pg.body.replace(/\s+(예를 들어|카드를 종합하면)/g, "\n\n$1"); // 2026-10-22 owner: D가 "카드를 종합하면"으로 시작하도록 바뀜
    if (n === 7) {
      const F = splitFlow(pg.body, T);
      let body7 = null, body8 = null;
      if (pg.body) {
        if (decision && E && E.direction) {
          const d = E.direction;
          const dirs = [VC.direction_title, `**${d.head}**`, `◦ ${d.lean}`, "", d.body, "", `◦ 언제: ${d.timing}`, "", VC.decide_title, ...d.if_then.map((x) => `◦ ${x}`), "",
            `**가장 중요한 질문은 이거예요: ${d.decide_by}**`, "", ...planLines(d.plan, planHead(lean, VC.plan_head)), ...(lean.small_note ? [`※ ${lean.small_note}`, ""] : [])];
          body7 = trimJoin([...F.pre, ...dirs]);
        } else if (decision) { // 결정형인데 E 실패: 코드만으로 방향 블록(카드별 한 줄 + 결론), 계획 블록 없음
          const head = `세 장은 ${lean.strength === "strong" ? "뚜렷하게 " : lean.strength === "slight" ? "조금 더 " : ""}‘${lean.option}’ 쪽이에요.`;
          const dirs = [VC.direction_title, `**${head}**`, ...lean.cards.map((c, i) => { const cd = cardsOf[i] || {};
            return `◦ ${c.position} ‘${cd.name}’${cd.reversed ? "(역방향)" : ""} — ${(C && C.reasons && C.reasons[i]) || reasonFallback(c.meaning, cardSide(c.score))}`; }), "",
            ...(lean.small_note ? [`※ ${lean.small_note}`, ""] : [])];
          body7 = trimJoin([...F.pre, ...dirs]);
        } else if (E) { // 비결정형 + E: 흐름 머리 + 이렇게 읽은 이유 + 이번 주 계획 (열쇠가 바꾸는 것·신호는 8쪽 E.change가 맡음)
          body7 = trimJoin([...dropTrailingBlank([...F.pre, ...F.reasons]), "", ...planLines(E.plan, planHead(null, VC.plan_head))]);
        } else { // E 없음: 7쪽 = 머리 + 이유, 열쇠·신호는 8쪽으로
          body7 = trimJoin([...F.pre, ...F.reasons]);
        }
        if (E && E.change) {
          const ch = E.change;
          body8 = [`**${ch.head}**`, "", ch.body, "", VC.change_signs, ...ch.signs.map((x) => `◦ ${x}`)].join("\n");
        } else body8 = trimJoin([...dropTrailingBlank(F.key), "", ...F.signs]);
      }
      pg.body = paid ? body7 : pg.body;
      pg.teaser = decision ? VC.teaser7_decision : E ? VC.teaser7_plan : VC.teaser7_plain;
      out.push(pg);
      out.push({ page: 8, title: p8.title, access: p8.access || "유료", teaser: p8.teaser, body: paid ? body8 : null, blur: paid ? null : (blur8 || pg.blur), next: pg.next, back: pg.back });
      continue;
    }
    if (n >= 8) pg.page = n + 1;
    if (paid && n === 8) {
      const head = decision && orig.headline ? [orig.headline, "", orig.lead, ""] : [];
      if (E && Array.isArray(E.rx)) {
        const body = [...head, decision ? VC.rx_intro_decision : VC.rx_intro_other, ""];
        for (const r of E.rx) body.push(`▸ ${r.bridge}`, `• ${r.title}`, `${r.how} ${r.why}`, "");
        pg.body = trimJoin(body);
      } else pg.body = trimJoin([...head, pg.body]);
    }
    if (paid && n === 9) {
      const L = String(pg.body || "").split("\n");
      if (E && E.practices) {
        const pr = E.practices, dl = frame && frame.deadline;
        const body = [VC.practice_intro + (dl ? ` ${dl} 답하기 전에 쓸 재료가 손에 남도록 짰습니다.` : ""), ""];
        for (const [k, lab] of [["today", "오늘"], ["three", "3일 안에"], ["week", "이번 주"]]) { const x = pr[k]; body.push(`• ${lab}: ${x.title} (${x.time})`, `${x.how} ${x.why}`, ""); }
        body.push(L[L.length - 1]);
        pg.body = body.join("\n");
      } else pg.body = pg.body.replace("8쪽 처방", "9쪽 처방");
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
