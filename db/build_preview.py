# -*- coding: utf-8 -*-
import base64, io, json, sys
from PIL import Image, ImageDraw
S, OUT = sys.argv[1], sys.argv[2]
SRC = f"{S}/cards23"
data = json.load(open(f"{OUT}/02_데이터/tarot_data.json", encoding="utf-8"))
byno = {c["no"]: c for c in data["cards"]}
import glob, os
files = {int(os.path.basename(f)[:2]): f for f in glob.glob(f"{SRC}/wellness-tarot/cards/*.png")}

def uri(im, w, q=78):
    im = im.convert("RGB"); h = round(im.height * w / im.width)
    b = io.BytesIO(); im.resize((w, h), Image.LANCZOS).save(b, "WEBP", quality=q)
    return "data:image/webp;base64," + base64.b64encode(b.getvalue()).decode()

back = Image.open(f"{SRC}/ornate-back.png")
BACK = uri(back, 180)
em = back.crop((236, 462, 788, 1014)).convert("RGBA")
mask = Image.new("L", em.size, 0); ImageDraw.Draw(mask).ellipse((0, 0) + em.size, fill=255); em.putalpha(mask)
b = io.BytesIO(); em.resize((220, 220), Image.LANCZOS).save(b, "WEBP", quality=80)
EMB = "data:image/webp;base64," + base64.b64encode(b.getvalue()).decode()
F = {n: uri(Image.open(files[n]), 240) for n in (12, 4, 3)}
# 인트로 '바다 친구들 지나가기' 시안용: 카드 그림에서 캐릭터 부분을 원형으로 잘라 씀(최종은 캐릭터 투명 PNG)
CROP = {n: (212, 500, 812, 1100) for n in range(21)}
CROP[2] = (212, 330, 812, 930)
def bubble(n):
    im = Image.open(files[n]).convert("RGBA").crop(CROP[n]).resize((180, 180), Image.LANCZOS)
    m = Image.new("L", im.size, 0); ImageDraw.Draw(m).ellipse((0, 0, 179, 179), fill=255); im.putalpha(m)
    b = io.BytesIO(); im.save(b, "WEBP", quality=78)
    return "data:image/webp;base64," + base64.b64encode(b.getvalue()).decode()
FRIENDS = [dict(src=bubble(n), name=byno[n]["character"], card=byno[n]["name"]) for n in range(21)]
name = lambda n: byno[n]["name"]

def card(n, cls=""):
    return f'<div class="front {cls}"><img src="{F[n]}" alt="{name(n)} — {byno[n]["character"]}"><span>{name(n)}</span></div>'

