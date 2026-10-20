# -*- coding: utf-8 -*-
"""쏠 타로 하우스 문장 DB — 엑셀 ↔ tarot_data.json 공통 정의.

한 행 = 문장 하나. ID는 tarot_data.json 안의 위치(점으로 연결한 경로)입니다.
예) cards.12.positions.now  →  12번 카드(바위 위의 쉼)의 '지나온 길' 자리 해석
"""

POS = {"now": "지나온 길", "hold": "지금의 흐름", "step": "앞으로의 열쇠"}  # v3.0 과거–현재–미래
STATUSES = ["초안", "검수중", "수정요청", "확정", "삭제"]
FORBIDDEN = ["운명", "예언", "반드시", "절대", "해결될 거예요", "안 될 거예요", "게 될 거예요", "게 될 것입니다", "진단", "최악", "**", "불길", "나쁜 카드",
             "경고", "어릴 때부터", "오랫동안 당신", "회피형", "불안형", "헤어지", "참아야", "더 참아"]
APPROACH = ["나-전달법", "먼저 연락", "먼저 다가가", "마음을 전해", "솔직하게 말해 보"]

# 시트 정의: (시트 이름, 설명, 쓰이는 곳, 분량 기준, 행 생성 함수)
def _card_label(c):
    return f"{c['no']:02d} {c['name']} · {c['character']}"


def rows_frag(d):  # v2.6 결과 맨 위 메인 문구·첫 줄 조립용 조각(명사구)
    for c in d["cards"]:
        for k, v in POS.items():
            yield f"cards.{c['no']}.frag.{k}", _card_label(c), f"{v} · 정방향 조각", c["frag"][k]
        for k, v in POS.items():
            yield f"cards.{c['no']}.reversed.frag.{k}", _card_label(c), f"{v} · 역방향 조각", c["reversed"]["frag"][k]


def rows_basic(d):  # v2.7 카드별 기본 설명(정·역): 키워드는 한 칸에 쉼표로
    for c in d["cards"]:
        for ori, b in (("정방향", c["basic"]), ("역방향", c["reversed"]["basic"])):
            pre = f"cards.{c['no']}." + ("" if ori == "정방향" else "reversed.") + "basic"
            yield f"{pre}.keywords", _card_label(c), f"{ori} 키워드(쉼표로)", ", ".join(b["keywords"])
            yield f"{pre}.desc", _card_label(c), f"{ori} 기본 설명(세 문장)", b["desc"]
            if "overview" in b:
                yield f"{pre}.overview", _card_label(c), f"{ori} 1쪽 개요(두 문장, v2.14)", b["overview"]


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


def rows_asks(d):  # v3.0 곱씹어 볼 질문(자리마다 한 개) — 예전 기본 질문 2개는 쓰지 않음
    for c in d["cards"]:
        for ori, src, pre in (("정방향", c.get("asks_pos"), f"cards.{c['no']}.asks_pos"), ("역방향", c["reversed"].get("asks_pos"), f"cards.{c['no']}.reversed.asks_pos")):
            for k in ("now", "hold", "step"):
                if src and k in src:
                    yield f"{pre}.{k}", _card_label(c), f"곱씹어 볼 질문 · {POS[k]} · {ori}", src[k]


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


NEED_N = {"START": "시작", "CHOOSE": "선택", "CONNECT": "연결", "REST": "쉼", "BOUNDARY": "경계", "LETGO": "놓아주기"}
PAT_N = {"all_same": "세 장 모두 같은 결", "now_hold": "1·2번째가 같은 결", "hold_step": "2·3번째가 같은 결", "now_step": "1·3번째가 같은 결", "all_diff": "세 장 모두 다른 결"}
STAGE_N = {"self3": "0~7번 세 장", "self2": "0~7번 두 장", "inner3": "8~14번 세 장", "inner2": "8~14번 두 장", "change3": "15~21번 세 장", "change2": "15~21번 두 장", "mixed": "구간마다 한 장씩"}
PACE_N = {"near": "실마리가 가까움(확언형)", "step": "한 걸음씩", "slow": "당장은 어려울 수도(여지+출구)", "watch": "주의 신호 때(점수 무관)", "near_q": "실마리가 가까움 · 질문형", "step_q": "한 걸음씩 · 질문형", "slow_q": "당장은 어려울 수도 · 질문형"}


