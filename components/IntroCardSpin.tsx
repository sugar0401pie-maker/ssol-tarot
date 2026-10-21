"use client";

import { useEffect, useRef, useState } from "react";
import { nextFromBag } from "@/lib/client/bag";
import { cardImg } from "@/lib/client/cardImage";
export type Friend = { name: string; character: string; image: string };

// 인트로 카드 연출(owner 2026-10-20 — 디자인 가이드 5-1 '바다 친구들 지나가기' 대신):
// 처음에 한 더미로 겹쳐 있던 카드 뒷면들이 부채꼴로 '촤라락' 펼쳐지고, 그다음부터 한 장씩 차례로 앞으로 나와
// 크게 돌며 앞면을 보여 준 뒤 다시 제자리로 돌아간다. 앞면은 섞은 주머니에서 하나씩(22장을 다 돌기 전엔 같은 카드 없음).
// 화면 연출이라 Math.random으로 충분. 움직임 줄이기면 펼친 부채만 보이고 돌지 않는다(globals.css).
const FAN = 7; // 부채에 보이는 카드 수
const STEP_MS = 3200; // 한 장이 나와서 돌아가기까지
const ORDER = [3, 4, 2, 5, 1, 6, 0]; // 가운데부터 바깥으로 번갈아 — 부채 전체에서 고르게 나오게
const SIZES = "(max-width: 400px) 50vw, 200px";
const BACK = cardImg("/images/tarot/card-back.webp", "130px");

export function IntroCardSpin({ cards }: { cards: Friend[] }) {
  const bag = useRef<number[]>([]);
  const last = useRef<number | null>(null);
  const [spread, setSpread] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [front, setFront] = useState<number[]>(() => Array(FAN).fill(0));

  useEffect(() => {
    if (!cards.length) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = () => {
      const r = nextFromBag(bag.current, cards.length, last.current);
      bag.current = r.bag;
      last.current = r.pick;
      return r.pick;
    };
    const preload = (i: number) => {
      const p = cardImg(cards[i].image, SIZES);
      const img = new window.Image();
      img.sizes = p.sizes ?? "";
      if (p.srcSet) img.srcset = p.srcSet;
      img.src = p.src ?? "";
    };
    let n = -1;
    let upcoming = draw();
    preload(upcoming);
    const t0 = setTimeout(() => setSpread(true), 150); // 펼치기
    if (reduce) return () => clearTimeout(t0);
    const step = () => {
      n = (n + 1) % FAN;
      const s = ORDER[n];
      const pick = upcoming;
      setFront((f) => f.map((v, i) => (i === s ? pick : v)));
      setActive(s);
      upcoming = draw();
      preload(upcoming);
    };
    let t2: ReturnType<typeof setInterval> | undefined;
    const t1 = setTimeout(() => {
      step();
      t2 = setInterval(step, STEP_MS);
    }, 1400);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      if (t2) clearInterval(t2);
    };
  }, [cards]);

  if (!cards.length) return null;
  return (
    <div className={`intro-fan ${spread ? "is-spread" : ""}`} aria-hidden>
      {Array.from({ length: FAN }, (_, i) => {
        const on = active === i;
        return (
          <div
            key={i}
            className={`intro-fan-card ${on ? "is-on" : ""}`}
            style={{ "--a": `${(i - (FAN - 1) / 2) * 11}deg`, "--d": `${i * 50}ms`, zIndex: on ? 20 : i } as React.CSSProperties}
          >
            <div className="intro-fan-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img {...BACK} alt="" className="intro-fan-face" draggable={false} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img {...cardImg(cards[front[i]].image, SIZES)} alt="" className="intro-fan-face intro-fan-front" draggable={false} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
