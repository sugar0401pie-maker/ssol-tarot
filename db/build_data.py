# -*- coding: utf-8 -*-
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from cards import CARDS
from reversed import REV
from db_lines import WHY, CLOSING, EMOTION_LINES
from card_about import ABOUT, ASKS
from rx_bank import BY_DOMAIN_NEED, BY_NEED
from deep_reading import DEEP, DEEP_REV_COMMON
from ssol_rx import SSOL_BY_DOMAIN_NEED, SSOL_BY_NEED
import re as _re
def _split_about(t):
  first = _re.match(r'.+?(요|다)\. ', t).group(0)
  return first.strip(), t[len(first):].strip()

OUT = sys.argv[1]

# v1.3: 디저트 테스트(쏠 웰니스 유형 진단)에서 확정한 생활 영역 태그 6개를 그대로 사용
DOMAINS = [
  dict(code="CAR", name="직업·커리어", phrase="직업과 커리어에 대한 고민", hint="직장, 업무, 상사·동료(직장 안 관계), 성과, 이직, 번아웃, 일과 삶의 균형"),
  dict(code="DIR", name="진로·자기계발", phrase="진로와 자기계발에 대한 고민", phrase_self="나 자신과 삶의 방향에 대한 고민", hint="앞으로의 길, 전공·취업 준비, 시험·자격증, 공부, 하고 싶은 일 + (v1.5) 나 자신·삶의 방향: 삶의 의미, 자존감·자기 평가, 감정 기복·마음 컨디션"),
  dict(code="LOV", name="연애", phrase="연애에 대한 고민", hint="연인, 썸, 고백, 이별, 소개팅, 결혼을 앞둔 관계"),
  dict(code="FAM", name="가족", phrase="가족에 대한 고민", hint="부모, 형제자매, 자녀·양육, 배우자의 가족, 간병·돌봄, 독립"),
  dict(code="SOC", name="교우·사회관계", phrase="친구와 사회관계에 대한 고민", hint="친구, 모임, 단톡방, 동호회, 이웃, 부탁과 거절, 소외감"),
  dict(code="LIF", name="재정·생활안정", phrase="재정과 생활 안정에 대한 고민", hint="돈, 저축·대출·소비, 주거·이사, 생활비, 생활 리듬, 수면·운동 같은 생활 습관"),
]
DOMAIN_REMAP = {"REL": ["FAM", "SOC"], "SLF": []}  # v1.2까지 쓰던 코드 → 새 6개 영역(카드 매칭 태그 변환용)
EMOTIONS = [
  dict(code="ANX", name="불안", desc="걱정되고 마음이 조마조마해요"),
  dict(code="TIR", name="지침", desc="몸도 마음도 지쳐 있어요"),
  dict(code="LON", name="외로움", desc="혼자인 것 같고 쓸쓸해요"),
  dict(code="HUR", name="서운함", desc="서운하거나 화가 나요"),
  dict(code="CON", name="막막함", desc="어디서부터 해야 할지 모르겠어요"),
  dict(code="SHA", name="자책", desc="내 탓 같고 부끄러워요"),
  dict(code="GRI", name="슬픔", desc="무언가를 잃은 것 같아 슬퍼요"),
  dict(code="HOP", name="설렘", desc="기대되지만 조금 긴장돼요"),
]
NEEDS = [
  dict(code="REST", name="쉼", desc="잠시 쉬어 가고 싶어요"),
  dict(code="START", name="시작할 용기", desc="한 걸음 내딛고 싶어요"),
  dict(code="CHOOSE", name="정리와 선택", desc="생각을 정리하고 고르고 싶어요"),
  dict(code="CONNECT", name="연결", desc="누군가와 이어지고 싶어요"),
  dict(code="BOUNDARY", name="나를 지키는 선", desc="나를 지키는 선을 세우고 싶어요"),
  dict(code="LETGO", name="놓아주기와 회복", desc="내려놓고 회복하고 싶어요"),
]
POSITIONS = [
  dict(code="now", order=1, name="지금의 마음", hint="첫 번째 카드는 지금의 마음을 비춰요."),
  dict(code="hold", order=2, name="나를 붙잡는 것", hint="두 번째 카드는 나를 붙잡고 있는 것을 비춰요."),
  dict(code="step", order=3, name="다음 한 걸음", hint="세 번째 카드는 다음 한 걸음을 비춰요."),
]

