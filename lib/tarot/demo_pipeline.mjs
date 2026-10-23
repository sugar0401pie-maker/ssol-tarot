// v4.1 변경: 05-재회(서연님, fixtures/05-재회 — 가상: 헤어진 지 석 달, 다시 연락해 볼까) 추가. A2는 고민 틀 v4.6 형식(table reunion, mode axis),
//   retrieve 색인(08_판별DB/data/frame_gold_v1.jsonl)으로 A2 사용자 입력(비슷한 정답 5개)과 두 번째 의견(투표 표 vs A2 표)까지 재현해 input.txt에 적음.
// v4.2: 10쪽(옛 8쪽 뺌). v4.0 변경: 결과를 넘겨 보기 11쪽(pagesV4.buildPagesV4)으로 조립. 기존 3건은 결정형이 아니고 E(7~10쪽 AI) 예시가 없어 'E 없는 비결정형' 경로,
//   04-이직-결정(도현님, fixtures/도현)은 고민 틀(A2) → 점수표 방향 계산(decision.lean) → C·E 검증(validateV4) → 11쪽 결정형 경로.
//   기존 10쪽(v3.3) 예시는 01_설계/example-reports/지난버전/v3.3_10쪽/에 남겨 둠.
// 전체 흐름 데모 v3.0 (AI 호출 없이): 안전 확인 → 22장 셔플(방향 포함) → 3자리 뽑기(지나온 길 · 지금의 흐름 · 앞으로의 열쇠)
// → (3장째 뽑는 순간) C 결과 검증 → (결제 후) D 결과 검증 → 넘겨 보기 10쪽 조립
// 실행: node demo_pipeline.mjs → 01_설계/example-reports/ 에 *-input.txt, *-full.md 생성
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createShuffle, picksFromSlots } from "./deck.js";
import { screenText, mergeSafety } from "./safety.js";
import { buildPages, buildSafetyNotice, buildLinkUserBlock, buildStoryUserBlock, parseLinks, parseStoryApply } from "./assembleReport.js";
import { buildPagesV4 } from "./pagesV4.js";
import { runCase } from "./fixtures/runCase.mjs";
import { buildIndex } from "./retrieve.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(here, "../02_데이터/tarot_data.json"), "utf8"));
const exDir = path.join(here, "../01_설계/example-reports");
const tables = JSON.parse(fs.readFileSync(path.join(here, "../02_데이터/decision_tables.json"), "utf8"));
// 한 쪽을 마크다운으로 (2~4쪽은 카드 정보·카드 설명·자리 질문을 함께)
const pg = (p) => `## ${p.page}쪽 · ${p.title} (${p.access})\n\n${p.card ? `[카드 화면 가득] ${p.card.name} — ${p.card.character}${p.card.reversed ? " · 역방향" : ""} · #${p.card.keywords.join(" #")} · 원래 타로 ${p.card.arcana}\n\n${p.saysTitle}\n\n${p.says.join("\n\n[역방향] ")}\n\n### ${p.question}\n\n` : ""}${p.body}`;
function writeReport(key, head, notice, U, Pd) {
  const p5 = U.find((p) => p.page === 5);
  fs.writeFileSync(path.join(exDir, `${key}-full.md`),
    [head, "", notice ? notice + "\n" : "", U.slice(0, 4).map(pg).join("\n\n---\n\n"), "", "---", "",
      `## 5쪽 · ${p5.title} (일부 무료)`, "", p5.free, "", "> ── 여기부터 블러 + 결제 카드 ──", "", p5.locked, "", "---", "",
      Pd.slice(5).map(pg).join("\n\n---\n\n"), ""].join("\n"));
}