def rows_combo(d):  # v3.0 세 장 조합 — 5·6·7쪽(분석만)
    C = d["combo"]
    for key, lab, use in (("story_p1", "5쪽 1문단 지나온 길×지금의 흐름", "그동안의 방식 → 지금의 작용(2~3문장)"),
                          ("key_vs_present", "5쪽 2문단 앞 지금의 흐름×앞으로의 열쇠", "열쇠가 지금의 흐름과 겹치는/달라지는 점"),
                          ("key_vs_past", "5쪽 2문단 뒤 지나온 길×앞으로의 열쇠", "열쇠가 지나온 길과 겹치는/달라지는 점")):
        for k, v in C[key].items():
            a, b = k.split("_")
            yield f"combo.{key}.{k}", f"{lab} {NEED_N[a]}→{NEED_N[b]}", use, v
    for k, v in C.get("apply_head", {}).items():
        yield f"combo.apply_head.{k}", "6쪽 요약 한 줄(굵게)", f"앞으로의 열쇠 성격 {NEED_N[k]} — AI 요약이 없을 때", v
    for k, v in C.get("apply_fallback", {}).items():
        dom, nd = k.split("_")
        yield f"combo.apply_fallback.{k}", DOMN.get(dom, dom), f"6쪽 내 고민에 대어 보면 · 앞으로의 열쇠 {NEED_N[nd]} (AI 실패·미작성 때)", v
    for k, v in C["pace"].items():
        yield f"combo.pace.{k}.title", "7쪽 해결 속도", f"{PACE_N[k]} · 제목", v["title"]
        yield f"combo.pace.{k}.body", "7쪽 해결 속도", f"{PACE_N[k]} · 본문", v["body"]
    for k, v in C.get("reasons", {}).items():
        yield f"combo.reasons.{k}", "7쪽 이렇게 읽은 이유", REASON_N.get(k, k), v
    for k, v in C["tone"].items():
        yield f"combo.tone.{k}", "7쪽 고민 보정 문장", {"deadline": "마감이 있는 고민", "other_locus": "남·상황에 달린 고민"}.get(k, k), v


REASON_N = {"past_pos": "지나온 길 카드 힘이 흐름", "past_neg": "지나온 길 카드 힘이 머묾", "present_pos": "지금의 흐름 카드 힘이 흐름", "present_neg": "지금의 흐름 카드 힘이 묶임",
            "future_pos": "앞으로의 열쇠 힘이 흐름(가중 2)", "future_neg": "앞으로의 열쇠 힘이 막힘(가중 2)", "same_need": "2·3번 같은 성격", "hold_letgo": "2번이 바꿀 수 없는 것(쏠 규칙)",
            "reversed_none": "역방향 없음", "reversed_many": "역방향 2장 이상", "ascending": "번호 오름차순", "descending": "번호 내림차순",
            "need_match": "고민의 필요 = 3번 성격", "domain_match": "3번이 고민 영역과 맞음", "chronic": "오래된 고민"}


def rows_momentum(d):  # v2.9 카드별 해결 기운(숫자)
    names = {str(c["no"]): c["name"] for c in d["cards"]}
    for k, v in sorted(d["combo"]["momentum"].items(), key=lambda x: int(x[0])):
        yield f"combo.momentum.{k}", f"{k}. {names.get(k, '')}", "정방향 해결 기운(-2~2, 0.5 단위) · 역방향은 -1(15·18번은 +1)", str(v)


SKIP_COPY = ("rule", "placeholder_rule", "long_wait_policy", "test_name_draft", "blur_samples")


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
               "cta_chat": "결과 8번 쏘웰라", "top": "결과 맨 위 메인 문구·첫 줄 틀", "asks_headings": "카드 섹션 질문 소제목", "result_cards": "결과 맨 위 카드"}