SCORING = dict(
  shortlist_size=7, pick_count=3,
  weights=dict(need=3, emotion_primary=2, emotion_secondary=1, domain=1),
  tie_break="카드 번호(no) 오름차순 — 무작위 없음",
  display_order="화면 배치 순서만 세션 ID 시드로 섞는다(결과와 무관).",
  status="보류(v1.1부터 사용 안 함) — 고민 맞춤 7장 모드. 나중에 A/B나 '추천 카드 보기' 기능으로 쓸 수 있게 남겨 둠.",
)

DECK = dict(
  version="v1.1",
  deck_size=22, pick_count=3, allow_reshuffle=True, reshuffle_limit=None,
  shuffle="'다시 섞을게요'를 누를 때마다 서버가 22장 순서를 새로 무작위로 섞는다(crypto 난수). 화면에는 뒷면만 보내고, 어느 자리에 어떤 카드가 있는지는 서버만 안다.",
  pick="사용자가 22장 중 3장을 직접 고른다. 고르는 즉시 앞면으로 뒤집히며 위쪽 슬롯으로 이동. 고른 순서 = 지금의 마음 → 나를 붙잡는 것 → 다음 한 걸음. 한 번 뒤집은 카드는 되돌리지 않는다.",
  log="셔플마다 shuffle_id와 카드 순서·방향을 저장(재현·감사용). 다시 섞은 횟수도 기록.",
  reversed_rate=0.5,
  reversed_rule="v1.8 역방향: 셔플할 때 카드마다 50% 확률로 역방향(전통 타로와 같음, 서버, crypto). 역방향은 '나쁜 카드'가 아니라 그 카드의 힘이 아직 안쪽에 머물러 있거나(막힘) 한쪽으로 지나치게 쓰이는(과함) 상태로 해석. 뒤집을 때 카드 그림이 180도 돌아간 채 나오고, 카드명은 그림 아래에 바로 서 있는 글자 + '역방향' 표시. 뒷면 무늬가 위아래 대칭이라 뽑기 전에는 방향을 알 수 없음.",
)

