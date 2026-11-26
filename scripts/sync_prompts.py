# 프롬프트 원문(docs/spec의 md 코드 블록)을 lib/server/prompts.ts의 상수에 그대로 옮긴다.
# 손으로 붙이다 글자가 빠지는 일을 막으려고 만든 도구(2026-10-22, v4.1 반영 때). 패키지 문서를 바꾼 뒤:
#   python3 scripts/sync_prompts.py          # 바뀌는 상수와 글자 수만 보여 줌
#   python3 scripts/sync_prompts.py --write  # prompts.ts에 씀
# 어느 블록이 어느 상수인지는 아래 MAP(문서, 블록 순서 — 0부터)으로 정한다.
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TS = ROOT / "lib/server/prompts.ts"
MAP = {
    "CLASSIFY_SYSTEM": ("docs/spec/ai-prompts-tarot-v2.md", 1),  # A-2
    # A2: v2.3.9부터 판별 DB의 전문 파일(v2.3.11부터 v4.11, v2.3.14부터 v4.12 — 결과 틀 먼저, v2.3.24부터 v4.16 — 두 고민이면 더 무거운 쪽·(고른 고민: X), v3.0부터 v4.24 — sub2(2순위 세부), v3.6 묶음(2026-11-23)부터 v4.28 — branches(갈래)·초안 세부 37, v3.8 묶음(2026-11-24)부터 v4.29 — facts(글 속 사정), v3.13 묶음(2026-11-26)부터 v4.30 — 새 세부 6)이 원천 — 설계 문서 A2 블록에는 세부 고민 목록 자리가 없다.
    #     {SUB_BLOCK}(세부 고민 후보 — v2.3.11부터 144개)은 요청마다 달라서 시스템 프롬프트에 넣지 않고 사용자 입력 맨 앞에 붙인다
    #     (CLAUDE.md 5장: 시스템 프롬프트 안에서 값을 치환하지 않는다) — 그 자리에는 아래 안내 한 줄.
    "FRAME_SYSTEM": ("judge-db/A2_고민틀_프롬프트_v4.30.txt", None),
    "C_SYSTEM": ("docs/spec/ai-prompts-tarot-v4.md", 2),
    "D_SYSTEM": ("docs/spec/ai-prompts-tarot-v4.md", 3),
    "E1_SYSTEM": ("docs/spec/ai-prompts-tarot-v4.md", 4),  # v4.2 E1(7쪽)
    "E2_SYSTEM": ("docs/spec/ai-prompts-tarot-v4.md", 5),  # v4.2 E2(8·9쪽)
    # v3.7 과제 1 2안: C 지시문 끝에 붙이는 덧붙임(41자 이상 고민만 — lib/server/session.ts가 붙임). 파일 그대로.
    "C_FREE_ADDENDUM": ("judge-db/C_덧붙임_글에서짚는한줄_v1.txt", "raw"),
}


def blocks(md: Path) -> list[str]:
    return [m.group(1) for m in re.finditer(r"^```[a-z]*\n(.*?)\n```", md.read_text(encoding="utf-8"), re.S | re.M)]


SUB_BLOCK_POINTER = "  (결과 틀 후보·그 안의 세부 고민과 그 밖의 틀 목록은 사용자 입력 맨 앞의 [결과 틀 후보] 블록에 있어요.)"
# v4.27부터 {BRANCH_BLOCK}(갈래 후보)도 요청마다 달라서 사용자 입력 맨 앞(결과 틀 후보 바로 아래)에 붙인다(lib/server/frameExamples.ts).
BRANCH_BLOCK_POINTER = "  (갈래 후보는 사용자 입력 맨 앞의 [갈래 후보] 블록에 있어요.)"


# 개발 쪽 덧붙임(owner 2026-11-15, 패키지 v2.3.15 요청): 고객이 직접 쓴 선택지의 짧은 별칭. 기획 원문 파일은 고치지 않고
# 출력 형식 바로 앞에 규칙 한 줄을 넣고 출력 예시에 칸을 더한다(검사는 lib/tarot-glue/optionAlias.ts — 안 맞으면 정식 이름).
ALIAS_RULE = (
    "- option_aliases: decision_source가 \"explicit\"(사용자가 고를 것을 직접 씀)일 때만, options_ranked와 같은 순서·같은 개수로 "
    "각 선택지의 짧은 이름(띄어쓰기 빼고 2~8자)을 씀. 사용자가 쓴 말만 줄이고 새 뜻·평가·결론을 넣지 않음. 두 이름은 서로 달라야 함. "
    "선택지가 이미 8자 이하면 그대로 씀. 예) [\"연봉 높은 회사로 옮기기\",\"지금 회사에 남아서 승진을 기다리기\"] → [\"연봉 따라 이직\",\"남아서 승진\"]. "
    "explicit가 아니면 null."
)
OUT_HEAD = "[출력 — 이 형식만]"
OUT_FIELD = ('"options_ranked":["...","..."],', '"options_ranked":["...","..."],"option_aliases":null,')


def add_alias_rule(text: str) -> str:
    if text.count(OUT_HEAD) != 1 or text.count(OUT_FIELD[0]) != 1:
        sys.exit("A2 원문에서 출력 형식 자리를 못 찾음 — 별칭 규칙을 넣을 곳을 다시 확인")
    return text.replace(OUT_HEAD, ALIAS_RULE + "\n\n" + OUT_HEAD).replace(OUT_FIELD[0], OUT_FIELD[1])


def source(doc: str, idx) -> str:
    if idx == "raw":
        return (ROOT / doc).read_text(encoding="utf-8").strip()
    if idx is None:  # 전문 파일
        return add_alias_rule((ROOT / doc).read_text(encoding="utf-8").strip().replace("\n{SUB_BLOCK}\n", "\n" + SUB_BLOCK_POINTER + "\n").replace("아래 {SUB_BLOCK} 후보 줄 끝", "[결과 틀 후보] 블록의 후보 줄 끝").replace("\n{BRANCH_BLOCK}\n", "\n" + BRANCH_BLOCK_POINTER + "\n"))
    return blocks(ROOT / doc)[idx]


def main() -> None:
    src = TS.read_text(encoding="utf-8")
    out = src
    for name, (doc, idx) in MAP.items():
        text = source(doc, idx)
        pat = re.compile(rf'(export const {name} = )("(?:[^"\\]|\\.)*")(;)')
        m = pat.search(out)
        if not m:
            sys.exit(f"{name}를 prompts.ts에서 못 찾음")
        old = json.loads(m.group(2))
        if old != text:
            print(f"{name}: {len(old)}자 → {len(text)}자")
        out = out[: m.start(2)] + json.dumps(text, ensure_ascii=False) + out[m.end(2):]
    if out == src:
        print("바뀐 것 없음")
    elif "--write" in sys.argv:
        TS.write_text(out, encoding="utf-8")
        print("prompts.ts에 썼어요")


main()