backs = "".join(f'<i style="--r:{(i-5)*5}deg;--x:{(i-5)*10}px"></i>' for i in range(11))
nick = "민준"
html = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>쏠 타로 하우스 디자인 미리보기</title>
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{{--night:#012F53;--night-deep:#001E38;--gold:#E3C68E;--gold-soft:#F3E2BE;--moon:#FCEFD4;--card-cream:#FEF3DE;--card-line:#204870;--dawn-sky:#A8C4DE;--dawn-peach:#FAE4CD;--navy:#013566;--ink:#1C2B3A;--white:#fff}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#E9E4DA;font-family:'Noto Sans KR',sans-serif;color:var(--ink);padding:32px 16px 64px}}
h1{{font-family:'Gowun Batang',serif;font-size:28px;color:var(--card-line);text-align:center}}
.lead{{text-align:center;color:#5a6470;font-size:14px;margin:8px auto 28px;max-width:720px;line-height:1.6}}
h2{{font-family:'Gowun Batang',serif;font-size:20px;color:var(--card-line);margin:36px auto 14px;max-width:1200px}}
.sw{{display:flex;flex-wrap:wrap;gap:10px;max-width:1200px;margin:auto}}
.sw div{{width:132px;border-radius:12px;overflow:hidden;background:#fff;font-size:12px;box-shadow:0 1px 3px #0002}}
.sw b{{display:block;height:56px}} .sw p{{padding:6px 8px;line-height:1.4}}
.type{{max-width:1200px;margin:auto;display:grid;grid-template-columns:1fr 1fr;gap:12px}}
.type div{{background:var(--night);color:var(--moon);border-radius:14px;padding:18px}}
.type div:last-child{{background:var(--card-cream);color:var(--ink)}}
.row{{display:flex;flex-wrap:wrap;gap:22px;justify-content:center;max-width:1300px;margin:auto}}
.ph{{width:300px}} .ph>small{{display:block;text-align:center;font-size:12px;color:#5a6470;margin-top:8px}}
.scr{{position:relative;height:600px;border-radius:30px;overflow:hidden;border:6px solid #1b1b1b;display:flex;flex-direction:column;align-items:center;padding:42px 26px 26px;text-align:center}}
.night{{background:radial-gradient(120% 70% at 50% 0%,#0a4373 0%,var(--night) 45%,var(--night-deep) 100%);color:var(--moon)}}
.night::before{{content:"";position:absolute;inset:12px;border:1px solid var(--gold);border-radius:20px;opacity:.7;pointer-events:none}}
.night::after{{content:"";position:absolute;inset:16px;border:1px solid var(--gold);border-radius:17px;opacity:.35;pointer-events:none}}
.stars{{position:absolute;inset:0;background-image:radial-gradient(1.2px 1.2px at 20% 30%,#fff9,transparent),radial-gradient(1px 1px at 70% 20%,#fff8,transparent),radial-gradient(1.4px 1.4px at 80% 60%,#fff7,transparent),radial-gradient(1px 1px at 30% 75%,#fff6,transparent),radial-gradient(1.2px 1.2px at 55% 45%,#fff5,transparent);pointer-events:none}}
.morning{{background:var(--card-cream);color:var(--ink);padding:24px 16px}}
.spark{{color:var(--gold);font-size:13px;letter-spacing:10px;margin-bottom:14px}}
.big{{font-family:'Gowun Batang',serif;font-weight:700;font-size:23px;line-height:1.45;color:var(--gold-soft)}}
.sub{{font-size:14px;margin-top:10px;opacity:.9;line-height:1.6}}
.body{{font-size:13.5px;line-height:1.75;margin-top:16px;opacity:.92}}
.in{{margin-top:22px;width:100%;background:var(--moon);color:#8a8f96;border:1px solid var(--gold);border-radius:14px;padding:13px 14px;text-align:left;font-size:14px}}
.in.tall{{height:130px}}
.btn{{width:100%;border-radius:999px;padding:13px;font-size:14.5px;font-weight:500;margin-top:10px;border:1px solid transparent}}
.fill{{background:var(--moon);color:var(--night)}} .line{{border-color:var(--gold);color:var(--moon)}}
.navy{{background:var(--navy);color:#fff}}
.push{{margin-top:auto;width:100%;position:relative}}
.fine{{font-size:11px;opacity:.65;line-height:1.55;margin-top:10px}}
.moonarc{{width:36px;height:12px;border:1.5px solid var(--gold);border-top:none;border-radius:0 0 36px 36px;margin:14px auto 0;opacity:.8}}
.fan{{position:relative;height:190px;width:100%;margin-top:26px}}
.parade{{position:relative;height:230px;width:calc(100% + 52px);margin:18px -26px 0;overflow:hidden}}
.horizon{{position:absolute;left:0;right:0;top:58%;height:42%;background:linear-gradient(#0a4373aa,transparent);border-top:1px solid #E3C68E55}}
.horizon::after{{content:"";position:absolute;left:50%;top:0;width:60px;height:100%;margin-left:-30px;background:linear-gradient(#FCEFD455,transparent);filter:blur(6px)}}
.friend{{position:absolute;top:34px;width:118px;text-align:center;will-change:transform}}
.friend img{{width:118px;height:118px;border-radius:50%;border:2px solid var(--gold);box-shadow:0 0 22px #E3C68E55,0 6px 14px #0008;display:block}}
.friend span{{display:inline-block;margin-top:8px;font-family:'Gowun Batang',serif;font-size:13px;color:var(--gold-soft)}}
.friend .bob{{animation:bob 1.6s ease-in-out infinite}}
@keyframes bob{{0%,100%{{transform:translateY(0) rotate(-3deg)}}50%{{transform:translateY(-10px) rotate(3deg)}}}}
@media (prefers-reduced-motion:reduce){{.friend .bob{{animation:none}}}}
.fan i{{position:absolute;left:50%;bottom:0;width:70px;height:105px;margin-left:-35px;background:url({BACK}) center/cover;border-radius:7px;box-shadow:0 4px 12px #0007;transform:translateX(var(--x)) rotate(var(--r));transform-origin:50% 140%}}
.stack{{position:relative;width:120px;height:180px;margin:30px auto 0}}
.stack i{{position:absolute;inset:0;background:url({BACK}) center/cover;border-radius:9px;box-shadow:0 6px 16px #0008}}
.stack i:nth-child(1){{transform:translate(-26px,6px) rotate(-9deg)}} .stack i:nth-child(2){{transform:translate(24px,4px) rotate(8deg)}}
.slots{{display:flex;gap:8px;justify-content:center;margin-top:16px}}
.slot{{width:74px}} .slot div{{height:111px;border:1.5px dashed var(--gold);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;opacity:.85}}
.slot small{{display:block;font-size:10.5px;margin-top:5px;color:var(--gold-soft)}}
.front{{position:relative;border-radius:8px;overflow:hidden;box-shadow:0 4px 14px #0006}} .front img{{display:block;width:100%}}
.front span{{position:absolute;left:0;right:0;top:92%;transform:translateY(-50%);font-family:'Gowun Batang',serif;font-weight:700;color:var(--card-line);font-size:7.2cqw;container-type:normal}}
.slot .front span{{font-size:8.5px}}
.deck{{margin-top:auto;width:100%}}
.deckrow{{position:relative;height:84px}}
.deckrow i{{position:absolute;bottom:0;width:44px;height:66px;background:url({BACK}) center/cover;border-radius:4px;box-shadow:0 2px 6px #0007}}
.three{{display:flex;gap:8px;margin-top:26px;position:relative}}
.three::before{{content:"";position:absolute;inset:-40px -30px;background:radial-gradient(closest-side,#FAE4CD66,transparent);z-index:0}}
.three .front{{flex:1;z-index:1}} .three .front span{{font-size:10.5px}}
.emb{{width:150px;height:150px;border-radius:50%;margin:70px auto 26px;background:url({EMB}) center/cover;box-shadow:0 0 40px #E3C68E44;animation:spin 18s linear infinite}}
@keyframes spin{{to{{transform:rotate(360deg)}}}}
@media (prefers-reduced-motion:reduce){{.emb{{animation:none}}}}
.thumbs{{display:flex;gap:6px;width:100%}} .thumbs .front{{flex:1}} .thumbs .front span{{font-size:9px}} .front.rev img{{transform:rotate(180deg)}} .front.rev span{{display:none}}
.sec{{background:#fff;border:1px solid #20487033;border-radius:16px;padding:12px;margin-top:10px;text-align:left;width:100%}}
.sec h3{{font-family:'Gowun Batang',serif;font-size:15.5px;color:var(--card-line);margin-bottom:6px}}
.sec p{{font-size:12.5px;line-height:1.7}}
.divider{{color:var(--gold);font-size:11px;letter-spacing:8px;margin:10px 0 0}}
.blur p{{filter:blur(4px);opacity:.6}}
.pay{{background:var(--night);color:var(--moon);border-radius:16px;padding:14px;margin-top:12px;width:100%;font-size:12.5px}}
.pay b{{font-family:'Gowun Batang',serif;font-size:15px;color:var(--gold-soft);display:block;margin-bottom:6px}}
.pay .btn{{padding:10px;font-size:13px}}
.zhint{{font-size:10.5px;color:#7a8794;margin:6px 0 2px}} .thumbs .front{{cursor:zoom-in}}
.zdim{{position:absolute;inset:0;background:#001E38;opacity:0;pointer-events:none;transition:opacity .45s;z-index:15}} .zdim.on{{opacity:.72;pointer-events:auto}}
.zclone{{position:absolute;z-index:20;cursor:zoom-out;transform-origin:50% 50%;will-change:transform;box-shadow:0 18px 40px #000a}} .zclone span{{font-size:14px}}
.zcap{{position:absolute;left:24px;right:24px;bottom:40px;padding:7px 0;border-radius:14px;background:#001E38;z-index:21;text-align:center;color:var(--moon);font-family:'Gowun Batang',serif;font-size:13px;opacity:0;transition:opacity .3s;pointer-events:none}} .zcap.on{{opacity:1}}
.note{{max-width:900px;margin:40px auto 0;font-size:13px;color:#5a6470;line-height:1.7;text-align:center}}
</style></head><body>
<h1>쏠 타로 하우스 · 디자인 미리보기</h1>
<p class="lead">카드 시안(앞면 22장·뒷면)에서 뽑은 분위기를 화면에 입혀 본 예시입니다. 카드 그림은 시안이라 바뀔 수 있고, 색·글꼴·장식 원칙은 <b>design-guide.md</b>를 따릅니다. "달밤에서 시작해 카드를 뒤집는 순간 새벽빛, 해석은 크림색 아침."</p>

<h2>색</h2>
<div class="sw">
<div><b style="background:#012F53"></b><p><strong>night</strong><br>#012F53 · 밤 화면</p></div>
<div><b style="background:#001E38"></b><p><strong>night-deep</strong><br>#001E38 · 그라데이션</p></div>
<div><b style="background:#E3C68E"></b><p><strong>gold</strong><br>#E3C68E · 장식선</p></div>
<div><b style="background:#F3E2BE"></b><p><strong>gold-soft</strong><br>#F3E2BE · 밤 제목</p></div>
<div><b style="background:#FCEFD4"></b><p><strong>moon</strong><br>#FCEFD4 · 밤 본문</p></div>
<div><b style="background:#FEF3DE"></b><p><strong>card-cream</strong><br>#FEF3DE · 아침 배경</p></div>
<div><b style="background:#204870"></b><p><strong>card-line</strong><br>#204870 · 아침 제목</p></div>
<div><b style="background:#A8C4DE"></b><p><strong>dawn-sky</strong><br>#A8C4DE · 보조</p></div>
<div><b style="background:#FAE4CD"></b><p><strong>dawn-peach</strong><br>#FAE4CD · 광채</p></div>
<div><b style="background:#013566"></b><p><strong>navy</strong><br>#013566 · 로고·버튼</p></div>
</div>

<h2>글꼴</h2>
<div class="type">
<div><p style="font-family:'Gowun Batang',serif;font-weight:700;font-size:24px;color:var(--gold-soft)">쏠 타로 하우스에 오신 당신을 환영합니다.</p><p style="margin-top:8px;font-size:14px">고운바탕 700 — 큰 인사·질문·카드명·섹션 제목</p></div>
<div><p style="font-size:15px;line-height:1.7">고민을 되새기면서 가장 마음이 가는 카드 3개를 뽑아주세요.</p><p style="margin-top:8px;font-size:13px;color:#5a6470">Noto Sans KR 400/500 — 본문·버튼·입력란</p></div>
</div>

<h2>화면</h2>
<div class="row">
<div class="ph"><div class="scr night"><div class="stars"></div><div class="spark">✦ ✦ ✦</div><p class="big">쏠 타로 하우스</p><p class="sub">바다 친구들이 건네는 오늘의 마음 카드</p><div class="parade" id="parade"><div class="horizon"></div></div><div class="push"><p class="sub" style="font-size:12.5px">벌써 1,000명이 다녀갔어요</p><div class="btn fill">테스트 하기</div></div></div><small>1 인트로 — 바다 친구들이 한 명씩 무작위로 지나가요 (실제 움직임)</small></div>

<div class="ph"><div class="scr night"><div class="stars"></div><div class="spark" style="margin-top:60px">✦</div><p class="big">쏠 타로 하우스에 오신<br>당신을 환영합니다.</p><p class="sub">당신을 뭐라고 불러드리면 될까요?</p><div class="in">닉네임</div><div class="push"><div class="btn fill">이렇게 불러주세요</div></div></div><small>2 환영 · 닉네임</small></div>

<div class="ph"><div class="scr night"><div class="stars"></div><div class="spark" style="margin-top:60px">✦</div><p class="big">{nick}님, 오늘은 어떤<br>고민을 가져오셨나요?</p><p class="sub">타로카드는 처음이신지요?</p><div class="moonarc"></div><div class="push"><div class="btn fill">전에 본 적이 있어요</div><div class="btn line">네, 처음이에요</div></div></div><small>3 경험 질문</small></div>

<div class="ph"><div class="scr night"><div class="stars"></div><p class="big" style="font-size:20px;margin-top:20px">좋습니다. 먼저 {nick}님의<br>고민을 편하게 작성해주세요.</p><p class="sub" style="font-size:12.5px">구체적으로 쓸수록 도움이 됩니다. 고민을 굳이 작성하지 않으셔도 타로카드는 볼 수 있어요.</p><div class="in tall">부탁을 거절을 못 해서 매번 손해 보는 느낌이에요.</div><div class="push"><div class="btn fill">제출하기</div><div class="btn line">고민은 마음속으로만 생각하고 싶어요</div><p class="fine">전문 심리상담사가 만든 자기이해 웰니스 콘텐츠예요. 예언·진단·치료를 대신하지 않아요.</p></div></div><small>4 고민 쓰기</small></div>

<div class="ph"><div class="scr night"><div class="stars"></div><p class="sub" style="font-family:'Gowun Batang',serif;font-size:15px;color:var(--gold-soft);line-height:1.7;margin-top:6px">이제 카드를 선택할 시간입니다.<br>가장 고민되는 부분을 생각하면서 골라주세요.</p><div class="stack"><i></i><i></i><i></i></div><p class="sub" style="margin-top:26px">카드가 잘 섞였습니다.<br>원하신다면 다시 섞으셔도 돼요.</p><div class="push"><div class="btn fill">지금 뽑을게요</div><div class="btn line">다시 섞을게요</div></div></div><small>5 셔플</small></div>

<div class="ph"><div class="scr night" style="padding-left:16px;padding-right:16px"><div class="stars"></div><p class="sub" style="margin-top:0;font-size:13px">고민을 되새기면서 가장 마음이 가는<br>카드 3개를 뽑아주세요.</p><div class="slots"><div class="slot">{card(12)}<small>지금의 마음</small></div><div class="slot">{card(4)}<small>나를 붙잡는 것</small></div><div class="slot"><div>3</div><small>다음 한 걸음</small></div></div><p style="font-size:11px;margin-top:8px;color:var(--gold)">2 / 3</p><div class="deck"><div class="deckrow">{"".join(f'<i style="left:{6+i*21}px;transform:rotate({(i-4.5)*2}deg)"></i>' for i in range(10))}</div><div class="deckrow">{"".join(f'<i style="left:{6+i*21}px;transform:rotate({(i-4.5)*2}deg)"></i>' for i in range(10))}</div></div></div><small>6 뽑기 (실제 22장 = 11장 × 2줄)</small></div>

<div class="ph"><div class="scr night"><div class="stars"></div><div class="spark" style="margin-top:20px">✦ ✦ ✦</div><div class="three">{card(12)}{card(4)}{card(3)}</div><p class="sub" style="margin-top:26px;font-size:15px">카드를 다 뽑았어요.<br>이제 설명을 보러 가볼까요?</p><div class="push"><div class="btn fill">네, 좋습니다.</div></div></div><small>7 다 뽑음 (새벽 광채)</small></div>

<div class="ph"><div class="scr night"><div class="stars"></div><div class="emb"></div><p class="sub" style="font-size:15px">{nick}님의 타로 결과를<br>분석하고 있어요...</p><p style="font-size:12px;color:var(--gold);margin-top:8px">(3초 경과)</p></div><small>8 대기 (엠블럼 천천히 회전)</small></div>

<div class="ph"><div class="scr morning" id="resultScr"><p style="font-family:'Gowun Batang',serif;font-weight:700;font-size:17px;color:var(--card-line);margin-bottom:12px">{nick}님에게 온 세 장의 카드</p><div class="thumbs">{card(12)}<div style="flex:1">{card(4,"rev")}<p style="font-size:9px;text-align:center;margin-top:3px;color:var(--card-line)">지키는 자리 · 역방향</p></div>{card(3)}</div><p class="zhint">카드를 누르면 크게 볼 수 있어요</p><div class="sec"><h3>첫 번째 카드 · 지금의 마음</h3><p><b>바위 위의 쉼</b> — 물범<br>몸도 마음도 쉬고 싶다는 신호를 보내고 있어요…</p></div><div class="sec"><h3>두 번째 카드 · 나를 붙잡는 것</h3><p><b>지키는 자리</b> — 펭귄 <span style="font-size:10px;border:1px solid #E3C68E;border-radius:8px;padding:0 5px">역방향</span><br>지키려는 힘이 너무 단단해져 나를 가두고 있어요…</p></div><div class="sec blur"><h3 style="filter:none">세 번째 카드 · 다음 한 걸음 — 품어 주는 품</h3><p>남에게 건네는 다정한 말을 나에게도 건네 보세요…</p></div><div class="pay"><b>이어지는 이야기는 리포트에서 열려요</b>전체 리포트 1,900원<div class="btn fill">1,900원 결제하고 이어 읽기</div></div></div><small>9 결과 — 맨 위 카드 3장을 눌러 보세요 (확대·복귀 연출 실제 동작)</small></div>
</div>
<p class="note">카드 이미지는 시안이며 교체 예정입니다. 파일명(card-00-splash.webp …)만 유지하면 화면 코드는 그대로 씁니다. 카드명은 그림에 넣지 않고 하단 크림 띠(카드 높이 약 92% 위치)에 웹 글자로 얹습니다.</p>
__SCRIPT__
</body></html>"""
SCRIPT = r"""<script>
const FRIENDS = __FRIENDS__;
(function(){
  const box = document.getElementById('parade'); if (!box) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let bag = [], last = -1;
  function nextIndex(){                       // 섞은 주머니에서 하나씩 — 한 바퀴 돌기 전엔 같은 친구가 다시 나오지 않음
    if (!bag.length){ bag = FRIENDS.map((_,i)=>i).sort(()=>Math.random()-.5); if (bag[0]===last) bag.push(bag.shift()); }
    return last = bag.shift();
  }
  function show(){
    const f = FRIENDS[nextIndex()];
    const el = document.createElement('div'); el.className = 'friend';
    el.innerHTML = '<div class="bob"><img alt="'+f.name+' — '+f.card+'" src="'+f.src+'"></div><span>'+f.name+'</span>';
    box.appendChild(el);
    const W = box.clientWidth, w = 118, ltr = Math.random() < .5;
    const from = ltr ? -w-10 : W+10, to = ltr ? W+10 : -w-10;
    if (reduce){
      el.style.left = (W-w)/2+'px';
      el.animate([{opacity:0},{opacity:1,offset:.2},{opacity:1,offset:.8},{opacity:0}],{duration:3200}).onfinish=()=>el.remove();
    } else {
      el.animate([{transform:`translateX(${from}px)`},{transform:`translateX(${(W-w)/2}px)`,offset:.45},{transform:`translateX(${(W-w)/2+(ltr?8:-8)}px)`,offset:.6},{transform:`translateX(${to}px)`}],
        {duration:4200,easing:'ease-in-out'}).onfinish=()=>el.remove();
    }
  }
  show(); setInterval(show, 3000);
})();

// 결과 카드 확대 — 디자인 가이드 5-2. 카드가 제자리에서 들려 가운데로 날아오고(살짝 기울었다 자리 잡기), 닫으면 제자리로 돌아감
(function(){
  const scr = document.getElementById('resultScr'); if (!scr) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dim = document.createElement('div'); dim.className = 'zdim'; scr.appendChild(dim);
  const cap = document.createElement('p'); cap.className = 'zcap'; scr.appendChild(cap);
  const P = 'perspective(900px) ';
  let open = null, busy = false;
  scr.querySelectorAll('.thumbs .front').forEach((f) => {
    f.tabIndex = 0; f.setAttribute('role', 'button'); f.setAttribute('aria-label', f.querySelector('img').alt + ' 크게 보기');
    f.addEventListener('click', () => zoom(f));
    f.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zoom(f); } });
  });
  function zoom(f){
    if (open || busy) return; busy = true;
    const sr = scr.getBoundingClientRect(), r = f.getBoundingClientRect();
    const W = sr.width * 0.68, H = W * r.height / r.width;
    const tx = (sr.width - W) / 2, ty = (sr.height - H) / 2 - 18;
    const clone = f.cloneNode(true); clone.classList.add('zclone'); clone.removeAttribute('tabindex');
    clone.style.cssText = `left:${tx}px;top:${ty}px;width:${W}px`;
    scr.appendChild(clone);
    const s = r.width / W, dx = r.left - sr.left - scr.clientLeft - tx, dy = r.top - sr.top - scr.clientTop - ty;
    const from = `${P}translate(${dx}px,${dy}px) scale(${s})`;
    f.style.visibility = 'hidden';
    const frames = reduce
      ? [{ opacity: 0, transform: 'none' }, { opacity: 1, transform: 'none' }]
      : [{ transform: from },
         { transform: `${P}translate(${dx*.45}px,${dy*.45 - 28}px) scale(${(s+1)/2}) rotateY(-16deg) rotate(-4deg)`, offset: .5 },
         { transform: `${P}scale(1.04) rotateY(5deg) rotate(1.2deg)`, offset: .82 },
         { transform: `${P}scale(1) rotateY(0) rotate(0)` }];
    clone.animate(frames, { duration: reduce ? 200 : 460, easing: 'cubic-bezier(.22,.8,.24,1)', fill: 'both' }).onfinish = () => { busy = false; };
    dim.classList.add('on');
    cap.textContent = (f.querySelector('img').alt.split(' — ')[0]) + (f.classList.contains('rev') ? ' · 역방향' : '') + '   ·   다시 누르면 돌아가요';
    cap.classList.add('on');
    open = { f, clone, from };
    clone.addEventListener('click', close); dim.onclick = close;
  }
  function close(){
    if (!open || busy) return; busy = true;
    const { f, clone, from } = open;
    dim.classList.remove('on'); cap.classList.remove('on');
    const frames = reduce
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [{ transform: `${P}scale(1)` },
         { transform: `${P}scale(1.05) rotateY(8deg) rotate(2deg)`, offset: .25 },
         { transform: from }];
    clone.animate(frames, { duration: reduce ? 180 : 400, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'both' }).onfinish = () => {
      f.style.visibility = ''; clone.remove(); open = null; busy = false; f.focus({ preventScroll: true });
    };
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();
</script>"""
html = html.replace("__SCRIPT__", SCRIPT)
html = html.replace("__FRIENDS__", json.dumps(FRIENDS, ensure_ascii=False))
open(f"{OUT}/06_디자인/design-preview.html", "w", encoding="utf-8").write(html)
print(len(html)//1024, "KB")