COPY = dict(
  test_name_draft="쏠 타로 하우스 (가제)",
  intro=dict(rule="디저트 테스트 인트로와 동일 구성(제목 + 참여자 수 + 시작 버튼). 히어로 자리에 바다 친구들이 한 명씩 무작위로 지나가는 연출(디자인 가이드 5-1)",
             participants="벌써 {count}명이 쏠 타로 하우스를 다녀갔어요", button="테스트 하기"),
  welcome=dict(
    title="쏠 타로 하우스에 오신 당신을 환영합니다.",
    sub="당신을 뭐라고 불러드리면 될까요?",
    placeholder="닉네임", min_len=1, max_len=10,
    empty_error="불러드릴 이름을 적어 주세요.",
    button="이렇게 불러주세요"),
  experience=dict(
    title="{nickname}님, 오늘은 어떤 고민을 가져오셨나요?",
    sub="타로카드는 처음이신지요?",
    button_returning="전에 본 적이 있어요",
    button_first="네, 처음이에요"),
  first_time=dict(
    body="오늘 {nickname}님의 고민을 타로카드가 어떻게 비춰 주는지 들어봅시다. 우리 쏠 하우스만의 특제 레시피로 {nickname}님의 타로 카드가 설명하는 현재 상황에 적절한 웰니스 제안을 해드릴게요. 이제 한 번 해볼까요?",
    button="네, 좋아요!"),
  worry=dict(
    title="좋습니다. 먼저 {nickname}님의 고민을 편하게 작성해주세요.",
    sub="구체적으로 쓸수록 도움이 됩니다. 고민을 굳이 작성하지 않으셔도 타로카드는 볼 수 있어요.",
    placeholder_examples=[
      "회사에서 열심히 하는데 인정받지 못하는 것 같아 지쳐요.",
      "졸업이 다가오는데 뭘 하고 싶은지 모르겠어요.",
      "연인이 요즘 연락이 뜸해서 서운한데 말을 못 하겠어요.",
      "부모님이 저를 자꾸 형제와 비교해서 속상해요.",
      "부탁을 거절하지 못해서 매번 손해 보는 느낌이에요.",
      "월급이 들어와도 금방 사라져서 돈 걱정이 끊이지 않아요.",
    ],
    placeholder_rule="영역 6개에서 한 문장씩, 3초마다 순환",
    min_len=10, max_len=300,
    button_submit="제출하기",
    button_skip="고민은 마음속으로만 생각하고 싶어요",
    too_short="조금만 더 들려주세요. 10자 이상 적어 주시면 해석이 더 정확해져요.",
    footnote="전문 심리상담사가 만든 자기이해 웰니스 콘텐츠예요. 미래를 예언하거나 의료적 진단·심리 치료를 대신하지 않아요. 적어 주신 고민은 카드 해석에만 쓰이고 공유 카드에는 보이지 않아요."),
  shuffle=dict(
    guide="이제 카드를 선택할 시간입니다. 가장 고민되는 부분을 생각하면서 골라주세요. 최대한 구체적으로 생각하고 뽑을수록 좋아요.",
    done="카드가 잘 섞였습니다. 원하신다면 다시 섞으셔도 돼요.",
    button_pick="지금 뽑을게요", button_reshuffle="다시 섞을게요"),
  pick=dict(
    guide="고민을 되새기면서 가장 마음이 가는 카드 3개를 뽑아주세요.",
    slot_labels=["지나온 길", "지금의 흐름", "앞으로의 열쇠"],
    counter="{picked} / 3"),
  reveal=dict(
    done="카드를 다 뽑았어요. 이제 설명을 보러 가볼까요?",
    button="네, 좋습니다."),
  loading=dict(
    message="{nickname}님의 타로 결과를 분석하고 있어요...",
    elapsed="({seconds}초 경과)",
    rule="시간이 걸리는 모든 대기 화면(고민 분류, 결과 준비, 결제 후 리포트 생성, 공유 이미지 생성)에 같은 문구와 경과 초를 1초마다 갱신해 보여준다. 일정 시간 이상 걸릴 때의 추가 안내는 미정(CSO 결정 예정).",
    long_wait_policy="미정"),
  result=dict(
    headline="{nickname}님에게 온 세 장의 카드",
    paywall_title="이어지는 이야기는 리포트에서 열려요",
    paywall_body="세 장이 함께 들려주는 이야기, 마음 깊이 읽기, 웰니스 처방, 이번 주 실천 카드까지 이어서 읽을 수 있어요.",
    paywall_price="전체 리포트 1,900원",
    paywall_button="1,900원 결제하고 이어 읽기",
    generating="바다 친구들이 리포트를 쓰고 있어요…",
    share="내 카드 공유하기", save="결과 저장하기", retry="다른 고민으로 다시 해 보기"),
  share_card=dict(title="{nickname}님의 웰니스 타로 세 장", sub="오늘 당신에게 온 카드는?", button="나도 카드 뽑기",
                  rule="공유 카드에는 카드 그림·카드명·위치 이름만 넣는다. 고민 원문, 감정, 해석 문장은 넣지 않는다."),
  disclaimer="이 결과는 전문 심리상담사가 설계한 자기이해용 웰니스 콘텐츠예요. 미래를 예측하지 않으며, 의료적 진단이나 심리 치료를 대신하지 않아요. 마음이 많이 힘들다면 전문가와 이야기 나눠 주세요.",
  safety=dict(
    urgent_title="지금은 카드보다 사람의 목소리가 먼저 필요해 보여요",
    urgent_body="적어 주신 이야기에서 많이 힘든 마음이 느껴졌어요. 혼자 견디지 않아도 괜찮아요. 지금 바로 이야기 나눌 수 있는 곳이 있어요.",
    urgent_contacts=[
      dict(name="자살예방상담전화", number="109", note="24시간"),
      dict(name="정신건강위기상담전화", number="1577-0199", note="24시간"),
      dict(name="긴급 상황", number="119 / 112", note=""),
    ],
    urgent_cta="쏠 웰니스 하우스 전문 상담 알아보기",
    watch_box="요즘 마음이 많이 무거우셨던 것 같아요. 카드 해석과 함께, 필요할 때 언제든 기댈 수 있는 곳도 적어 둘게요.",
    violence_box="혹시 상대가 무섭게 느껴지거나 통제받는다고 느낀다면, 그건 혼자 해결해야 할 고민이 아니에요. 여성긴급전화 1366(24시간), 긴급 시 112에서 도움받을 수 있어요."),
  cta_chat=dict(
    title="쏘웰라와 이어서 이야기하기",
    body="카드에서 마음에 걸린 문장이 있다면 쏘웰라에게 이어서 이야기해 보세요. 쏘웰라는 전문 상담사가 설계한 웰니스 대화예요. 타로를 보신 분들은 3일 동안 무료로 이용할 수 있어요. 지금의 계정 그대로 쏘웰라에 접속할 수 있으니 지금 바로 대화해 볼까요?",
    button="쏘웰라 3일 무료로 시작하기",
    rule="v2.2: 유료 리포트 마지막(8번)에서 소개. 1,900원 리포트에 채팅권은 없고, 타로 이용자 3일 무료 + 같은 계정으로 바로 접속을 안내."),
  asks_headings=["혹시 이렇진 않나요?", "이런 순간, 떠오르지 않나요?", "이런 마음이 익숙하진 않으세요?"],
  result_cards=dict(
    rule="결과 화면 맨 위에 뽑은 카드 3장 이미지를 가로로 나란히(역방향은 180도 회전). 카드를 누르면 확대 보기, 닫으면 제자리로. 확대·축소 모두 카드가 움직이는 연출(디자인 가이드 5-2).",
    hint="카드를 누르면 크게 볼 수 있어요"),
)

