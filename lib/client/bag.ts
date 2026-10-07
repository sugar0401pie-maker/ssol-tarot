// 인트로 친구 순서: 섞은 주머니에서 하나씩. 한 바퀴를 다 돌기 전엔 같은 친구가 다시 나오지 않고,
// 새 바퀴의 첫 친구가 바로 앞 친구와 같으면 둘째와 자리를 바꾼다(디자인 가이드 5-1).
export function nextFromBag(bag: number[], size: number, last: number | null, rand: () => number = Math.random): { pick: number; bag: number[] } {
  let b = bag.length ? bag : shuffled(size, rand);
  if (!bag.length && b[0] === last && b.length > 1) b = [b[1], b[0], ...b.slice(2)];
  return { pick: b[0], bag: b.slice(1) };
}

function shuffled(n: number, rand: () => number) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
