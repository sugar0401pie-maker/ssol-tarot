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
    "FRAME_SYSTEM": ("docs/spec/ai-prompts-tarot-v4.md", 1),  # A2 (v4.6)
    "C_SYSTEM": ("docs/spec/ai-prompts-tarot-v4.md", 2),
    "D_SYSTEM": ("docs/spec/ai-prompts-tarot-v4.md", 3),
    "E_SYSTEM": ("docs/spec/ai-prompts-tarot-v4.md", 4),
}


def blocks(md: Path) -> list[str]:
    return [m.group(1) for m in re.finditer(r"^```[a-z]*\n(.*?)\n```", md.read_text(encoding="utf-8"), re.S | re.M)]


def main() -> None:
    src = TS.read_text(encoding="utf-8")
    out = src
    for name, (doc, idx) in MAP.items():
        text = blocks(ROOT / doc)[idx]
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