const CASES = [
  { key: "01-연애-서운함", name: "지수",
    worry: "요즘 남자친구가 연락이 뜸해졌어요. 바쁘다고는 하는데, 서운하다고 말하면 귀찮아할 것 같아서 그냥 괜찮은 척하고 있어요. 이러다 저만 지쳐 버릴까 봐 걱정돼요.",
    ai: { domain: "LOV", emotions: ["HUR", "LON"], need: "CONNECT", crisis_level: "none", violence: false },
    picks: ["pearl", "puffed", "swim_together"], reversed: ["puffed"],
    C: { headline: "괜찮은 척해 온 날들을 지나, 바라는 연결 쪽으로",
      lead: "지수님의 세 장은 서운함을 혼자 삼켜 온 시간이 지금의 지침으로 이어지고 있다고 말해요.",
      now: { line: "연락이 뜸할 때마다 '바쁘겠지' 하며 서운함을 혼자 삼켜 왔을 수 있어요.", ask: "그동안 서운한 날에도 귀찮아할까 봐 괜찮은 척으로 넘겨 오지 않았나요?" },
      hold: { line: "말을 꺼낼까 말까 망설이는 사이, 괜찮은 척하는 데 드는 힘이 점점 커지고 있습니다.", ask: "혹시 지금 괜찮은 척하느라 오히려 내가 먼저 지쳐 가고 있지는 않나요?" },
      step: { line: "연락의 횟수보다 내가 바라는 연결이 어떤 모양인지가 이 고민의 열쇠예요.", ask: "앞으로 연락 횟수를 세는 쪽과 내가 바라는 연결의 모양을 아는 쪽 중 어느 쪽에 더 마음을 두고 싶나요?" } },
    D: { story_head: "서운함을 혼자 삼켜 온 날들이 지금의 지침으로 이어지고 있어요.",
      story: "지수님은 연락이 뜸할 때마다 '바쁘겠지' 하며 서운함을 혼자 삼키는 방식으로 관계를 지켜 왔을 수 있어요. 서운하다는 말 대신 '괜찮아'를 먼저 보낸 날도 있었을 거예요.\n\n그 방식이 쌓여, 지금은 말을 꺼내면 귀찮아할 거라는 생각이 단단해졌습니다. 괜찮은 척하는 데 드는 힘이 오히려 지수님을 먼저 지치게 하고 있고, 이대로라면 서운함이 더 깊게 쌓이기 쉬워요.",
      key: "앞으로의 열쇠는 지금의 흐름과 '이 관계를 지키고 싶은 마음'에서 겹쳐요. 두 번째 카드가 상처받지 않으려 세운 가시라면, 세 번째 카드는 같은 관계를 바라보되 방향을 바꿔, 연락의 횟수보다 지수님이 바라는 연결이 어떤 모양인지를 가리킵니다. 그 모양이 분명해질수록, 서운함을 삼키느냐 꺼내느냐의 고민도 훨씬 가벼워질 수 있어요.",
      apply_head: "이 고민은 내가 바라는 연결의 모양을 알 때 풀리기 시작해요.",
      apply: "남자친구의 연락이 뜸해도 괜찮은 척하고 있다고 적어 주셨죠. 예를 들어 하루 종일 답장이 없다가 '바빴어' 한마디가 왔을 때, 서운하다는 말 대신 '괜찮아'를 먼저 보낸 순간이 있었을 수 있어요. 그동안은 이렇게 서운함을 혼자 삼키며 관계가 흔들리지 않게 지켜 왔을 수 있습니다. 지금은 그렇게 넘긴 마음이 쌓여, 연락을 기다리는 저녁마다 지수님이 먼저 지쳐 가는 장면으로 이어지고 있어요. 이 고민에서 열쇠는 연락이 몇 번 오느냐보다, 지수님이 바라는 연결이 하루를 나누는 짧은 대화인지, 함께 보내는 시간인지를 아는 데 있어요." } },
  { key: "02-일-지침", name: "민준",
    worry: "팀장이 된 지 6개월인데, 팀원들 일까지 제가 다 떠안다 보니 주말에도 쉬지 못하고 계속 지쳐 있어요. 쉬려고 해도 일이 머릿속에서 떠나지 않아요.",
    ai: { domain: "CAR", emotions: ["TIR", "ANX"], need: "REST", crisis_level: "none", violence: false },
    picks: ["rock_rest", "guard_place", "embrace"], reversed: ["guard_place"],
    C: { headline: "버텨 온 시간을 지나, 나를 채우는 쪽으로",
      lead: "민준님의 세 장은 팀을 지키느라 멈추지 못한 시간이 지금의 지침으로 이어지고 있다고 말해요.",
      now: { line: "팀장이 된 뒤로 주말에도 회의 생각을 붙든 채 쉬는 시간을 일에 내어 왔을 수 있어요.", ask: "그동안 팀이 흔들릴까 봐 쉬는 날에도 일을 손에서 놓지 못해 오지 않았나요?" },
      hold: { line: "팀원에게 맡긴 일까지 다시 손보느라, 쉬어도 쉬지 못하는 날이 이어지고 있어요.", ask: "혹시 지금 맡긴 일까지 다시 손보느라 쉬는 시간이 줄어들고 있지는 않나요?" },
      step: { line: "팀을 챙겨 온 그 손길이 민준님 자신에게도 향하는지가 이 고민의 열쇠예요.", ask: "앞으로 팀을 먼저 챙기는 쪽과 나도 함께 챙기는 쪽 중 어느 쪽에 더 마음을 두고 싶나요?" } },
    D: { story_head: "쉬지 않고 버텨 온 시간이 지금의 긴장으로 이어지고 있어요.",
      story: "민준님은 팀장이 된 뒤로 주말에도 회의 생각을 붙든 채, 쉬는 시간까지 일에 내어 주며 버텨 왔을 수 있어요. 팀원에게 맡긴 일도 마지막엔 직접 확인해야 마음이 놓였을 거예요.\n\n그 방식이 쌓여, 지금은 맡긴 일까지 다시 손봐야 안심이 되는 마음이 되었습니다. 그 긴장 때문에 쉬어도 쉰 것 같지 않은 날이 이어지고, 이대로라면 작은 일에도 금방 지치기 쉬워요.",
      key: "앞으로의 열쇠는 앞의 두 장과 '돌봄'이라는 점에서 겹쳐요. 그동안 민준님은 팀을 챙기고 지키는 데 힘을 써 왔는데, 세 번째 카드도 누군가를 품는 힘을 말하거든요. 다만 그 손길이 향하는 곳이 다릅니다. 팀에게만 향하던 돌봄이 민준님 자신에게도 향할 때, 쥐고 있던 긴장이 풀리고 버티는 힘이 채우는 힘으로 바뀔 수 있어요.",
      apply_head: "이 고민은 나를 먼저 채우는 데서 풀리기 시작해요.",
      apply: "주말에도 일이 머릿속에서 떠나지 않는다고 적어 주셨죠. 예를 들어 일요일 저녁, 쉬려고 누웠다가도 월요일 회의 안건을 머릿속으로 다시 정리하고 있는 순간이 있었을 수 있어요. 그동안은 팀이 흔들리지 않게 이렇게 쉬는 시간까지 일에 내어 주는 방식으로 버텨 왔을 수 있습니다. 지금은 그 방식이 굳어져, 팀원에게 맡긴 보고서도 밤에 다시 열어 고치게 되는 장면으로 이어지고 있어요. 그러다 보니 몸은 쉬고 있어도 마음은 계속 회사에 남아 있기 쉽습니다. 이 고민에서 열쇠는 일을 더 잘 해내는 것보다, 팀에게 건네던 다정함을 내 끼니와 잠에도 똑같이 나눌 수 있는지에 있어요." } },
  { key: "03-고민미작성", name: "하늘", worry: null, ai: null,
    picks: ["moon_drift", "lantern", "splash"], reversed: ["moon_drift"], C: null, D: null },
];