def rows_copy(d):
    for p, v in _walk(d["copy"], "copy"):
        parts = p.split(".")
        yield p, COPY_SCREEN.get(parts[1], parts[1]), ".".join(parts[2:]) or "본문", v


def rows_tendency(d):  # v3.2 6쪽 카드로 본 나의 성향 — 지나온 길 카드×방향
    for c in d["cards"]:
        for ori, s, pre in (("정방향", c, f"cards.{c['no']}.tendency"), ("역방향", c["reversed"], f"cards.{c['no']}.reversed.tendency")):
            yield pre, _card_label(c), f"{ori} · 지나온 길에 나왔을 때 6쪽 '카드로 본 나의 성향'(일반적 추정, 두 문장)", s["tendency"]


def rows_signs(d):  # v3.1 7쪽 풀리고 있다는 신호 — 앞으로의 열쇠 카드×방향 × 3
    for c in d["cards"]:
        for ori, s, pre in (("정방향", c, f"cards.{c['no']}.signs"), ("역방향", c["reversed"], f"cards.{c['no']}.reversed.signs")):
            for i, t in enumerate(s["signs"]):
                yield f"{pre}.{i}", _card_label(c), f"{ori} · 7쪽 '이런 변화가 보이면, 흐름이 풀리고 있는 거예요' {i + 1}", t


def rows_direct(d):  # v3.0 8·9쪽 처방·실천 — 카드×방향마다, 앞 분석의 같은 대상을 직접 다룸
    PART = [("key_rx", "8쪽 처방 ① 앞으로의 열쇠(세 번째 카드일 때)"), ("today", "9쪽 오늘 — 처방 ①의 1~5분판"), ("week", "9쪽 이번 주 — 처방 ①을 되풀이"),
            ("slow_rx", "8쪽 처방 ② 속도를 늦추는 것 풀기(두 번째 카드일 때)"), ("three", "9쪽 3일 안에 — 처방 ②의 10~20분판")]
    for c in d["cards"]:
        for ori, s, pre in (("정방향", c, f"cards.{c['no']}.direct"), ("역방향", c["reversed"], f"cards.{c['no']}.reversed.direct")):
            x = s["direct"]
            yield f"{pre}.slow_short", _card_label(c), f"{ori} · 8쪽 굵은 줄 '속도를 늦추는 ‘…’를 풀려면'에 들어갈 명사구", x["slow_short"]
            for k, lab in PART:
                for f in ("title", "how", "time", "why"):
                    if f in x[k]:
                        yield f"{pre}.{k}.{f}", _card_label(c), f"{ori} · {lab} · {dict(title='제목', how='방법', time='시간', why='이유')[f]}", x[k][f]


