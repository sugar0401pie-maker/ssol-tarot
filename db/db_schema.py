# -*- coding: utf-8 -*-
"""쏠 타로 하우스 문장 DB — 엑셀 ↔ tarot_data.json 공통 정의.

한 행 = 문장 하나. ID는 tarot_data.json 안의 위치(점으로 연결한 경로)입니다.
예) cards.12.positions.now  →  12번 카드(바위 위의 쉼)의 '지금의 마음' 위치 해석
"""

POS = {"now": "지금의 마음", "hold": "나를 붙잡는 것", "step": "다음 한 걸음"}
STATUSES = ["초안", "검수중", "수정요청", "확정", "삭제"]
FORBIDDEN = ["운명", "예언", "반드시", "게 될 거예요", "게 될 것입니다", "진단", "최악", "**", "불길", "나쁜 카드",
             "경고", "어릴 때부터", "오랫동안 당신", "회피형", "불안형", "헤어지", "참아야", "더 참아"]
APPROACH = ["나-전달법", "먼저 연락", "먼저 다가가", "마음을 전해", "솔직하게 말해 보"]

# 시트 정의: (시트 이름, 설명, 쓰이는 곳, 분량 기준, 행 생성 함수)
def _card_label(c):
    return f"{c['no']:02d} {c['name']} · {c['character']}"


def rows_core(d):
    for c in d["cards"]:
        yield f"cards.{c['no']}.core", _card_label(c), "핵심 메시지 · 정방향", c["core"]
        yield f"cards.{c['no']}.reversed.core", _card_label(c), "핵심 메시지 · 역방향", c["reversed"]["core"]


def rows_about(d):
    for c in d["cards"]:
        yield f"cards.{c['no']}.about_when", _card_label(c), "이럴 때를 비추는 카드", c["about_when"]
        yield f"cards.{c['no']}.about_origin", _card_label(c), "원래 타로 자리의 뜻 + 쏠 타로식 해석", c["about_origin"]


def rows_positions(d):
    for c in d["cards"]:
        for k, v in POS.items():
            yield f"cards.{c['no']}.positions.{k}", _card_label(c), f"{v} · 정방향", c["positions"][k]
        for k, v in POS.items():
            yield f"cards.{c['no']}.reversed.positions.{k}", _card_label(c), f"{v} · 역방향", c["reversed"]["positions"][k]


def rows_deep(d):
    for c in d["cards"]:
        for k, v in POS.items():
            for i, para in enumerate(c["deep"][k]):
                yield f"cards.{c['no']}.deep.{k}.{i}", _card_label(c), f"{v} · 단락 {i + 1}", para
    for c in d["cards"]:  # v2.5: 역방향도 카드별 한 단락
        for k, v in POS.items():
            yield f"cards.{c['no']}.deep_reversed.{k}.0", _card_label(c), f"{v} · 역방향", c["deep_reversed"][k][0]


def rows_asks(d):
    for c in d["cards"]:
        for i, q in enumerate(c["asks"]):
            yield f"cards.{c['no']}.asks.{i}", _card_label(c), f"기본 질문 {i + 1}", q
        for i, q in enumerate(c["reversed"].get("asks", [])):
            yield f"cards.{c['no']}.reversed.asks.{i}", _card_label(c), f"기본 질문 {i + 1} · 역방향", q


def rows_closing(d):
    for c in d["cards"]:
        yield f"cards.{c['no']}.closing", _card_label(c), "세 번째 카드일 때 마무리 문장", c["closing"]
        if c["reversed"].get("closing"):
            yield f"cards.{c['no']}.reversed.closing", _card_label(c), "세 번째 카드일 때 마무리 문장 · 역방향", c["reversed"]["closing"]


def rows_practices(d):
    for c in d["cards"]:
        for i, p in enumerate(c["practices"]):
            tag = f"실천 {i + 1}" + (" · 다가가기형" if p["approach"] else "")
            yield f"cards.{c['no']}.practices.{i}.title", _card_label(c), f"{tag} · 제목", p["title"]
            yield f"cards.{c['no']}.practices.{i}.how", _card_label(c), f"{tag} · 방법", p["how"]
            yield f"cards.{c['no']}.practices.{i}.time", _card_label(c), f"{tag} · 걸리는 시간", p["time"]
            yield f"cards.{c['no']}.practices.{i}.why", _card_label(c), f"{tag} · 왜 도움이 되나", p["why"]