# v1.8 결과 구조: 카드 3장을 각각 따로 설명. 1·2번째 카드까지 무료, 3번째 카드(다음 한 걸음)부터 블러.
# teaser = 결제 전 블러 위에 보이는 고정 한 줄(AI 아님)
REPORT_SECTIONS = [
  dict(no=1, title="오늘 당신에게 온 세 장", access="무료", writer="서버(세 장 한눈에 보기: 카드별 원론 설명 + 고민 읽기 한 문장)"),
  dict(no=2, title="첫 번째 카드 · 지금의 마음", access="무료", writer="서버/DB(위치 해석·깊이 읽기·감정 문장) + 저비용 AI 연결 한 줄"),
  dict(no=3, title="두 번째 카드 · 나를 붙잡는 것", access="무료", writer="서버/DB(위치 해석·깊이 읽기) + 저비용 AI 연결 한 줄"),
  dict(no=4, title="세 번째 카드 · 다음 한 걸음", access="유료", writer="서버/DB(어떤 카드인가요·위치 해석) + 저비용 AI 연결 한 줄·질문", teaser="어떤 카드인지, 그리고 다음으로 내디딜 한 걸음 — 세 번째 카드가 건네는 메시지"),
  dict(no=5, title="세 장이 함께 들려주는 이야기", access="유료", writer="저비용 AI(이야기 한 문단 + 내 고민에 대어 보기 한 문단) + DB 마무리 문장", teaser="세 장의 카드가 하나의 흐름으로 들려주는, 내 고민에 맞춘 이야기"),
  dict(no=6, title="다음 한 걸음을 위한 웰니스 처방", access="유료", writer="DB(처방 은행: 고민 영역 × 필요 처방 + 세 번째 카드의 필요 처방)", teaser="내 고민에 맞춘 웰니스 처방과 그 이유"),
  dict(no=7, title="이번 주 실천 카드", access="유료", writer="DB 규칙 조립", teaser="오늘 / 3일 안에 / 이번 주 — 바로 해 볼 수 있는 작은 실천 3장"),
  dict(no=8, title="쏘웰라와 이어서 이야기하기", access="유료", writer="서버(고정 안내 — 타로 이용자 쏘웰라 3일 무료, 같은 계정 접속)", teaser="타로를 본 분께 드리는 쏘웰라 3일 무료 대화"),
]

