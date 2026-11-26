// challenge.js — 작심삼일 챌린지 (v3.9)
// 순서: 1일차 적기 → 2일차 해 보기 → 3일차 정리하기 → 1주일 → 1달 (CSO 11/23)
// 세 겹으로 고름 (CSO 11/24 "좋아!"):
//   ① 3번 카드(앞으로의 열쇠) → 활동 가족(card_family). 2일차 → 1주일 → 1달로 한 단계씩 커짐.
//   ② 고민 영역(세부 코드 앞머리) → 2일차 아래 고민과 잇는 한 줄(tie). 1일차·3일차는 첫 갈래 종류 × 영역.
//   ③ 2번 카드(지금의 흐름) × 3번 카드의 활동 묶음 짝 → 왜 이 활동인지 한 줄(pair).
// 위기 단계에서도 숨기지 않음, 하루 빠져도 이어서 함, 강도 낮추기 없음(CSO 11/24).
// cdb = 02_데이터/challenge_lines.json
import { I_GA, EUL_REUL } from "./josa.js";
export function domainOf(subId, cdb) {
  if (!subId) return "공통";
  const pre = String(subId).split("-")[0];
  for (const [d, list] of Object.entries(cdb.domain_prefix)) if (list.includes(pre)) return d;
  return "공통";
}
const noOf = (k) => { const n = parseInt(String(k ?? ""), 10); return isNaN(n) ? null : n; };
export function familyOf(cardKey, cdb) { const n = noOf(cardKey); return n === null ? null : cdb.card_family[String(n)] || null; }
// v3.13 (CSO 11/26 「1안!!」): 활동 후보 = 첫 갈래 뿌리 → 반대 짝 뿌리 → 세부별 목록. 그 안에서 3번 카드가 고름(같은 가족 → 같은 묶음 → 세부별 목록에도 있는 것 → 첫째)
export function candidatesFor(subId, branchCode, cdb) {
  const W = cdb.worry_families, RL = cdb.root_link;
  const code = branchCode || (subId ? `${subId}-1` : null);
  if (RL && code) {
    const roots = RL.branch_roots[code] || [];
    const byRoot = [...new Set(roots.flatMap((r) => RL.root_families[r] || []))];
    if (byRoot.length) return { list: byRoot, from: "root", branch: code };
    const byPair = [...new Set(roots.flatMap((r) => RL.root_families[RL.root_pair[r]] || []))];
    if (byPair.length) return { list: byPair, from: "pair", branch: code };
  }
  if (!W) return { list: [], from: "card", branch: code };
  const pre = subId ? String(subId).split("-")[0] : null;
  return { list: (subId && W.by_sub[subId]) || (pre && W.by_prefix[pre]) || W.default, from: "worry", branch: code };
}
export function pickFamily(subId, card3, cdb, branchCode = null) {
  const own = familyOf(card3, cdb) || cdb.card_family["12"];
  const { list } = candidatesFor(subId, branchCode, cdb);
  if (!list.length) return own;
  if (list.includes(own)) return own;
  const g = cdb.families[own].group, same = list.find((k) => cdb.families[k].group === g);
  if (same) return same;
  // 카드와 닿는 것이 없으면, 뿌리 후보 가운데 세부별 목록(CSO 승인)에도 있는 것을 먼저
  const W = cdb.worry_families, pre = subId ? String(subId).split("-")[0] : null;
  const wl = W ? ((subId && W.by_sub[subId]) || (pre && W.by_prefix[pre]) || W.default) : [];
  return list.find((k) => wl.includes(k)) || list[0];
}
// card2·card3: "12_up" 꼴(카드 키). card2가 없으면 짝 줄 없음. card3이 없으면 12번(쉼) 가족.
export function buildChallenge({ subId = null, branchKind = null, branchCode = null, card2 = null, card3 = null }, cdb) {
  const kind = ["마음", "상태", "여건", "선호"].includes(branchKind) ? branchKind : "마음";
  const dom = domainOf(subId, cdb);
  // v3.12 (CSO 11/26): 활동은 고민 쪽 목록에서(2안), 3번 카드는 목록 안에서 고르고 방식을 한 줄 더함(A안)
  const cand = candidatesFor(subId, branchCode, cdb), fk = pickFamily(subId, card3, cdb, branchCode), f = cdb.families[fk];
  const n3 = noOf(card3), k3 = n3 === null ? null : `${n3}_${String(card3).endsWith("rev") ? "rev" : "up"}`;
  const cardName = n3 === null ? "" : (cdb.card_names || {})[String(n3)] || "";
  const how = cdb.card_how && k3 ? cdb.card_how.lines[k3] || "" : "";
  // v3.12: 짝 줄 = 2번 카드 반 문장(22×정·역) + 활동 가족 반 문장(13). pair_v2가 없으면 예전 묶음 짝
  const PV = cdb.pair_v2, n2 = noOf(card2), k2 = n2 === null ? null : `${n2}_${String(card2).endsWith("rev") ? "rev" : "up"}`;
  const f2 = familyOf(card2, cdb);
  const pair = PV ? (k2 && PV.now[k2] ? PV.tpl.replace("{now}", PV.now[k2]).replace("{key}", PV.key[fk]) : "") : (f2 ? cdb.pair[`${cdb.families[f2].group}|${f.group}`] || "" : "");
  const d1 = cdb.day1[dom][kind], d3 = cdb.day3[dom][kind], s = (x) => ({ title: x.title, text: x.text, proof: x.proof, story: x.story, practice_id: x.practice_id || null });
  return {
    domain: dom, kind, family: fk, family_name: f.name, group: f.group, master_family: f.master || null, picked_from: cand.from, branch: cand.branch, pair, card3_name: cardName, how,
    later_how: how && cardName ? cdb.card_how.later.replace("{card}", cardName + I_GA(cardName)) : "",
    days: [
      { key: "day1", label: "1일차 · 적기", text: d1.text, proof: d1.proof, story: d1.story },
      { key: "day2", label: "2일차 · 해 보기", ...s(f.day2), tie: f.tie[dom], how, how_label: how && cardName ? cdb.card_how.label.replace("{card}", cardName + I_GA(cardName)) : null, home: f.home },
      { key: "day3", label: "3일차 · 정리하기", text: cdb.day3_lead.replace("‘{title}’를", `‘${f.day2.title}’${EUL_REUL(f.day2.title)}`).replace("{title}", f.day2.title) + " " + d3.text, proof: d3.proof, story: d3.story },
      { key: "week", label: "1주일", ...s(f.week) },
      { key: "month", label: "1달", ...s(f.month) },
    ],
  };
}