def rows_rx(d):
    dom = {x["code"]: x["name"] for x in d["domains"]}
    need = {x["code"]: x["name"] for x in d["needs"]}
    for grp, label in (("by_domain_need", "영역×필요"), ("by_need", "필요별")):
        for key, r in d["prescriptions"][grp].items():
            if grp == "by_domain_need":
                a, b = key.split("_")
                name = f"{dom[a]} × {need[b]}"
            else:
                name = f"필요: {need[key]}"
            src = f"쏠 실천 {r['ssol_id']}" if r.get("ssol_id") else "쏠 타로 자체"
            tag = f"{label} {key} · {src}" + (" · 다가가기형" if r["approach"] else "")
            for f, fl in (("title", "제목"), ("how", "방법"), ("why", "왜 도움이 되나")):
                yield f"prescriptions.{grp}.{key}.{f}", name, f"{tag} · {fl}", r[f]


def rows_emotion(d):
    em = {x["code"]: x["name"] for x in d["emotions"]}
    for k, v in d["emotion_lines"].items():
        yield f"emotion_lines.{k}", f"감정: {em[k]}", "감정 문장 ({name} = 닉네임)", v


DOMN = {"CAR": "직업·커리어", "DIR": "진로·자기계발", "LOV": "연애", "FAM": "가족", "SOC": "교우·사회관계", "LIF": "재정·생활안정", "NONE": "고민 미작성"}


def rows_fallback(d):
    for kind, label in (("story", "5번 이야기 대체"), ("apply", "5번 '내 고민에 대어 보면' 대체")):
        for dom, lst in d["fallbacks"][kind].items():
            for i, t in enumerate(lst):
                yield f"fallbacks.{kind}.{dom}.{i}", DOMN.get(dom, dom), f"{label} {i + 1} ({{name}}·{{c1}}{{c2}}{{c3}} 자리표시자)", t


SAFE_N = {"urgent": "위험(카드 멈추고 안전 안내)", "urgent_raw": "위험 · 띄어쓰기 그대로 검사(두 글자 단어)", "watch": "주의(결과에 안내 박스)",
          "violence": "폭력·통제(다가가기 실천 빼고 안내 박스)", "exclude": "오탐 예외(이 표현은 지우고 검사)"}


def rows_safety(d):
    for k, v in d["safety_keywords"].items():
        yield f"safety_keywords.{k}", SAFE_N.get(k, k), "쉼표로 구분 · 띄어쓰기 없이", ", ".join(v)


SKIP_COPY = ("rule", "placeholder_rule", "long_wait_policy", "test_name_draft")


def _walk(x, p):
    if isinstance(x, dict):
        for k, v in x.items():
            if k in SKIP_COPY:
                continue
            yield from _walk(v, f"{p}.{k}")
    elif isinstance(x, list):
        for i, v in enumerate(x):
            yield from _walk(v, f"{p}.{i}")
    elif isinstance(x, str) and x.strip():
        yield p, x


COPY_SCREEN = {"intro": "1 인트로", "welcome": "2 환영", "experience": "3 경험 질문", "first_time": "3-1 처음 안내",
               "worry": "4 고민 쓰기", "shuffle": "5 셔플", "pick": "6 뽑기", "reveal": "6 다 뽑음", "loading": "대기",
               "result": "7 결과", "share_card": "공유 카드", "disclaimer": "결과 하단 고지", "safety": "안전 안내",
               "cta_chat": "결과 8번 쏘웰라", "asks_headings": "카드 섹션 질문 소제목", "result_cards": "결과 맨 위 카드"}


def rows_copy(d):
    for p, v in _walk(d["copy"], "copy"):
        parts = p.split(".")
        yield p, COPY_SCREEN.get(parts[1], parts[1]), ".".join(parts[2:]) or "본문", v


