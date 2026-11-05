// 영문판 위기·폭력 안내 연락처(2026-11-05 개발 초안 — **출시 전 기획·임상 전문가가 번호를 확인해야 함**).
// 영어 데이터 문구의 자리 표시({crisis_line}·{crisis_text}·{emergency}·{dv_line}·{youth_line})를 접속 국가로 채운다.
// 국가를 모르거나 표에 없으면 국제 안내(findahelpline.com — 나라별 무료 상담 전화 목록)와 "지역 응급 번호"로 —
// 번호가 빠져 아무것도 안 보이는 일이 없게(fail safe).
export type Helplines = { crisis_line: string; crisis_text: string; emergency: string; dv_line: string; youth_line: string };

const INTL: Helplines = {
  crisis_line: "a free helpline listed at findahelpline.com",
  crisis_text: "a text or chat line at findahelpline.com",
  emergency: "your local emergency number",
  dv_line: "a local domestic abuse helpline (findahelpline.com)",
  youth_line: "a youth line at findahelpline.com",
};

const BY_COUNTRY: Record<string, Partial<Helplines>> = {
  US: { crisis_line: "988 (Suicide & Crisis Lifeline, call or text)", crisis_text: "text 988", emergency: "911", dv_line: "the National Domestic Violence Hotline, 1-800-799-7233", youth_line: "988" },
  CA: { crisis_line: "988 (call or text)", crisis_text: "text 988", emergency: "911", dv_line: "a local shelter or 911", youth_line: "Kids Help Phone, 1-800-668-6868 (text 686868)" },
  GB: { crisis_line: "Samaritans, 116 123", crisis_text: "text SHOUT to 85258", emergency: "999", dv_line: "the National Domestic Abuse Helpline, 0808 2000 247", youth_line: "Childline, 0800 1111" },
  IE: { crisis_line: "Samaritans, 116 123", crisis_text: "text HELLO to 50808", emergency: "112 or 999", dv_line: "Women's Aid, 1800 341 900", youth_line: "Childline, 1800 66 66 66" },
  AU: { crisis_line: "Lifeline, 13 11 14", crisis_text: "text Lifeline on 0477 13 11 14", emergency: "000", dv_line: "1800RESPECT, 1800 737 732", youth_line: "Kids Helpline, 1800 55 1800" },
  NZ: { crisis_line: "1737 (call or text)", crisis_text: "text 1737", emergency: "111", dv_line: "Women's Refuge, 0800 733 843", youth_line: "Youthline, 0800 376 633" },
  IN: { crisis_line: "Tele-MANAS, 14416", crisis_text: "Tele-MANAS, 14416", emergency: "112", dv_line: "the Women Helpline, 181", youth_line: "Childline, 1098" },
  SG: { crisis_line: "SOS, 1767", crisis_text: "SOS CareText via sos.org.sg", emergency: "995", dv_line: "the National Anti-Violence Helpline, 1800 777 0000", youth_line: "Tinkle Friend, 1800 274 4788" },
  FR: { crisis_line: "3114", crisis_text: "3114", emergency: "112", dv_line: "3919", youth_line: "119" },
  AE: { crisis_line: "800 4673 (800 HOPE)", crisis_text: "800 4673", emergency: "999", dv_line: "the Dubai Foundation for Women and Children, 800 111", youth_line: "800 4673" },
  DE: { crisis_line: "TelefonSeelsorge, 0800 111 0 111", crisis_text: "online chat at telefonseelsorge.de", emergency: "112", dv_line: "Hilfetelefon, 116 016", youth_line: "Nummer gegen Kummer, 116 111" },
};

export function helplinesFor(country: string | null | undefined): Helplines {
  const c = String(country || "").toUpperCase();
  return { ...INTL, ...(BY_COUNTRY[c] ?? {}) };
}

/** 문구 속 {crisis_line} 같은 자리를 채운다. 다른 자리({nickname} 등)는 그대로 둔다. */
export function fillHelplines(text: string, h: Helplines): string {
  return text.replace(/\{(crisis_line|crisis_text|emergency|dv_line|youth_line)\}/g, (_m, k: keyof Helplines) => h[k]);
}

/** 전화로 걸 수 있는 번호(tel:)를 고른다 — 문구에 숫자가 있으면 첫 번호, 없으면 null(전화 버튼 대신 글만). */
export function telOf(label: string): string | null {
  const m = label.match(/(\+?\d[\d\s-]{1,14}\d)/);
  return m ? m[1].replace(/[\s-]/g, "") : null;
}