// ── v3.10 결과 9쪽(작심삼일 챌린지 카드) · 10쪽(쏘웰라 대화 화면) ──
// CSO 11/24: 9/10 '이번 주 실천 카드'를 작심삼일로 대체(쏘웰라 시안 "테스트 결과 마지막 화면"의 1·2·3일차 모양),
// 10/10은 그림 대신 쏘웰라 대화 화면을 그려 더 생긴 고민을 묻고 답을 받는 모습 + 작심삼일 챌린지 권유.
const nm = (s, name) => String(s || "").replaceAll("{name}", name || "");
export function challengePage9(ch, cdb) {
  const P = cdb.page9;
  const lines = [P.sub, ""];
  if (ch.pair) lines.splice(0, 0, ch.pair);
  for (const d of ch.days.slice(0, 3)) {
    lines.push(`• ${d.label}: ${d.title || d.text}`);
    if (d.title) lines.push(d.text);
    if (d.tie) lines.push(d.tie);
    if (d.how) lines.push(`${d.how_label || "카드가 말하는 방식"}: ${d.how}`);
    if (d.home) lines.push(`${P.home_label}: ${d.home}`);
    lines.push(`${P.proof_label} · ${d.proof}`, "");
  }
  lines.push(P.later_title);
  if (ch.later_how) lines.push(ch.later_how);
  for (const d of ch.days.slice(3)) lines.push(`• ${d.label}: ${d.title}`, d.text);
  lines.push("", P.skip, P.share, `[${P.cta}]`);
  return {
    kind: "challenge", title: P.title, access: "유료",
    challenge: { pair: ch.pair, sub: P.sub, days: ch.days, later_title: P.later_title, proof_label: P.proof_label, home_label: P.home_label, skip: P.skip, share: P.share, cta: P.cta, family: ch.family, domain: ch.domain, kind: ch.kind, later_how: ch.later_how || "" },
    body: lines.join("\n"),
  };
}
export function sowellaPage10({ name = "", domain = "공통", paid = true }, cdb) {
  const P = cdb.page10, C = cdb.sowella_chat[domain] || cdb.sowella_chat["공통"];
  const chat = { title: P.chat_title, input: P.chat_input, messages: [{ from: "user", text: C.q }, { from: "sowella", text: C.a }] };
  const lantern = paid ? { title: P.lantern.title, body: nm(P.lantern.body, name), cta: P.lantern.cta } : null;
  const body = [P.sub, "", `[${P.cta_chat}]`, "", P.challenge_line, `[${P.cta_challenge}]`];
  if (lantern) body.push("", lantern.title, lantern.body, `[${lantern.cta}]`);
  return { kind: "sowella_chat", title: P.title, access: "유료", chat, sub: P.sub, cta_chat: P.cta_chat, challenge_line: P.challenge_line, cta_challenge: P.cta_challenge, lantern, body: body.join("\n") };
}