SHEETS = [
    # 이름, 무엇인가, 쓰이는 곳, 분량 기준(최소, 최대 글자), 함수, 단계
    ("위치해석", "카드 22장 × 위치 3곳 × 정·역방향 해석", "결과 2·3·4번 카드 섹션 본문", (25, 140), rows_positions, "출시 1단계"),
    ("깊이읽기", "카드 22장 × 위치 3곳 × 단락 2개 + 역방향 공통 3개", "결과 2·3·4번 '조금 더 들여다보기'", (60, 220), rows_deep, "2단계 → 초안 완료"),
    ("핵심메시지", "카드별 핵심 메시지 정·역방향", "결과 2·3·4번 카드명 아래 한 줄", (12, 60), rows_core, "출시 1단계"),
    ("카드설명", "카드별 '어떤 카드인가요' 두 문장", "결과 1번 세 장 한눈에 + 카드 섹션 '어떤 카드인가요'", (20, 140), rows_about, "출시 1단계"),
    ("상황질문", "카드별 기본 질문 2개 (AI 맞춤 질문이 없을 때)", "결과 2·3·4번 질문 2개", (15, 90), rows_asks, "출시 1단계"),
    ("마무리", "세 번째 카드로 나왔을 때 마무리 문장", "결과 5번 이야기 뒤", (25, 90), rows_closing, "출시 1단계"),
    ("실천카드", "카드별 실천 3개 × 제목·방법·시간·이유", "결과 7번 이번 주 실천 카드", (2, 120), rows_practices, "출시 1단계"),
    ("웰니스처방", "고민 영역×필요 36 + 필요별 6 × 제목·방법·이유", "결과 6번 웰니스 처방", (4, 140), rows_rx, "출시 1단계"),
    ("대체문장", "AI가 실패하거나 고민을 적지 않았을 때 5번에 들어가는 문장 — 고민 영역별 2개", "결과 5번 이야기·내 고민에 대어 보면", (50, 450), rows_fallback, "v2.5 신규"),
    ("안전키워드", "고민 원문에서 찾는 위험·주의·폭력 신호 단어 (한 칸에 쉼표로)", "고민 제출 직후 안전 확인", (0, 2000), rows_safety, "v2.5 신규"),
    ("감정문장", "감정 8개 × 한 문장", "결과 2번 첫 번째 카드 섹션", (30, 90), rows_emotion, "출시 1단계"),
    ("화면문구", "인트로부터 결과까지 화면에 보이는 고정 문구", "각 화면", (1, 400), rows_copy, "출시 1단계"),
]


def set_path(d, path, value):
    """ID 경로에 값을 넣습니다. deep_reversed_common.* 는 22장 모두에 같은 값을 넣습니다."""
    parts = path.split(".")
    if parts[0] == "safety_keywords":  # 쉼표로 나눈 목록으로 저장
        d["safety_keywords"][parts[1]] = [w.strip().replace(" ", "") for w in str(value).split(",") if w.strip()]
        return
    if parts[0] == "deep_reversed_common":
        for c in d["cards"]:
            c["deep_reversed"][parts[1]] = [value]
        return
    cur = d
    for p in parts[:-1]:
        cur = cur[int(p)] if isinstance(cur, list) else cur[p]
    last = parts[-1]
    if isinstance(cur, list):
        cur[int(last)] = value
    else:
        if last not in cur:
            raise KeyError(path)
        cur[last] = value


def check_text(text, original, rid="", item=""):
    """검수 규칙 경고 목록을 돌려줍니다(빈 목록이면 통과).
    화면문구(copy.*)는 고지문에 '예언·진단을 대신하지 않아요'처럼 금지어가 필요해 금지어 검사를 하지 않습니다."""
    import re
    if rid.startswith("safety_keywords."):
        return []
    warn = [] if rid.startswith("copy.") else [f"금지 표현 '{w}'" for w in FORBIDDEN if w in text]
    if "다가가기형" not in item:
        warn += [f"다가가기 표현 '{w}' — 다가가기형이 아닌데 들어 있음(폭력 신호 때도 노출됨)" for w in APPROACH if w in text]
    if re.search(r"[A-Za-z]{3,}", text) and not re.search(r"[A-Za-z]{3,}", original):
        warn.append("영어 단어")
    for ph in set(re.findall(r"\{[a-z]+\}", original)):
        if ph not in text:
            warn.append(f"자리표시자 {ph} 빠짐")
    return warn
