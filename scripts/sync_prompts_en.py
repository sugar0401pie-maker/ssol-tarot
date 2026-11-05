# 영문판 프롬프트 원문(docs/spec/en/*_en.txt — 기획 전달본)을 lib/server/prompts_en.ts 상수로 그대로 옮긴다.
#   python3 scripts/sync_prompts_en.py          # 바뀌는 상수와 글자 수만 보여 줌
#   python3 scripts/sync_prompts_en.py --write  # prompts_en.ts를 다시 씀
# 원문은 고치지 않는다(문구를 바꾸려면 기획 파일을 바꾼 뒤 이 스크립트를 다시 돌린다).
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TS = ROOT / "lib/server/prompts_en.ts"
MAP = {
    "CLASSIFY_SYSTEM_EN": "A_classify_en.txt",
    "FRAME_SYSTEM_EN": "A2_frame_en.txt",
    "C_SYSTEM_EN": "C_en.txt",
    "D_SYSTEM_EN": "D_en.txt",
    "E1_SYSTEM_EN": "E1_en.txt",
    "E2_SYSTEM_EN": "E2_en.txt",
}
HEAD = '''import "server-only";
// 영문판 AI 프롬프트 — docs/spec/en/*_en.txt 원문 그대로(scripts/sync_prompts_en.py로 생성, 손으로 고치지 않는다).
'''


def main() -> None:
    old = TS.read_text(encoding="utf-8") if TS.exists() else ""
    parts = [HEAD]
    for name, f in MAP.items():
        text = (ROOT / "docs/spec/en" / f).read_text(encoding="utf-8").strip("\n")
        m = re.search(rf'export const {name} = ("(?:[^"\\]|\\.)*");', old)
        if m and json.loads(m.group(1)) != text:
            print(f"{name}: {len(json.loads(m.group(1)))} → {len(text)}")
        elif not m:
            print(f"{name}: 새로 {len(text)}")
        parts.append(f"export const {name} = {json.dumps(text, ensure_ascii=False)};\n")
    out = "".join(parts)
    if out == old:
        print("바뀐 것 없음")
    elif "--write" in sys.argv:
        TS.write_text(out, encoding="utf-8")
        print("썼음")


main()