for (const c of CASES) {
  const safety = mergeSafety(screenText(c.worry || "", data.safety_keywords), c.ai);
  const cls = c.ai ? { domain: c.ai.domain, emotions: c.ai.emotions, need: c.ai.need } : null;
  const shuffle = createShuffle(data);                                       // "다시 섞을게요"마다 새로 호출
  c.picks.forEach((id) => (shuffle.reversed[id] = c.reversed.includes(id))); // 예시 재현용 방향 고정
  const picks = picksFromSlots(shuffle, c.picks.map((id) => shuffle.order.indexOf(id)), data);
  const linkBlock = buildLinkUserBlock({ name: c.name, worryText: c.worry, cls, picks, data });
  const links = linkBlock ? parseLinks(c.C, { violence: safety.violence }) : null;
  if (linkBlock && (!links || !links.headline || !links.lead || ["now", "hold", "step"].some((k) => !links[k].ask))) throw new Error(`${c.key}: C 예시 규칙 위반`);
  const storyBlock = buildStoryUserBlock({ name: c.name, worryText: c.worry, cls, picks, data, safety });
  const sa = storyBlock ? parseStoryApply(c.D, { violence: safety.violence }) : { story: null, apply: null, key: null, storyHead: null, applyHead: null };
  if (storyBlock && Object.values(sa).some((v) => !v)) throw new Error(`${c.key}: D 예시 규칙 위반 ${JSON.stringify(sa)}`);
  const notice = buildSafetyNotice({ data, safety });
  fs.writeFileSync(path.join(exDir, `${c.key}-input.txt`),
    `# 고민 원문\n${c.worry ?? "(작성하지 않음)"}\n\n# AI 분류 결과\n${c.ai ? JSON.stringify(c.ai) : "(호출 안 함)"}\n\n# 안전 확인\n${JSON.stringify(safety)}\n\n# 뽑은 카드(순서 = 자리)\n${picks.map((p) => `${p.positionName}: ${p.card.name}${p.reversed ? " (역방향)" : ""}`).join(" → ")}\n\n# [3장째 뽑는 순간] C 입력\n${linkBlock ?? "(호출 안 함)"}\n\n# [결제 후] D 입력\n${storyBlock ?? "(호출 안 함 — DB 문장 사용)"}\n`);
  const args = { name: c.name, cls, picks, data, links, safety, story: sa.story, apply: sa.apply, key: sa.key, storyHead: sa.storyHead, applyHead: sa.applyHead, worryText: c.worry || "" };
  // v4: 기존 10쪽(buildPages) → 11쪽(buildPagesV4). 결정형이 아니고(frame 없음) E 예시도 없어 E 없는 경로
  const U = buildPagesV4({ base: buildPages({ ...args, paid: false }), frame: null, lean: null, C: null, E: null, name: c.name, paid: false, data, safety });
  const Pd = buildPagesV4({ base: buildPages({ ...args, paid: true }), frame: null, lean: null, C: null, E: null, name: c.name, paid: true, data, safety });
  writeReport(c.key, `> 예시(가상). ${c.name}님 / v4.2 넘겨 보기 10쪽 — 비결정형 · E 없는 경로: 7쪽 = DB 해결의 흐름 전체(열쇠·이유·신호), 8~9쪽 = DB 처방·실천.`, notice, U, Pd);
  console.log("생성:", c.key);
}