cards = []
for c in CARDS:
  d = dict(no=c["no"], id=c["id"], arcana=c["arcana"], name=c["name"], character=c["character"],
           relationship_test_position=c["rel"], keywords=c["keywords"], core=c["core"],
           positions=dict(now=c["now"], hold=c["hold"], step=c["step"]),
           reversed=dict(core=REV[c["no"]][0], positions=dict(now=REV[c["no"]][1], hold=REV[c["no"]][2], step=REV[c["no"]][3])),
           practices=[dict(title=p["title"], how=p["how"], time=p["time"], approach=bool(p.get("approach")), why=WHY[c["no"]][i]) for i, p in enumerate(c["practices"])],
           closing=CLOSING[c["no"]], about=ABOUT[c["no"]], about_when=_split_about(ABOUT[c["no"]])[0], about_origin=_split_about(ABOUT[c["no"]])[1], asks=ASKS[c["no"]],
           deep=DEEP[c["no"]], deep_reversed={k: [v] for k, v in DEEP_REV_COMMON.items()},
           theories=c["theories"],
           match=dict(needs=c["needs"], emotions=c["emotions"], domains=list(dict.fromkeys(x for d in c["domains"] for x in DOMAIN_REMAP.get(d, [d])))),
           image=dict(file=f"card-{c['no']:02d}-{c['id']}.webp", scene_prompt=c["scene"]),
           caution=c.get("caution", ""), art_note=c.get("art_note", ""))
  cards.append(d)

def _rx():
  """6번 처방: 쏠 실천 통합본에서 고른 실천(SSOL) 우선, 통합본에 맞는 게 없는 칸(가족·재정생활)은 쏠 타로 자체 처방."""
  def own(r): return dict(r, source="쏠 타로 자체", ssol_id=None, adapted=False)
  def ssol(r): return dict(title=r["title"], how=r["how"], why=r["why"], approach=r["approach"], source="쏠 실천 통합본 v1.0", ssol_id=r["ssol_id"], adapted=r["adapted"])
  dn = {k: (ssol(SSOL_BY_DOMAIN_NEED[k]) if k in SSOL_BY_DOMAIN_NEED else own(v)) for k, v in BY_DOMAIN_NEED.items()}
  bn = {k: (ssol(SSOL_BY_NEED[k]) if k in SSOL_BY_NEED else own(v)) for k, v in BY_NEED.items()}
  return dict(by_domain_need=dn, by_need=bn)

data = dict(version="2.3", date="2026-10-07",
            note="웰니스 타로(가제) 단일 데이터 원천. 카드 해석·실천은 Claude 초안이며 상담사(JunSeok) 검수 전입니다.",
            domains=DOMAINS, emotions=EMOTIONS, needs=NEEDS, positions=POSITIONS,
            emotion_lines=EMOTION_LINES, prescriptions=_rx(), deck=DECK, scoring=SCORING, report_sections=REPORT_SECTIONS, copy=COPY, cards=cards)

