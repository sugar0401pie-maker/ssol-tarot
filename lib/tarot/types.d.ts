// 패키지 원본 JS(lib/tarot/*.js)를 TypeScript에서 부를 때 쓰는 느슨한 타입 선언.
// 원본 로직은 바꾸지 않고, 호출 모양만 알려 준다(데이터는 tarot_data.json 구조 그대로 → any).
/* eslint-disable @typescript-eslint/no-explicit-any */
export type TarotData = any;
export type Safety = { level: "none" | "watch" | "urgent"; violence: boolean; matched?: string[] };
export type ExpandedPick = { card: any; reversed: boolean; position: string; positionName: string };
export type LinkItem = { line: string; asks: string[] };
export type Links = Record<string, LinkItem>;
