"use client";

import { useEffect, useRef, useState } from "react";
import type { ResultCard } from "@/lib/client/api";
import { CardCaption, CardFace } from "./Cards";

// 결과 맨 위 카드 3장 사진 + 확대 연출(디자인 가이드 5-2).
// 열기 0.46초: 썸네일 자리에서 출발 → 살짝 들리며 기울기 → 가운데에서 한 번 넘쳤다가 자리 잡기.
// 닫기 0.4초: 반대로 살짝 기울었다가 원래 자리로. 움직이는 동안 다른 입력 무시. 움직임 줄이기면 페이드만.
export function CardZoom({ cards, hint }: { cards: ResultCard[]; hint: string }) {
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);

  const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 썸네일 위치 → 가운데 확대 위치로 가는 변환값
  function deltas(i: number) {
    const t = thumbs.current[i]!.getBoundingClientRect();
    const w = Math.min(window.innerWidth * 0.68, 420);
    const h = w * 1.5;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.46;
    const scale = t.width / w;
    const dx = t.left + t.width / 2 - cx;
    const dy = t.top + t.height / 2 - cy;
    return { w, h, cx, cy, scale, dx, dy };
  }

  useEffect(() => {
    if (open === null || !cardRef.current) return;
    const el = cardRef.current;
    const dim = dimRef.current;
    setAnimating(true);
    let anim: Animation;
    if (reduced()) {
      anim = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: "both" });
    } else {
      const { dx, dy, scale } = deltas(open);
      anim = el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
          { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 30}px) scale(${(scale + 1) / 2}) rotateY(-16deg) rotate(-4deg)`, offset: 0.5 },
          { transform: "translate(0,0) scale(1.04) rotateY(5deg)", offset: 0.82 },
          { transform: "translate(0,0) scale(1)" },
        ],
        { duration: 460, easing: "cubic-bezier(.22,.8,.24,1)", fill: "both" },
      );
    }
    dim?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, fill: "both" });
    anim.onfinish = () => setAnimating(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    if (open === null || animating || !cardRef.current) return;
    const i = open;
    const el = cardRef.current;
    setAnimating(true);
    let anim: Animation;
    if (reduced()) {
      anim = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "both" });
    } else {
      const { dx, dy, scale } = deltas(i);
      anim = el.animate(
        [
          { transform: "translate(0,0) scale(1)" },
          { transform: "translate(0,0) scale(1.02) rotateY(8deg) rotate(2deg)", offset: 0.25 },
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
        ],
        { duration: 400, easing: "cubic-bezier(.5,0,.3,1)", fill: "both" },
      );
    }
    dimRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: "both" });
    anim.onfinish = () => {
      setOpen(null);
      setAnimating(false);
      thumbs.current[i]?.focus(); // 닫으면 원래 썸네일로 포커스 복귀
    };
  }

  const c = open !== null ? cards[open] : null;
  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {cards.map((card, i) => (
          <div key={card.id} className="flex flex-col items-center gap-1">
            <span className="text-[12px] font-medium text-card-line">{card.positionName}</span>
            <button
              ref={(el) => {
                thumbs.current[i] = el;
              }}
              type="button"
              aria-label={`${card.name} — ${card.character}${card.reversed ? " (역방향)" : ""} 크게 보기`}
              className="w-full rounded-[6%] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
              style={{ visibility: open === i ? "hidden" : "visible" }}
              onClick={() => !animating && setOpen(i)}
            >
              <CardFace image={card.image} name={card.name} character={card.character} reversed={card.reversed} className="w-full" />
            </button>
            <CardCaption name={card.name} reversed={card.reversed} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[13px] text-ink/60">{hint}</p>

      {c && open !== null && (
        <div className="fixed inset-0 z-50" onClick={close} role="dialog" aria-label={`${c.name} 크게 보기`}>
          <div ref={dimRef} className="absolute inset-0 bg-night-deep/70" />
          <div
            className="absolute flex flex-col items-center"
            style={{ left: "50%", top: "46%", width: "min(68vw, 420px)", transform: "translate(-50%, -50%)", perspective: 900 }}
          >
            <div ref={cardRef} className="w-full rounded-[6%] shadow-[0_18px_40px_rgba(0,0,0,0.6)]" style={{ transformOrigin: "center" }}>
              <CardFace image={c.image} name={c.name} character={c.character} reversed={c.reversed} className="w-full" />
            </div>
            <p className="mt-4 rounded-full bg-night px-3 py-1 font-serif text-[13px] text-moon">
              {c.name}
              {c.reversed ? " · 역방향" : ""} · 다시 누르면 돌아가요
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
