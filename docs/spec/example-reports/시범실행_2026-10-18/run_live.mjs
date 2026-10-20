// 실제 AI 시범 실행 도우미 (2026-10-18). 운영 API 키가 없어, '모델' 자리는 프롬프트만 받은 별도 에이전트가 맡음.
//   node run_live.mjs prep-a <pkg>                 → 사례마다 A 프롬프트(system/user) 파일
//   node run_live.mjs prep-cd <pkg>                → A 결과로 안전 합침·카드 뽑기(무작위) → C·D 프롬프트 파일
//   node run_live.mjs assemble <pkg>               → C·D 결과 검증 → 결과 8쪽 조립 → 리포트 md + 넘겨 보기 pages json
import fs from "node:fs";
import path from "node:path";
const [mode, pkgArg] = process.argv.slice(2);
const PKG = path.resolve(pkgArg), C = path.join(PKG, "03_코드"), OUT = path.dirname(new URL(import.meta.url).pathname);
const data = JSON.parse(fs.readFileSync(path.join(PKG, "02_데이터/tarot_data.json"), "utf8"));
const md = fs.readFileSync(path.join(PKG, "01_설계/ai-prompts-tarot-v2.md"), "utf8");
const { screenText, mergeSafety } = await import(path.join(C, "safety.js"));
const { validateClassification } = await import(path.join(C, "selectCards.js"));
const { createShuffle, picksFromSlots } = await import(path.join(C, "deck.js"));
const R = await import(path.join(C, "assembleReport.js"));
const CASES = JSON.parse(fs.readFileSync(path.join(OUT, "cases.json"), "utf8"));
const block = (sec) => md.split(sec)[1].split("```")[1].replace(/^\n/, "").trim();
const common = md.split("## 0. 공통 규칙")[1].split("```")[1].replace(/^\n/, "").trim();
const sysA = block("### A-2.");
const sysC = block("## C. ").replace(/\{공통 규칙 1~\d+[을를] 여기에 그대로 붙임\}/, common);
const sysD = block("## D. ").replace(/\{공통 규칙 1~\d+[을를] 여기에 그대로 붙임\}/, common);
const w = (f, t) => fs.writeFileSync(path.join(OUT, f), t);
const rd = (f) => fs.readFileSync(path.join(OUT, f), "utf8");
const json = (t) => JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));

