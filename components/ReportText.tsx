import { clean } from "@/lib/client/text";
import type { ResultCard } from "@/lib/client/api";
import { CardFace } from "./Cards";

// 서버가 패키지 원본 조립 코드(buildFreeSections)로 만든 섹션 텍스트를 화면 요소로 바꾼다.
// 텍스트 규칙: "### n. 제목" = 섹션 제목 / "• " = 항목 / 빈 줄 = 문단 구분 / 정해진 소제목 줄 = 소제목.
// "[카드 이미지 3장: …]" 줄은 텍스트 결과용 표시라 화면에서는 빼고, 맨 위 카드 사진(CardZoom)이 그 역할을 한다.

const FIXED_SUBHEADINGS = new Set(["세 장 한눈에 보기", "어떤 카드인가요", "조금 더 들여다보기", "내 고민에 대어 보면"]);

export function ReportText({ text, subheadings, card }: { text: string; subheadings: string[]; card?: ResultCard }) {
  const heads = new Set([...FIXED_SUBHEADINGS, ...subheadings]);
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  let cardLineDone = !card;
  const flush = () => {
    if (!bullets.length) return;
    const items = bullets;
    blocks.push(
      <ul key={`ul${blocks.length}`} className="flex flex-col gap-2">
        {items.map((b, i) => (
          <li key={i} className="flex gap-2 text-[16px] leading-relaxed">
            <span aria-hidden className="text-gold">✦</span>
            <span>{clean(b)}</span>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("[카드 이미지")) continue;
    if (line.startsWith("### ")) {
      flush();
      blocks.push(
        <h2 key={`h${blocks.length}`} className="font-serif text-[20px] font-bold leading-snug text-card-line">
          {line.slice(4)}
        </h2>,
      );
      continue;
    }
    if (line.startsWith("• ")) {
      bullets.push(line.slice(2));
      continue;
    }
    flush();
    if (!cardLineDone && card) {
      // 카드 섹션의 첫 줄 "카드명 — 캐릭터 (역방향)": 작은 카드 그림과 함께
      cardLineDone = true;
      blocks.push(
        <div key={`c${blocks.length}`} className="flex items-center gap-3">
          <div className="w-14 shrink-0">
            <CardFace image={card.image} name={card.name} character={card.character} reversed={card.reversed} className="w-full" />
          </div>
          <p className="font-serif text-[18px] font-bold text-card-line">{line}</p>
        </div>,
      );
      continue;
    }
    if (heads.has(line)) {
      blocks.push(
        <h3 key={`s${blocks.length}`} className="mt-2 flex items-center gap-2 text-[15px] font-bold text-card-line">
          <span aria-hidden className="text-gold">✦</span>
          {line}
        </h3>,
      );
      continue;
    }
    blocks.push(
      <p key={`p${blocks.length}`} className="text-[16px] leading-relaxed">
        {clean(line)}
      </p>,
    );
  }
  flush();
  return <div className="flex flex-col gap-3">{blocks}</div>;
}