os.makedirs(f"{OUT}/02_데이터", exist_ok=True)
with open(f"{OUT}/02_데이터/tarot_data.json", "w", encoding="utf-8") as f:
  json.dump(data, f, ensure_ascii=False, indent=2)

# ---- 카드 해석 문서 (사람 검수용) ----
NM = {x["code"]: x["name"] for x in DOMAINS + EMOTIONS + NEEDS}
L = ["# 웰니스 타로 22장 — 카드 해석 원본 (base_knowledge 역할)", "",
     "> `02_데이터/tarot_data.json`과 같은 내용을 사람이 읽기 좋게 펼친 문서입니다. 수정은 JSON(또는 원본 cards.py)에서 하고 이 문서는 다시 생성하세요.",
     "> 모든 해석·실천은 Claude 초안입니다. **상담사(JunSeok) 검수 전**이며, 디저트 테스트의 base_knowledge처럼 검수 후에는 AI 리포트의 하한선 자료가 됩니다.", "",
     "## 한눈에 보기", "", "| # | 원 카드 | 웰니스 카드명 | 캐릭터 | 키워드 | 필요(매칭) |", "|---|---|---|---|---|---|"]
for c in cards:
  L.append(f"| {c['no']} | {c['arcana']} | {c['name']} | {c['character']} | {' · '.join(c['keywords'])} | {', '.join(NM[n] for n in c['match']['needs'])} |")
L.append("")
for c in cards:
  L += [f"## {c['no']}. {c['name']} — {c['character']}", "",
        f"- 원 카드: {c['arcana']} / 관계성 테스트 위치: {c['relationship_test_position']}",
        f"- 키워드: {' · '.join(c['keywords'])}",
        f"- 핵심 메시지: {c['core']}",
        f"- 매칭: 필요 {', '.join(NM[n] for n in c['match']['needs'])} / 감정 {', '.join(NM[n] for n in c['match']['emotions'])} / 영역 {', '.join(NM[n] for n in c['match']['domains'])}", "",
        "| 위치 | 정방향 해석 |", "|---|---|",
        f"| 지금의 마음 | {c['positions']['now']} |",
        f"| 나를 붙잡는 것 | {c['positions']['hold']} |",
        f"| 다음 한 걸음 | {c['positions']['step']} |", "",
        f"**역방향** — {c['reversed']['core']}", "",
        f"**세 장 한눈에 보기(원론)**: {c['about']}", "",
        "**마음에 묻는 질문 (기본 문장)**", "", *[f"- {q}" for q in c['asks']], "",
        "| 위치 | 역방향 해석 |", "|---|---|",
        f"| 지금의 마음 | {c['reversed']['positions']['now']} |",
        f"| 나를 붙잡는 것 | {c['reversed']['positions']['hold']} |",
        f"| 다음 한 걸음 | {c['reversed']['positions']['step']} |", "",
        "**웰니스 실천**", ""]
  for p in c["practices"]:
    tag = " `다가가기 실천: 폭력·통제 신호 시 제외`" if p["approach"] else ""
    L.append(f"- {p['title']} ({p['time']}) — {p['how']} → *왜 도움이 되나:* {p['why']}{tag}")
  L += ["", f"**세 번째 카드로 나왔을 때 마무리 문장**: {c['closing']}", "", f"**관련 이론(내부 참고용, 화면 노출 안 함)**: {', '.join(c['theories'])}", ""]
  if c["caution"]:
    L += [f"**주의**: {c['caution']}", ""]
os.makedirs(f"{OUT}/01_설계", exist_ok=True)
with open(f"{OUT}/01_설계/card-deck-22.md", "w", encoding="utf-8") as f:
  f.write("\n".join(L) + "\n")
print("ok", len(cards))