SHEETS = [
    # 이름, 무엇인가, 쓰이는 곳, 분량 기준(최소, 최대 글자), 함수, 단계
    ("카드기본설명", "카드 자체의 기본 뜻 — 키워드 + 세 문장, 정·역방향", "결과 1쪽(키워드 + 개요 두 문장) + 2~4쪽 '카드는 이렇게 말해요'(기본 설명 세 문장, 역방향이면 역방향 설명 따로) — v3.2", (6, 260), rows_basic, "v2.8 세 문장"),
    ("메인문구조각", "메인 문구·첫 줄·8쪽 처방 연결 줄을 조립하는 카드 조각 — 명사구로(조사는 자동)", "결과 5쪽 메인 문구 + 8쪽 굵은 연결 줄", (4, 22), rows_frag, "v3.0 새로 씀"),
    ("위치해석", "카드 22장 × 자리 3곳(지나온 길·지금의 흐름·앞으로의 열쇠) × 정·역방향 해석, 두 문장", "결과 2·3·4쪽 본문(첫 문장 굵게)", (40, 150), rows_positions, "v3.0 새로 씀"),
    ("상황질문", "곱씹어 볼 질문 — 카드 × 자리 × 정·역 한 개(AI 질문이 없을 때)", "결과 5쪽 블러 아래 '이 질문들을 곱씹어 볼까요?'", (15, 95), rows_asks, "v3.0 새로 씀"),
    ("처방실천", "카드×방향마다 8쪽 처방 2개(열쇠·속도)와 9쪽 실천 3개(오늘·3일 안에·이번 주) — 분석의 같은 대상을 직접 다룸(논리 점프 금지)", "결과 8쪽 그래서, 이렇게 해 보세요 + 9쪽 이번 주 실천 카드", (2, 140), rows_direct, "v3.0 새로 씀"),
    ("성향", "지나온 길 카드×방향마다 고민 앞에서 흔히 보이는 성향(일반적 추정, 단정·꼬리표 금지)", "결과 6쪽 내 고민에 대어 보면 위", (60, 160), rows_tendency, "v3.2 새로 씀"),
    ("변화신호", "앞으로의 열쇠 카드×방향마다 풀리고 있다는 신호 3개(관찰 가능한 작은 변화, 제안 아님)", "결과 7쪽 해결의 흐름 아래", (20, 80), rows_signs, "v3.1 새로 씀"),
    ("안전키워드", "고민 원문에서 찾는 위험·주의·폭력 신호 단어 (한 칸에 쉼표로)", "고민 제출 직후 안전 확인", (0, 2000), rows_safety, "v2.5 신규"),
    ("조합문장", "세 장 조합 — 5쪽 두 문단 108(1문단 36 · 겹치는/달라지는 점 72) · 요약 12 · 내 고민에 대어 보면 42(예시 장면 포함) · 해결 속도 7 · 읽은 이유 15 · 고민 보정 2 (모두 분석, 제안 없음)", "결과 5·6·7쪽(블러 아래)", (8, 500), rows_combo, "v3.1 새로 씀"),
    ("해결기운", "카드별 해결 기운 숫자 — 조합 점수(해결 속도)를 정함. 상담사 검토 필요", "결과 7쪽 해결 속도 판정(화면에 숫자는 안 보임)", (1, 4), rows_momentum, "v2.9 신규"),
    ("화면문구", "인트로부터 결과까지 화면에 보이는 고정 문구", "각 화면", (1, 400), rows_copy, "출시 1단계"),
]


def set_path(d, path, value):
    """ID 경로에 값을 넣습니다. deep_reversed_common.* 는 22장 모두에 같은 값을 넣습니다."""
    parts = path.split(".")
    if parts[:2] == ["combo", "momentum"]:  # 숫자로 저장
        f = float(value)
        d["combo"]["momentum"][parts[2]] = int(f) if f == int(f) else f
        return
    if parts[0] == "safety_keywords":  # 쉼표로 나눈 목록으로 저장
        d["safety_keywords"][parts[1]] = [w.strip().replace(" ", "") for w in str(value).split(",") if w.strip()]
        return
    if parts[-1] == "keywords" and parts[-2] == "basic":  # 쉼표로 나눈 목록으로 저장
        value = [w.strip() for w in str(value).split(",") if w.strip()]
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
    if rid.startswith("combo.momentum."):
        try:
            f = float(text)
            return [] if -2 <= f <= 2 and (f * 2) == int(f * 2) else ["숫자 범위 — -2~2, 0.5 단위만"]
        except ValueError:
            return ["숫자 아님"]
    warn = [] if rid.startswith("copy.") else [f"금지 표현 '{w}'" for w in FORBIDDEN if w in text]
    if "다가가기형" not in item:
        warn += [f"다가가기 표현 '{w}' — 다가가기형이 아닌데 들어 있음(폭력 신호 때도 노출됨)" for w in APPROACH if w in text]
    if re.search(r"[A-Za-z]{3,}", text) and not re.search(r"[A-Za-z]{3,}", original):
        warn.append("영어 단어")
    for ph in set(re.findall(r"\{[a-z]+(?::[가-힣]+)?\}", original)):
        if ph not in text:
            warn.append(f"자리표시자 {ph} 빠짐")
    return warn
