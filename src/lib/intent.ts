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

const SHOT_RE =
  /샷|[샤셔사차]추가|[샤셔]추(?:가|(?=$|[.,?!]))|[사차삿삭]추(?:가|(?=$|[.,?!]))|셔츠가|샤츠가|샤타|[샤셔삿삭](?=빼|제외|취소|없|말고)|^추(?:가)?(?:해|해줘|주세요|요)?[.!?]*$/;
const SYRUP_RE = /시럽|실업/;
const LIGHT_RE = /연하|연한|진하|진한/;
const MILK_RE = /(?:일반|그냥|보통|원래|흰)?우유|오트|오토|두유/;

const EXTRA_PATTERNS: [ExtraKey, RegExp][] = [
  ["shot", SHOT_RE],
  ["syrup", SYRUP_RE],
  ["light", LIGHT_RE],
  ["milk", MILK_RE],
];

const NON_EXTRA_ANCHOR_RE =
  /얼음|따뜻|따듯|뜨겁|뜨거|핫|차갑|차가|아이스|아이수|라지|낮지|낮으로|낮이|큰거|큰걸|큰사이즈|크게|[레네내][귤글길][러로]|귤[러로]|작은|스몰|(?:보통|기본)(?!우유)/gi;

const REMOVE_OPTION_RE =
  /빼|뺏|뺐|제외|취소|없애|없이|없게|없으|없어|말고|안넣|안할|안해|안주|않|하지마|넣지마|주지마/;
const POSITIVE_OPTION_RE =
  /하고|넣어|넣고|넣|해줘|해요|해주세요|해|줄|줘|주세요|할/;

export const EXTRA_OR_ICE_RE = new RegExp(
  `${SHOT_RE.source}|${SYRUP_RE.source}|${LIGHT_RE.source}|${MILK_RE.source}|얼음`,
);

export function hasOptionRemovalIntent(said: string): boolean {
  return (
    EXTRA_OR_ICE_RE.test(said) &&
    (REMOVE_OPTION_RE.test(said) ||
      /진하|진한|(?:일반|그냥|보통|원래|흰)우유/.test(said))
  );
}

interface OptionAnchor {
  start: number;
  end: number;
  key: ExtraKey | "ice" | null;
  matched: string;
}

function collectAnchors(said: string): OptionAnchor[] {
  const raw: OptionAnchor[] = [];
  for (const [key, re] of EXTRA_PATTERNS) {
    for (const m of said.matchAll(new RegExp(re.source, "g"))) {
      if (m.index !== undefined) {
        raw.push({
          start: m.index,
          end: m.index + m[0].length,
          key,
          matched: m[0],
        });
      }
    }
  }
  for (const m of said.matchAll(NON_EXTRA_ANCHOR_RE)) {
    if (m.index !== undefined) {
      raw.push({
        start: m.index,
        end: m.index + m[0].length,
        key: m[0] === "얼음" ? "ice" : null,
        matched: m[0],
      });
    }
  }
  raw.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    // 같은 시작 위치면 추가 옵션/얼음을 우선한다
    return (b.key ? 1 : 0) - (a.key ? 1 : 0);
  });

  const accepted: OptionAnchor[] = [];
  for (const anchor of raw) {
    const prev = accepted.at(-1);
    if (!prev || anchor.start >= prev.end) accepted.push(anchor);
  }
  return accepted;
}

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

  if (!item.iceOnly && /따뜻|따듯|뜨겁|뜨거|핫|hot/i.test(said)) {
    next.temp = "hot";
    hits++;
  }
  if (/차갑|차가|아이스|아이수|ice|시원|아아/i.test(said)) {
    next.temp = "ice";
    hits++;
  }
  if (
    /라지|낮지|낮으로|낮이|나지(?:주세요|주|요|로|할게|$)|큰거|큰걸|큰사이즈|크게/.test(
      said,
    )
  ) {
    next.size = "large";
    hits++;
  }
  if (
    /[레네내][귤글길][러로]|귤[러로]|(?:보통|기본)(?!우유)|작은|스몰/.test(
      said,
    )
  ) {
    next.size = "regular";
    hits++;
  }

  const anchors = collectAnchors(said);
  const available = extrasFor(item).map((e) => e.key);
  const resolvedExtras: {
    index: number;
    key: ExtraKey;
    value: boolean;
    explicitPos: boolean;
  }[] = [];

  anchors.forEach((anchor, i) => {
    const nextStart = i + 1 < anchors.length ? anchors[i + 1].start : said.length;
    const tail = said.slice(anchor.start, nextStart);
    const prefix = said.slice(i > 0 ? anchors[i - 1].end : 0, anchor.start);

    if (anchor.key === "ice") {
      next.ice = REMOVE_OPTION_RE.test(tail)
        ? "none"
        : /적|조금|살짝|덜/.test(tail)
          ? "less"
          : /많|가득/.test(tail)
            ? "more"
            : "normal";
      next.temp = "ice";
      hits++;
      return;
    }

    if (!anchor.key || !available.includes(anchor.key)) return;

    const forcedFalse =
      (anchor.key === "light" &&
        (/^진/.test(anchor.matched) || /(?:안|않)$/.test(prefix))) ||
      (anchor.key === "milk" && /^(?:일반|그냥|보통|원래|흰)/.test(anchor.matched));

    const remove = forcedFalse || REMOVE_OPTION_RE.test(tail);
    const explicitPos = !remove && POSITIVE_OPTION_RE.test(tail);
    resolvedExtras.push({
      index: i,
      key: anchor.key,
      value: !remove,
      explicitPos,
    });
  });

  // "샷이랑 시럽 빼줘"처럼 직전 추가 옵션에 동사 없이 나열만 된 경우 뒤의 빼기 의도를 이어받는다.
  for (let i = resolvedExtras.length - 2; i >= 0; i--) {
    const curr = resolvedExtras[i];
    const nextExtra = resolvedExtras[i + 1];
    if (
      curr.index + 1 === nextExtra.index &&
      curr.value &&
      !curr.explicitPos &&
      !nextExtra.value
    ) {
      curr.value = false;
    }
  }

  for (const entry of resolvedExtras) {
    next.extras[entry.key] = entry.value;
    hits++;
  }

  return { draft: next, hits };
}

/** "추천해 줘" 응답으로 고를 메뉴 이름 */
export function recommendationFor(said: string) {
  if (/따뜻|핫|뜨거/.test(said)) return "고구마라떼";
  if (/시원|차가|아이스/.test(said)) return "자몽에이드";
  if (/디저트|케이크|달달/.test(said)) return "티라미수";
  return "바닐라라떼";
}
