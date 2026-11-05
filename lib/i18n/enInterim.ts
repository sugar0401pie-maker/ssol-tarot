// 영문판 임시 문구 — 영어 데이터(data/en, 기획 v1.2)에 아직 없는 화면 문구만 채운다(데이터에 키가 생기면 데이터가 이긴다).
// 2026-11-05 개발(Claude) 초안: 기획에 보낸 '쏠타로_영문판_번역보충요청_v1.xlsx'의 '빠진 문구'가 돌아오면 데이터로 들어가고
// 여기 값은 쓰이지 않는다. 출시 전 이 파일에 남은 키가 없게 하는 것이 목표(테스트가 남은 키 수를 알려 줌).
/* eslint-disable @typescript-eslint/no-explicit-any */
export const EN_INTERIM_COPY: Record<string, any> = {
  intro: {
    title: "SSOL Tarot House",
    sub: "Today's heart cards from your friends of the sea",
    login: "Sign in",
    button_results: "My past readings",
  },
  welcome: {
    guest_limit: "You've used today's readings without an account. Sign in to keep going.",
    guest_limit_login: "Sign in and keep going",
  },
  shuffle: {
    error_retry: "The connection dropped for a moment. Shuffle again",
    messages: [
      "Shuffling the cards…",
      "Placing your question into the cards, {nickname}…",
      "The cards are moving like waves…",
      "Getting ready for you to pick the cards that call to you…",
    ],
  },
  loading: {
    long_wait: "Just a little longer, {nickname}. Your reading is almost ready.",
    messages: [
      "Reading your cards…",
      "Thinking about your question, {nickname}…",
      "Your three cards are talking to each other…",
      "Seeing which way the waves in your cards are flowing…",
      "Your friends of the sea are laying out your cards, {nickname}…",
      "Picking wellness practices that fit you, {nickname}…",
    ],
  },
  result: {
    paywall_title_decision: "The side your three cards chose is in the full report",
    paywall_body_decision: "Read on to see why, and what to start with this week.\nYour suggestions and this week's practice cards open too.",
    v4: {
      teaser7_pace: "The cards say {pace}. Here's why.",
      pace_phrases: { near: "this worry will be resolved", step: "you have a real chance", slow: "it can work out, even if it takes time" },
    },
    login_nudge_chat: "Sign in to keep talking with Sowella. Your reading will be saved to your account.",
    login_nudge_save: "Sign in and this reading will be saved to your account.",
    saved_auto: "We saved this reading to your account.",
    secret3: {
      intro: "Here's your tarot reading, {nickname}. The first card shows The Road So Far, the second The Current Now, and the third The Key Ahead. This reading looks at about the next six months. First, let's see what each card is.",
      worry_title: "Looking into your question, {nickname}",
      two_title: "What the first two cards showed",
      change_leads: [
        "At the same time, the cards say change is coming.",
        "At the same time, the cards say things are likely to shift from here.",
        "Even so, the cards say this flow will slowly start to change.",
      ],
      same: "But the answer isn't settled yet. The third card is The Key Ahead. It shows how this worry unfolds over the next six months, and it weighs as much as the first two cards together. Whether it's {options} is in this card.",
      split: "The two cards point different ways. The third card, The Key Ahead, carries the most weight and decides which way it leans.",
      general: "The third card is The Key Ahead. It shows how this worry unfolds over the next six months. What it has to say opens with this card.",
      next_button: "See the third card",
      p4_title: "Third card · The Key Ahead",
      p4_options: "Your next six months, {nickname}, and the answer to {options} are in this card.",
      p4_general: "Your next six months, {nickname}, are in this card.",
      pick_note: "The third card opens in your reading",
      hidden_alt: "Third card (opens after payment)",
    },
  },
  share_card: {
    kakao_title: "My Key Ahead is ‘{card}’",
    kakao_desc_decision: "Which side did the three cards choose?\nThink of your question and draw three cards too.",
    kakao_desc: "A wellness tarot that reflects your worry.\nDraw three cards too.",
    sheet_title: "Share your reading",
  },
  safety: {
    urgent_emergency: "If you're in danger right now, call your local emergency number.",
  },
};

/** a에 없는 키만 b로 채운다(배열·문자열은 a에 있으면 a 그대로). */
export function fillMissing<T>(a: T, b: any): T {
  if (b === undefined) return a;
  if (a === undefined || a === null) return b as T;
  if (Array.isArray(a) || typeof a !== "object" || typeof b !== "object" || Array.isArray(b)) return a;
  const out: any = { ...(a as any) };
  for (const k of Object.keys(b)) out[k] = fillMissing(out[k], b[k]);
  return out;
}

/** 데이터에 아직 없어서 임시 문구로 채워지는 키 경로(출시 전 0이 되어야 함). */
export function interimKeysUsed(copy: any, b: any = EN_INTERIM_COPY, prefix = "copy"): string[] {
  const out: string[] = [];
  for (const k of Object.keys(b)) {
    const p = `${prefix}.${k}`;
    if (copy?.[k] === undefined) out.push(p);
    else if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k])) out.push(...interimKeysUsed(copy[k], b[k], p));
  }
  return out;
}
