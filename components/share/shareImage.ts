// 공유 이미지(owner 2026-10-21, 쏠 아스트로 하우스 공유 이미지와 같은 구성): 위에 세 번째 카드(앞으로의 열쇠) 그림,
// 아래 밤색 띠에 카드 이름(금색) · '내 앞으로의 열쇠' · 사이트 주소. 고민·닉네임·해석 문장은 넣지 않는다(copy.share_card.rule).
// 글자는 페이지와 같은 글꼴로 캔버스에 직접 쓴다. 카드 그림은 같은 사이트 파일이라 캔버스가 오염되지 않는다(toBlob 가능).
export const SHARE_W = 1080;
export const SHARE_H = 1440;
const PANEL = 300; // 아래 글자 띠 높이

function family(serif: boolean): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(serif ? "--font-gowun-batang" : "--font-noto-sans-kr").trim();
  return v ? `${v}, sans-serif` : serif ? "serif" : "sans-serif";
}

export async function composeShareImage(cardSrc: string, reversed: boolean, t: { name: string; line: string; foot: string }): Promise<Blob | null> {
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("그림 불러오기 실패"));
      img.src = cardSrc;
    });
    const canvas = document.createElement("canvas");
    canvas.width = SHARE_W;
    canvas.height = SHARE_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // 배경: 밤바다(디자인 가이드 --night → --night-deep) + 카드 뒤 새벽빛
    const bg = ctx.createLinearGradient(0, 0, 0, SHARE_H);
    bg.addColorStop(0, "#012f53");
    bg.addColorStop(1, "#001e38");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SHARE_W, SHARE_H);
    const top = SHARE_H - PANEL;
    const glow = ctx.createRadialGradient(SHARE_W / 2, top / 2, 40, SHARE_W / 2, top / 2, 560);
    glow.addColorStop(0, "rgba(250,228,205,0.35)");
    glow.addColorStop(1, "rgba(250,228,205,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, SHARE_W, top);
    // 카드(2:3) — 위 영역 가운데, 역방향이면 180도
    const h = top - 120;
    const w = (h * 2) / 3;
    ctx.save();
    ctx.translate(SHARE_W / 2, top / 2 + 10);
    if (reversed) ctx.rotate(Math.PI);
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 40;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    // 아래 띠
    ctx.fillStyle = "#001e38";
    ctx.fillRect(0, top, SHARE_W, PANEL);
    ctx.strokeStyle = "rgba(227,198,142,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, top);
    ctx.lineTo(SHARE_W - 80, top);
    ctx.stroke();
    const serif = family(true);
    const sans = family(false);
    await Promise.all([
      document.fonts?.load(`700 72px ${serif}`, t.name).catch(() => []),
      document.fonts?.load(`400 38px ${sans}`, t.line + t.foot).catch(() => []),
    ]);
    ctx.textAlign = "center";
    ctx.fillStyle = "#e3c68e";
    ctx.font = `700 72px ${serif}`;
    ctx.fillText(t.name, SHARE_W / 2, top + 110);
    ctx.fillStyle = "#fcefd4";
    ctx.font = `400 38px ${sans}`;
    ctx.fillText(t.line, SHARE_W / 2, top + 175);
    ctx.globalAlpha = 0.6;
    ctx.font = `400 26px ${sans}`;
    ctx.fillText(t.foot, SHARE_W / 2, top + 250);
    ctx.globalAlpha = 1;
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  } catch {
    return null;
  }
}
