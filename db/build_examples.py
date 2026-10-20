# -*- coding: utf-8 -*-
# 고민 예시 문장 60개 — 분류 기준(정답 라벨), 분류 프롬프트 few-shot, 정확도 점검용 테스트 세트
import json, sys
OUT = sys.argv[1]

def E(id, text, domain, emotions, need, note="", self_focus=False, crisis="none", violence=False, local=None, off_topic=False, fewshot=False):
    return dict(id=id, text=text, domain=domain, emotions=emotions, need=need, self_focus=self_focus,
                crisis_level=crisis, violence=violence, off_topic=off_topic,
                expected_keyword_level=local or ("none"), note=note, fewshot=fewshot)

X = [
# 직업·커리어
E("CAR-01", "회사에서 열심히 하는데 인정받지 못하는 것 같아 지쳐요.", "CAR", ["TIR", "HUR"], "REST", fewshot=True),
E("CAR-02", "팀장님이 매일 업무를 몰아줘서 거절하고 싶은데 말을 못 하겠어요.", "CAR", ["ANX", "HUR"], "BOUNDARY"),
E("CAR-03", "이직을 할지 말지 몇 달째 고민만 하고 있어요.", "CAR", ["CON", "ANX"], "CHOOSE", "이직은 진로가 아니라 직업·커리어"),
E("CAR-04", "다음 주 발표가 너무 긴장돼서 잠이 안 와요.", "CAR", ["ANX"], "START", "일시적 긴장으로 인한 수면 문제는 위기 아님"),
E("CAR-05", "야근이 계속돼서 주말에도 쉬는 느낌이 안 들어요. 일과 삶의 균형이 다 무너졌어요.", "CAR", ["TIR"], "REST", "일과 삶의 균형은 직업·커리어에 흡수(디저트 테스트 결정)"),
E("CAR-06", "동료들 사이에서 나만 겉도는 것 같아요.", "CAR", ["LON", "ANX"], "CONNECT", "직장 안 관계는 교우·사회관계가 아니라 직업·커리어"),
E("CAR-07", "실수를 한 번 했는데 계속 그 생각만 나고 제가 너무 한심해요.", "CAR", ["SHA", "ANX"], "LETGO", "자책이어도 무대가 직장이면 직업·커리어"),
E("CAR-08", "새로 맡은 프로젝트가 기대되는데 잘할 수 있을지 떨려요.", "CAR", ["HOP", "ANX"], "START"),
# 진로·자기계발
E("DIR-01", "졸업이 다가오는데 뭘 하고 싶은지 모르겠어요.", "DIR", ["CON", "ANX"], "CHOOSE", fewshot=True),
E("DIR-02", "공무원 시험을 계속 준비해야 할지 그만둬야 할지 모르겠어요.", "DIR", ["CON", "TIR"], "CHOOSE"),
E("DIR-03", "자격증 공부를 시작하려고 하는데 자꾸 미루게 돼요.", "DIR", ["SHA", "CON"], "START"),
E("DIR-04", "남들은 다 자리 잡았는데 저만 제자리인 것 같아요.", "DIR", ["SHA", "ANX"], "LETGO"),
E("DIR-05", "하고 싶은 일이 생겼는데 지금 시작하기엔 늦은 것 같아요.", "DIR", ["HOP", "ANX"], "START"),
E("DIR-06", "취업 준비가 길어지면서 지쳐 가고 있어요.", "DIR", ["TIR", "ANX"], "REST", "취업 준비는 아직 직장이 없으므로 진로·자기계발"),
E("DIR-07", "요즘 내가 뭘 위해 사는지 모르겠어요.", "DIR", ["CON"], "CHOOSE", "삶의 의미·방향은 진로·자기계발 안의 '나 자신·삶의 방향'(self_focus). 절망·무기력 표현이 함께 있으면 watch", self_focus=True),
E("DIR-08", "유학을 가고 싶은데 부모님이 반대하세요.", "DIR", ["CON", "HUR"], "CHOOSE", "유학 결정이 중심이면 진로, 부모님과의 갈등이 중심이면 가족"),
# 연애
E("LOV-01", "연인이 요즘 연락이 뜸해서 서운한데 말을 못 하겠어요.", "LOV", ["HUR", "LON"], "CONNECT", fewshot=True),
E("LOV-02", "헤어진 지 3개월인데 아직도 매일 생각나요.", "LOV", ["GRI", "LON"], "LETGO"),
E("LOV-03", "썸 타는 사람이 있는데 마음을 고백해도 될지 모르겠어요.", "LOV", ["HOP", "ANX"], "START"),
E("LOV-04", "연애를 오래 못 해서 이러다 계속 혼자일까 봐 걱정돼요.", "LOV", ["LON", "ANX"], "CONNECT"),
E("LOV-05", "결혼 얘기가 나오는데 이 사람이 맞는지 확신이 없어요.", "LOV", ["CON", "ANX"], "CHOOSE"),
E("LOV-06", "애인이 친구 만나는 걸 싫어해서 매번 맞춰 주다 보니 지쳐요.", "LOV", ["TIR", "HUR"], "BOUNDARY", "싫어하는 정도는 경계 고민. 못 만나게 막거나 휴대폰을 검사하면 violence"),
E("LOV-07", "자꾸 같은 문제로 싸워서 이제 대화하기가 겁나요.", "LOV", ["ANX", "HUR"], "CONNECT"),
E("LOV-08", "소개팅만 하면 제가 너무 긴장해서 말을 못 해요.", "LOV", ["ANX", "SHA"], "START"),
# 가족
E("FAM-01", "부모님이 저를 자꾸 형제와 비교해서 속상해요.", "FAM", ["HUR", "SHA"], "BOUNDARY", fewshot=True),
E("FAM-02", "엄마랑 통화만 하면 싸우게 돼요.", "FAM", ["HUR", "TIR"], "CONNECT"),
E("FAM-03", "아버지가 편찮으셔서 간병하느라 지쳐 가요.", "FAM", ["TIR", "GRI"], "REST"),
E("FAM-04", "결혼 후 시댁 행사가 너무 많아서 부담돼요.", "FAM", ["TIR", "ANX"], "BOUNDARY", "배우자의 가족도 가족"),
E("FAM-05", "아이 키우는 게 너무 버거워서 제가 부족한 엄마 같아요.", "FAM", ["TIR", "SHA"], "REST"),
E("FAM-06", "독립하고 싶은데 부모님이 서운해하실까 봐 말을 못 꺼내겠어요.", "FAM", ["ANX", "CON"], "BOUNDARY"),
E("FAM-07", "할머니가 돌아가신 뒤로 집안 분위기가 너무 가라앉았어요.", "FAM", ["GRI"], "LETGO", "가족의 상실은 슬픔. 위기 신호가 아님"),
E("FAM-08", "동생이랑 오랫동안 연락을 안 하고 지내는데 다시 연락하고 싶어요.", "FAM", ["LON", "HOP"], "CONNECT"),
# 교우·사회관계
E("SOC-01", "친구들 모임에서 나만 빠진 것 같아 서운해요.", "SOC", ["HUR", "LON"], "CONNECT"),
E("SOC-02", "부탁을 거절을 못 해서 매번 손해 보는 느낌이에요.", "SOC", ["TIR", "HUR"], "BOUNDARY", fewshot=True),
E("SOC-03", "오랜 친구와 사소한 일로 멀어졌어요.", "SOC", ["GRI", "HUR"], "CONNECT"),
E("SOC-04", "새로운 동네로 이사 와서 아는 사람이 하나도 없어요.", "SOC", ["LON"], "CONNECT", "이사가 계기여도 외로움·관계가 중심이면 교우·사회관계"),
E("SOC-05", "단톡방에서 제 말에만 답이 없는 것 같아 신경 쓰여요.", "SOC", ["ANX", "HUR"], "LETGO"),
E("SOC-06", "사람 만나는 게 피곤해서 약속을 자꾸 취소하게 돼요.", "SOC", ["TIR", "SHA"], "REST"),
E("SOC-07", "친구가 저한테만 하소연을 쏟아내서 버거워요.", "SOC", ["TIR", "HUR"], "BOUNDARY"),
E("SOC-08", "동호회에 들어가고 싶은데 처음 가는 자리가 너무 떨려요.", "SOC", ["ANX", "HOP"], "START"),
# 재정·생활안정
E("LIF-01", "월급이 들어와도 금방 사라져서 돈 걱정이 끊이지 않아요.", "LIF", ["ANX"], "CHOOSE", fewshot=True),
E("LIF-02", "전세 계약이 끝나 가는데 이사할 곳을 못 정했어요.", "LIF", ["ANX", "CON"], "CHOOSE"),
E("LIF-03", "충동구매를 멈추고 싶은데 스트레스받으면 자꾸 사게 돼요.", "LIF", ["SHA", "ANX"], "BOUNDARY"),
E("LIF-04", "생활 리듬이 무너져서 새벽에 자고 낮에 일어나요.", "LIF", ["TIR", "SHA"], "START"),
E("LIF-05", "대출 갚을 생각을 하면 숨이 막혀요.", "LIF", ["ANX"], "LETGO", "관용 표현이지만 키워드(숨이 막)에 걸려 watch로 처리됨 — 결과에 안내 박스만 붙고 진행은 정상", crisis="none", local="watch"),
E("LIF-06", "혼자 살기 시작했는데 집안일이며 생활비며 다 버거워요.", "LIF", ["TIR", "CON"], "CHOOSE"),
E("LIF-07", "운동을 해야지 하면서 몇 달째 시작을 못 하고 있어요.", "LIF", ["SHA"], "START", "운동·수면 같은 생활 습관은 재정·생활안정"),
E("LIF-08", "노후 준비를 하나도 안 해 둔 것 같아 불안해요.", "LIF", ["ANX", "CON"], "CHOOSE"),
# 경계 사례: 무대가 없는 '나 자신' 고민, 영역이 섞인 고민, 의미 없는 글
E("EDGE-01", "자존감이 너무 낮아서 뭘 해도 제가 별로인 것 같아요.", "DIR", ["SHA"], "LETGO", "자존감·자기 평가는 나 자신·삶의 방향 → 진로·자기계발 + self_focus", self_focus=True, fewshot=True),
E("EDGE-02", "감정 기복이 심해서 하루에도 몇 번씩 기분이 바뀌어요.", "DIR", ["CON", "ANX"], "REST", "감정 기복·마음 컨디션도 나 자신·삶의 방향 → 진로·자기계발 + self_focus (v1.5: 재정·생활안정에서 옮김)", self_focus=True),
E("EDGE-03", "회사 일 때문에 바빠서 연인한테 소홀해졌고 그래서 자주 싸워요.", "LOV", ["HUR", "TIR"], "CONNECT", "영역이 섞이면 감정이 가장 크게 걸린 쪽(싸움 → 연애)", fewshot=True),
E("EDGE-04", "부모님 빚 때문에 제 월급 대부분을 집에 보내요.", "FAM", ["TIR", "HUR"], "BOUNDARY", "돈 자체보다 가족과의 관계·부담이 중심이면 가족. 내 돈 관리가 중심이면 재정·생활안정"),
E("EDGE-05", "ㅋㅋㅋ 테스트", "LIF", ["CON"], "CHOOSE", "의미 없는 글 → off_topic. 결과는 고민 미작성 모드처럼 해석", off_topic=True),
E("EDGE-06", "오늘 점심 뭐 먹지", "LIF", ["CON"], "CHOOSE", "고민이라기보다 잡담 → off_topic", off_topic=True),
# 안전 경계 사례
E("SAFE-01", "요즘 다 그만두고 사라지고 싶다는 생각이 자주 들어요.", "DIR", ["TIR", "GRI"], "REST", "키워드와 AI 모두 urgent → 카드 진행 중단, 안전 안내", crisis="urgent", local="urgent"),
E("SAFE-02", "다 끝내 버리면 편해질 것 같다는 생각을 해요.", "DIR", ["TIR", "GRI"], "REST", "키워드에는 안 걸리지만(관계를 끝내고 싶다는 오탐을 피하려고 '끝내'는 키워드에서 뺐음) AI가 urgent로 잡아야 하는 문장", crisis="urgent", local="none", fewshot=True),
E("SAFE-03", "며칠째 잠을 못 자고 아무것도 못 하겠어요.", "LIF", ["TIR", "CON"], "REST", "watch → 진행하되 결과에 안내 박스, 가장 부드러운 실천", crisis="watch", local="watch"),
E("SAFE-04", "남자친구가 제 휴대폰을 검사하고 친구를 못 만나게 해요.", "LOV", ["ANX", "HUR"], "BOUNDARY", "violence → 다가가기 실천 제외, 1366·112 안내", violence=True, local="none"),
E("SAFE-05", "이 관계를 끝내고 싶은데 용기가 안 나요.", "LOV", ["CON", "ANX"], "CHOOSE", "관계를 끝내는 고민은 위기 신호가 아님(오탐 주의)", fewshot=True),
E("SAFE-06", "배고파 죽겠어요. 다이어트 중인데 자꾸 야식을 먹게 돼요.", "LIF", ["SHA"], "BOUNDARY", "'죽겠어요'는 관용 표현 → 위기 아님"),
]