// ---- 04 도현님: 결정형(이직 제안 수락 / 현재 회사에 남기) — fixtures/도현 ----
{
  const r = runCase(path.join(here, "fixtures/도현"), data, tables);
  const key = r.cs.key;
  if (r.frameErr.length || r.C.errors.length || r.E.errors.length) throw new Error(`${key}: 예시 규칙 위반 ${JSON.stringify([r.frameErr, r.C.errors, r.E.errors])}`);
  const notice = buildSafetyNotice({ data, safety: r.safety });
  fs.writeFileSync(path.join(exDir, `${key}-input.txt`),
    `# 고민 원문\n${r.cs.worry}\n\n# AI 분류 결과\n${JSON.stringify(r.cs.ai)}\n\n# 안전 확인\n${JSON.stringify(r.safety)}\n\n# 뽑은 카드(순서 = 자리)\n${r.picks.map((p) => `${p.positionName}: ${p.card.name}${p.reversed ? " (역방향)" : ""}`).join(" → ")}\n\n` +
    `# A2 고민 틀(검증 통과)\n${JSON.stringify(r.frame, null, 1)}\n\n# 방향 계산(decision.lean, 점수표 ${r.table})\n${JSON.stringify(r.lean, null, 1)}\n\n` +
    `# C 검증\n통과 (teaser·reasons 사용)\n\n# E 검증\n통과\n\n# 말투를 못 바꾼 문장 끝(확인용)\n${JSON.stringify(r.paid.endingFails)}\n`);
  writeReport(key, `> 예시(가상). ${r.cs.name}님 / v4.2 넘겨 보기 10쪽 — 결정형(옛 E 한 번 호출 예시): 방향 ‘${r.lean.option}’(${r.lean.strength}, 점수 ${r.lean.score}). 5쪽 첫 문구는 결론을 숨기고, 결론은 5쪽 블러 아래·7쪽.`, notice, r.unpaid, r.paid);
  console.log("생성:", key);
}