if (mode === "prep-a") {
  for (const c of CASES) { w(`${c.key}_A_system.txt`, sysA); w(`${c.key}_A_user.txt`, `<worry>${c.worry}</worry>`); }
  console.log("A 프롬프트 준비:", CASES.map((c) => c.key).join(", "));
} else if (mode === "prep-cd") {
  for (const c of CASES) {
    const ai = json(rd(`${c.key}_A_out.txt`));
    const err = validateClassification(ai, data);
    const kw = screenText(c.worry, data.safety_keywords), safety = mergeSafety(kw, ai);
    const sh = createShuffle(data); // 실제처럼 무작위 셔플·방향
    const slots = [0, 1, 2].map(() => Math.floor(Math.random() * 22));
    const uniq = [...new Set(slots)]; while (uniq.length < 3) { const s = Math.floor(Math.random() * 22); if (!uniq.includes(s)) uniq.push(s); }
    let picks = picksFromSlots(sh, uniq.slice(0, 3), data);
    if (process.env.KEEP && fs.existsSync(path.join(OUT, `${c.key}_state.json`))) { // 다시 돌릴 때 같은 카드로 비교
      const prev = JSON.parse(rd(`${c.key}_state.json`)); prev.picks.forEach((p) => (sh.reversed[p.id] = p.reversed));
      picks = picksFromSlots(sh, prev.picks.map((p) => sh.order.indexOf(p.id)), data);
    }
    const state = { ai, err, keyword: kw, safety, picks: picks.map((p) => ({ id: p.card.id, reversed: p.reversed })) };
    w(`${c.key}_state.json`, JSON.stringify(state, null, 1));
    w(`${c.key}_C_system.txt`, sysC); w(`${c.key}_C_user.txt`, R.buildLinkUserBlock({ name: c.name, worryText: c.worry, cls: ai, picks, data }));
    w(`${c.key}_D_system.txt`, sysD); w(`${c.key}_D_user.txt`, R.buildStoryUserBlock({ name: c.name, worryText: c.worry, cls: ai, picks, data, safety }));
    console.log(c.key, "분류 검증:", err.length ? err : "통과", "· 안전:", JSON.stringify(safety), "· 카드:", picks.map((p) => p.card.name + (p.reversed ? "(역)" : "")).join(" → "));
  }
} else if (mode === "assemble") {
  for (const c of CASES) {
    const st = JSON.parse(rd(`${c.key}_state.json`)), ai = st.ai;
    const sh = createShuffle(data); st.picks.forEach((p) => (sh.reversed[p.id] = p.reversed));
    const picks = picksFromSlots(sh, st.picks.map((p) => sh.order.indexOf(p.id)), data);
    const rawC = rd(`${c.key}_C_out.txt`), rawD = rd(`${c.key}_D_out.txt`);
    let jc = null; try { jc = json(rawC); } catch {}
    const links = R.parseLinks(jc, { violence: st.safety.violence });
    const sa = R.parseStoryApply(rawD.slice(rawD.indexOf("{"), rawD.lastIndexOf("}") + 1), { violence: st.safety.violence });
    const check = {
      headline: !!(links && links.headline), lead: !!(links && links.lead),
      lines: links ? ["now", "hold", "step"].map((k) => !!(links[k] && links[k].line)) : [false, false, false],
      asks: links ? ["now", "hold", "step"].map((k) => (links[k] ? links[k].asks.length : 0)) : [0, 0, 0],
      story: !!sa.story, apply: !!sa.apply, storyHead: !!sa.storyHead, applyHead: !!sa.applyHead };
    const args = { name: c.name, cls: ai, picks, data, links, safety: st.safety, story: sa.story, apply: sa.apply, storyHead: sa.storyHead, applyHead: sa.applyHead, worryText: c.worry };
    const U = R.buildPages({ ...args, paid: false }), P = R.buildPages({ ...args, paid: true });
    const pg = (p) => `## ${p.page}쪽 · ${p.title} (${p.access})\n\n${p.body}${p.next ? `\n\n[${p.next} →]` : ""}`;
    const notice = R.buildSafetyNotice({ data, safety: st.safety });
    const rep = [`# 시범 실행 — ${c.label}`, "", `> ${c.name}님 · 고민: "${c.worry}"`, "",
      "## 분류 결과(A)", "```json", JSON.stringify(ai), "```", `- 분류 검증: ${st.err.length ? st.err.join(", ") : "통과"} · 키워드: ${JSON.stringify(st.keyword)} · 최종 안전: ${JSON.stringify(st.safety)}`,
      `- 카드(무작위 셔플): ${picks.map((p) => `${p.positionName} ${p.card.name}${p.reversed ? "(역방향)" : ""}`).join(" → ")}`,
      `- C·D 출력 검증: ${JSON.stringify(check)}`, `- 조합 해석: ${JSON.stringify(U[4].combo)}`, "",
      notice ? notice + "\n" : "", "# 무료 (1~4쪽)", "", U.slice(0, 4).map(pg).join("\n\n---\n\n"), "", "---", "",
      `## 5쪽 · ${U[4].title} (일부 무료)`, "", U[4].free, "", "> ── 여기부터 블러 + 결제 카드 ──", "", "# 결제 후", "", U[4].locked, "", "---", "",
      P.slice(5).map(pg).join("\n\n---\n\n")].join("\n");
    w(`${c.key}_report.md`, rep);
    w(`${c.key}_pages.json`, JSON.stringify({ picks: picks.map((p) => ({ no: p.card.no, id: p.card.id, name: p.card.name, character: p.card.character, position: p.positionName, reversed: p.reversed })), unpaid: U, paid: P, copy: data.copy.result }, null, 1));
    console.log(c.key, JSON.stringify(check));
  }
}
