"use client";

import { useEffect, useRef, useState } from "react";
import { nextFromBag } from "@/lib/client/bag";

// 인트로 바다 친구들 지나가기(디자인 가이드 5-1).
// 21종을 섞은 주머니에서 하나씩 꺼내 한 바퀴를 다 돌기 전엔 다시 나오지 않고, 바퀴가 바뀔 때도 바로 앞 친구와 겹치지 않는다.
// 화면 연출이라 Math.random으로 충분. 3초마다 다음 친구 출발(한 친구는 약 4.2초에 가로지름) → 화면이 비지 않는다.
// 최종 에셋(관계성 테스트 캐릭터 투명 PNG)이 오기 전까지는 카드 그림의 캐릭터 부분을 원형으로 잘라 쓴다(시안 방식).
export type Friend = { name: string; character: string; image: string };

type Swimmer = { key: number; friend: Friend; dir: "ltr" | "rtl" };

export function IntroFriends({ friends }: { friends: Friend[] }) {
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const bag = useRef<number[]>([]);
  const last = useRef<number | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!friends.length) return;
    // 첫 화면 진입 때 미리 불러오기
    friends.forEach((f) => {
      const img = new Image();
      img.src = f.image;
    });
    const launch = () => {
      const r = nextFromBag(bag.current, friends.length, last.current);
      bag.current = r.bag;
      last.current = r.pick;
      const s: Swimmer = { key: seq.current++, friend: friends[r.pick], dir: Math.random() < 0.5 ? "ltr" : "rtl" };
      setSwimmers((list) => [...list.slice(-1), s]); // 한 번에 1~2명만
    };
    launch();
    const t = setInterval(launch, 3000);
    return () => clearInterval(t);
  }, [friends]);

  return (
    <div className="relative my-6 h-56 w-full" aria-hidden>
      {/* 수평선 */}
      <div className="absolute inset-x-0 top-[62%] h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
      {swimmers.map((s) => (
        <div key={s.key} className={`absolute left-1/2 top-4 -ml-[60px] w-[120px] ${s.dir === "ltr" ? "swim-ltr" : "swim-rtl"}`}>
          <div className="bob flex flex-col items-center gap-2">
            <div
              className="h-[120px] w-[120px] rounded-full border-2 border-gold bg-cover shadow-[0_0_24px_rgba(227,198,142,0.45)]"
              style={{ backgroundImage: `url(${s.friend.image})`, backgroundPosition: "50% 38%", backgroundSize: "170%" }}
            />
            <span className="font-serif text-[13px] text-gold-soft">{s.friend.character}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
