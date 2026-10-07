// 데이터 문구에 남아 있는 내부 메모("[확인필요: …]")는 사용자 화면에 보이지 않게 지운다.
// 메모 자체는 data/tarot_data.json에 그대로 둔다(출시 전 확인 목록).
export function clean(text: string): string {
  return text.replace(/\s*\[확인필요[^\]]*\]/g, "").trim();
}

export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