// ── v3.11 쏘웰라로 넘김 (CSO 11/25 "꼭 작심삼일 챌린지 자료 쏘웰라로 넘기도록 해줘") ──
// 결제 뒤 결과를 만들 때 서버가 이 묶음을 계정에 저장 → 쏘웰라 갓생러모임이 같은 계정으로 읽어 그대로 보여 줌.
// 주소(URL)에는 개인 정보를 넣지 않고 result_id만 넘김. 고민 원문은 넣지 않음.
export const HANDOFF_SCHEMA = "swh.challenge.v2";
// v3.13 (CSO 11/26 「쏘웰라에 1,2,3일차 + 1주일 + 1달 챌린지랑 테스트 결과 전체 + 일상어 고민 넘기는 것까지 꼭」):
//   v2 = v1 + worry.text(이용자가 쓴 고민 원문) + result(결과 쪽 전체) + plan[].practice_id(쏘웰라 실천 코드). 이메일은 넣지 않음.
const PAGE_KEYS = ["page", "title", "access", "kind", "question", "says", "body", "free", "locked", "teaser", "heading", "intro", "card", "cards", "challenge", "chat", "lantern", "fineprint"];
export function resultForHandoff(pages) {
  return (pages || []).map((p) => Object.fromEntries(PAGE_KEYS.filter((k) => p[k] != null).map((k) => [k, k === "challenge" ? { ...p[k], days: undefined } : p[k]])));
}
export function challengeHandoff(ch, { resultId, userId = null, nickname = "", subId = null, branch = null, card2 = null, card3 = null, card1 = null, paid = true, createdAt = null, version = "3.13", worryText = null, pages = null } = {}) {
  if (!resultId) throw new Error("challengeHandoff: resultId가 필요해요");
  return {
    schema: HANDOFF_SCHEMA, source: "tarot", source_version: version,
    result_id: String(resultId), user_id: userId, nickname, created_at: createdAt || new Date().toISOString(),
    worry: { text: worryText ? String(worryText) : null, domain: ch.domain, sub_id: subId, branch_kind: ch.kind, branch_code: (branch && branch.code) || ch.branch || null, branch_text: (branch && branch.text) || null },
    cards: { past: card1, now: card2, key: card3 },
    activity: { family: ch.family, name: ch.family_name, group: ch.group, master_family: ch.master_family || null, picked_from: ch.picked_from || null },
    pair: ch.pair || "",
    plan: ch.days.map((d) => ({ key: d.key, label: d.label, title: d.title || null, text: d.text, tie: d.tie || null, how: d.how || null, how_label: d.how_label || null, home: d.home || null, proof: d.proof, story: d.story, practice_id: d.practice_id || null })),
    rules: { order: ["day1", "day2", "day3", "week", "month"], skip_ok: true, stamps_to_finish: 3 },
    result: pages ? resultForHandoff(pages) : null,
    lantern_ticket: !!paid,
    status: "ready",
  };
}
export const sowellaLink = (resultId, to = "challenge") => `/sowella/${to}?from=tarot&rid=${encodeURIComponent(String(resultId))}`;