// ---- 05 서연님(v4.1): 재회 — 고민 틀 v4.6(mode axis) + 비슷한 정답 5개(few-shot) + 두 번째 의견 — fixtures/05-재회 ----
{
  const gold = fs.readFileSync(path.join(here, "../08_판별DB/data/frame_gold_v1.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const index = buildIndex(gold);
  const r = runCase(path.join(here, "fixtures/05-재회"), data, tables, { index });
  const key = r.cs.key;
  const sa = r.sa;
  if (r.frameErr.length || r.C.errors.length || r.E.errors.length || Object.values(sa).some((v) => !v)) throw new Error(`${key}: 예시 규칙 위반 ${JSON.stringify([r.frameErr, r.C.errors, r.E.errors, sa])}`);
  const notice = buildSafetyNotice({ data, safety: r.safety });
  const so = r.second_opinion;
  fs.writeFileSync(path.join(exDir, `${key}-input.txt`),
    `# 고민 원문\n${r.cs.worry}\n\n# AI 분류 결과\n${JSON.stringify(r.cs.ai)}\n\n# 안전 확인\n${JSON.stringify(r.safety)}\n\n# 뽑은 카드(순서 = 자리)\n${r.picks.map((p) => `${p.positionName}: ${p.card.name}${p.reversed ? " (역방향)" : ""}`).join(" → ")}\n\n` +
    `# [고민 제출 직후] A2 사용자 입력(비슷한 정답 ${r.prep.neighbors.length}개 + 이번 고민)\n${r.prep.user}\n\n` +
    `# 비슷한 정답(점수)\n${r.prep.neighbors.map((n) => `${n.id} ${n.table} ${n.score.toFixed(3)} — ${n.text}`).join("\n")}\n\n` +
    `# A2 고민 틀 v4.6(검증 통과)\n${JSON.stringify(r.frame, null, 1)}\n\n` +
    `# 두 번째 의견\n유사도 투표 1순위 표 '${r.prep.vote.table}'(비율 ${r.prep.vote.share.toFixed(2)}) ${so && so.disagree ? `≠ A2 표 '${r.frame.table}' → 강도 한 단계 낮춤, review_log: ${JSON.stringify(r.review_log)}` : `= A2 표 '${r.frame.table}' → 그대로`}\n\n` +
    `# 방향 계산(decision.lean, 점수표 ${r.table}, mode ${r.lean.mode})\n${JSON.stringify(r.lean, null, 1)}\n\n` +
    `# C 검증\n통과 (teaser·reasons 사용)\n\n# D 검증\n통과\n\n# E 검증\n통과\n\n# 말투를 못 바꾼 문장 끝(확인용)\n${JSON.stringify(r.paid.endingFails)}\n`);
  writeReport(key, `> 예시(가상). ${r.cs.name}님 / v4.2 넘겨 보기 10쪽 — 결정형(재회, 고민 틀 v4.6 mode axis, E1+E2 나눠 부름, 9쪽 오늘 = DB): 방향 ‘${r.lean.option}’(${r.lean.strength}, 점수 ${r.lean.score}). A2 입력에 비슷한 정답 5개를 붙였고, 두 번째 의견(유사도 투표 '${r.prep.vote.table}')은 A2 표와 ${so && so.disagree ? "달라 강도를 한 단계 낮춤" : "같아 강도 그대로"}.`, notice, r.unpaid, r.paid);
  console.log("생성:", key);
}
