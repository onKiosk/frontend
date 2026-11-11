import {
  ALIASES,
  CATEGORIES,
  MENU_ITEMS,
  PAY_METHODS,
  findMenuItem,
  type CategoryKey,
  type ExtraKey,
  type MenuItem,
  type ModeKey,
  type PayKey,
} from "@/data/menu";
import { extrasFor, type OptionDraft } from "@/lib/pricing";

/** 긴 이름부터 맞춰야 "카페라떼"가 "라떼"에 먹히지 않는다. */
const BY_LENGTH = [...MENU_ITEMS].sort((a, b) => b.name.length - a.name.length);

const squashName = (s: string) => s.replace(/\s/g, "");

/** 공백 제거된 발화에서 메뉴 하나를 찾는다. */
export function matchItem(said: string): MenuItem | null {
  for (const item of BY_LENGTH) {
    if (said.includes(squashName(item.name))) return item;
  }
  for (const [alias, name] of ALIASES) {
    if (said.includes(alias)) return findMenuItem(name) ?? null;
  }
  return null;
}

export function matchCategory(said: string): CategoryKey | null {
  return CATEGORIES.find((c) => said.includes(c.label))?.key ?? null;
}

export function matchMode(said: string): ModeKey | null {
  if (/고대비|큰글씨/.test(said)) return "contrast";
  if (/하단|낮게|휠체어|저신장/.test(said)) return "low";
  if (/음성모드|말로만/.test(said)) return "voice";
  if (/기본모드/.test(said)) return "basic";
  return null;
}

export function matchPay(said: string): PayKey | null {
  // “카드 말고 카카오페이”는 정정한 수단을 사용한다.
  said = said.split(/말고|아니고|대신/).at(-1)!;
  if (
    /(?:카드|삼성페이|카카오페이|네이버페이|애플페이|현금)(?:로|으로)?(?:는)?(?:결제)?(?:안할|안해|하지않|취소)/.test(
      said,
    )
  )
    return null;
  if (/삼성/.test(said)) return "samsung";
  if (/카카오/.test(said)) return "kakao";
  if (/네이버/.test(said)) return "naver";
  if (/애플/.test(said)) return "apple";
  if (/현금/.test(said)) return "cash";
  if (/카드/.test(said)) return "card";
  return null;
}

export const payLabel = (key: PayKey) =>
  PAY_METHODS.find((p) => p.key === key)!.label;

/** "두 잔" → 2 */
export function parseQty(said: string) {
  return matchQty(said) ?? 1;
}

function matchQty(said: string): number | null {
  const numeric = said.match(/(?:^|\D)([1-9])(?:잔|개)/);
  if (numeric) return Number(numeric[1]);
  const words = [
    "한",
    "두",
    "세",
    "네",
    "다섯",
    "여섯",
    "일곱",
    "여덟",
    "아홉",
  ];
  const index = words.findIndex(
    (word) => said.includes(`${word}잔`) || said.includes(`${word}개`),
  );
  if (index >= 0) return index + 1;
  const standalone = said.match(/하나|둘|셋|넷/);
  return standalone
    ? ["하나", "둘", "셋", "넷"].indexOf(standalone[0]) + 1
    : null;
}

const EXTRA_PATTERNS: [ExtraKey, RegExp][] = [
  ["shot", /샷/],
  ["syrup", /시럽/],
  ["light", /연하/],
  ["milk", /우유|오트/],
];

/**
 * 발화에서 읽어낸 옵션을 draft에 반영한 새 draft와, 반영된 항목 수를 돌려준다.
 * 항목 수가 0이면 "옵션에 관한 말이 아니었다"는 뜻.
 */
export function applyOptionSpeech(
  draft: OptionDraft,
  said: string,
): { draft: OptionDraft; hits: number } {
  const item = draft.item;
  const next: OptionDraft = { ...draft, extras: { ...draft.extras } };
  let hits = 0;
  const qty = matchQty(said);
  if (qty !== null) {
    next.qty = qty;
    hits++;
  }
  if (item.dessert) return { draft: next, hits };

  if (!item.iceOnly && /따뜻|뜨겁|뜨거|핫|hot/i.test(said)) {
    next.temp = "hot";
    hits++;
  }
  if (/차갑|차가|아이스|ice|시원|아아/i.test(said)) {
    next.temp = "ice";
    hits++;
  }
  if (/라지|큰거|큰걸|큰사이즈|크게/.test(said)) {
    next.size = "large";
    hits++;
  }
  if (/레귤러|작은|기본사이즈/.test(said)) {
    next.size = "regular";
    hits++;
  }
  if (/얼음/.test(said)) {
    next.ice = /없/.test(said)
      ? "none"
      : /적/.test(said)
        ? "less"
        : /많/.test(said)
          ? "more"
          : "normal";
    next.temp = "ice";
    hits++;
  }

  const available = extrasFor(item).map((e) => e.key);
  EXTRA_PATTERNS.forEach(([key, re]) => {
    if (available.includes(key) && re.test(said)) {
      next.extras[key] = true;
      hits++;
    }
  });

  return { draft: next, hits };
}

/** "추천해 줘" 응답으로 고를 메뉴 이름 */
export function recommendationFor(said: string) {
  if (/따뜻|핫|뜨거/.test(said)) return "고구마라떼";
  if (/시원|차가|아이스/.test(said)) return "자몽에이드";
  if (/디저트|케이크|달달/.test(said)) return "티라미수";
  return "바닐라라떼";
}
