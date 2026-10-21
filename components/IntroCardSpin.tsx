"use client";

import { useEffect, useRef, useState } from "react";
import { nextFromBag } from "@/lib/client/bag";
import { cardImg } from "@/lib/client/cardImage";
export type Friend = { name: string; character: string; image: string };

// 인트로 제목 위에서 계속 빙글 도는 타로 카드(owner 2026-10-20 — 디자인 가이드 5-1 '바다 친구들 지나가기' 대신).
// 한 바퀴(4.4초)마다 뒷면 → 앞면 → 뒷면. 뒷면이 보이는 동안 다음 앞면으로 바꿔서, 돌 때마다 다른 카드가 나온다
// (섞은 주머니에서 하나씩 — 22장을 다 돌기 전엔 같은 카드가 다시 나오지 않음). 화면 연출이라 Math.random으로 충분.
// 움직임 줄이기(prefers-reduced-motion)면 돌지 않고 뒷면만 보인다(globals.css).
const SIZES = "150px";
const BACK = cardImg("/images/tarot/card-back.webp", SIZES);

export function IntroCardSpin({ cards }: { cards: Friend[] }) {
  const bag = useRef<number[]>([]);
  const last = useRef<number | null>(null);
  const draw = () => {
    const r = nextFromBag(bag.current, cards.length, last.current);
    bag.current = r.bag;
    last.current = r.pick;
    return r.pick;
  };
  const [front, setFront] = useState(0);
  const upcoming = useRef<number | null>(null);

  useEffect(() => {
    if (!cards.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저에서만 무작위로 첫 카드를 고름(서버 화면과 어긋나지 않게)
    setFront(draw());
    upcoming.current = draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

  // 한 바퀴가 끝날 때(뒷면이 보이는 순간) 다음 카드로 바꾸고, 그다음 카드는 미리 받아 둔다
  function onIteration() {
    if (upcoming.current === null) return;
    setFront(upcoming.current);
    upcoming.current = draw();
    const img = new window.Image();
    const next = cardImg(cards[upcoming.current].image, SIZES);
    img.sizes = next.sizes ?? "";
    if (next.srcSet) img.srcset = next.srcSet;
    img.src = next.src ?? "";
  }

  if (!cards.length) return null;
  const f = cards[front];
  return (
    <div className="intro-spin-scene" aria-hidden>
      <div className="intro-spin" onAnimationIteration={onIteration}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...BACK} alt="" className="intro-spin-face" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...cardImg(f.image, SIZES)} alt="" className="intro-spin-face intro-spin-front" draggable={false} />
      </div>
    </div>
  );
}