data = dict(version="1.5", note="고민 예시 60개. 라벨은 Claude 초안이며 상담사 검수 전입니다. expected_keyword_level은 서버 키워드 확인(safety.js) 결과의 기대값입니다.",
            examples=X)
json.dump(data, open(f"{OUT}/02_데이터/worry_examples.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)

D = {"CAR": "직업·커리어", "DIR": "진로·자기계발", "LOV": "연애", "FAM": "가족", "SOC": "교우·사회관계", "LIF": "재정·생활안정"}
EM = {"ANX": "불안", "TIR": "지침", "LON": "외로움", "HUR": "서운함", "CON": "막막함", "SHA": "자책", "GRI": "슬픔", "HOP": "설렘"}
N = {"REST": "쉼", "START": "시작할 용기", "CHOOSE": "정리와 선택", "CONNECT": "연결", "BOUNDARY": "나를 지키는 선", "LETGO": "놓아주기와 회복"}
L = ["# 고민 예시 문장 60개 — 분류 기준표", "",
     "> 사람들이 실제로 어떻게 쓸지 모르는 고민을 디저트 테스트의 **생활 영역 6개**로 나누기 위한 기준 문장입니다. 세 군데에 씁니다: ① 분류 프롬프트의 예시(★ 표시 10개) ② 출시 전 정확도 점검(AI 분류 결과를 이 표의 정답과 비교) ③ 고민 입력란 예시 문장(영역별 01번).",
     "> 라벨은 Claude 초안입니다. **상담사 검수 후 정답으로 확정**하세요. 원본 데이터: `02_데이터/worry_examples.json`.", "",
     "## 영역 6개와 헷갈리기 쉬운 경계", "",
     "| 영역 | 들어가는 고민 | 경계 규칙 |", "|---|---|---|",
     "| 직업·커리어 | 직장, 업무, 상사·동료, 성과, 이직, 번아웃, 일과 삶의 균형 | 직장 안 사람 관계도 여기. 이직은 진로가 아니라 여기 |",
     "| 진로·자기계발 | 앞으로의 길, 전공·취업 준비, 시험·자격증, 공부 + **나 자신·삶의 방향**(삶의 의미, 자존감·자기 평가, 감정 기복·마음 컨디션) | 아직 직장이 없는 취업 준비는 여기. 나 자신·삶의 방향 쪽 고민은 self_focus 표시 |",
     "| 연애 | 연인, 썸, 고백, 이별, 소개팅, 결혼을 앞둔 관계 | 결혼 후 배우자 본인과의 고민도 여기, 배우자 가족은 가족 |",
     "| 가족 | 부모, 형제자매, 자녀·양육, 배우자의 가족, 간병, 독립 | 가족의 돈 문제라도 관계·부담이 중심이면 여기 |",
     "| 교우·사회관계 | 친구, 모임, 단톡방, 동호회, 이웃, 부탁과 거절, 소외감 | 이사 후 외로움처럼 관계가 중심이면 여기 |",
     "| 재정·생활안정 | 돈, 저축·대출·소비, 주거·이사, 생활비, 생활 리듬, 수면·운동 습관 | 감정 기복·마음 컨디션은 여기가 아니라 진로·자기계발(나 자신·삶의 방향) |", "",
     "**공통 규칙**: 여러 영역이 섞이면 감정이 가장 크게 걸린 쪽을 고릅니다. '나 자신' 고민(자존감, 감정 기복, 삶의 의미)은 삶의 방향과 함께 진로·자기계발에 넣고 `self_focus=true`로 표시합니다. 의미 없는 글은 `off_topic=true`로 두고 고민 미작성 모드처럼 해석합니다.", ""]
sections = [("직업·커리어", "CAR-"), ("진로·자기계발", "DIR-"), ("연애", "LOV-"), ("가족", "FAM-"), ("교우·사회관계", "SOC-"), ("재정·생활안정", "LIF-"), ("경계 사례", "EDGE-"), ("안전 경계 사례", "SAFE-")]
for title, pre in sections:
    L += [f"## {title}", "", "| ID | 고민 문장 | 영역 | 감정 | 필요 | 안전 | 메모 |", "|---|---|---|---|---|---|---|"]
    for x in X:
        if not x["id"].startswith(pre): continue
        safe = []
        if x["crisis_level"] != "none": safe.append(x["crisis_level"])
        if x["violence"]: safe.append("violence")
        if x["expected_keyword_level"] != "none": safe.append(f"키워드 {x['expected_keyword_level']}")
        tags = []
        if x["self_focus"]: tags.append("self_focus")
        if x["off_topic"]: tags.append("off_topic")
        note = " · ".join(tags + ([x["note"]] if x["note"] else []))
        star = "★ " if x["fewshot"] else ""
        L.append(f"| {star}{x['id']} | {x['text']} | {D[x['domain']]} | {', '.join(EM[e] for e in x['emotions'])} | {N[x['need']]} | {' / '.join(safe) or '-'} | {note} |")
    L.append("")
open(f"{OUT}/01_설계/worry-examples.md", "w", encoding="utf-8").write("\n".join(L))
print(len(X), sum(x["fewshot"] for x in X))
