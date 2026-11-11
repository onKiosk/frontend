import {
  EXTRAS,
  ICE_LEVELS,
  LARGE_SURCHARGE,
  type ExtraKey,
  type IceKey,
  type MenuItem,
  type SizeKey,
  type TempKey,
} from '@/data/menu';

/** 옵션 선택 중인 임시 항목 (원본 `cur`) */
export interface OptionDraft {
  item: MenuItem;
  temp: TempKey | null;
  size: SizeKey | null;
  ice: IceKey;
  extras: Partial<Record<ExtraKey, boolean>>;
  qty: number;
}

/** 장바구니 한 줄 */
export interface CartLine {
  name: string;
  item: MenuItem;
  draft: OptionDraft;
  /** "HOT · 레귤러 · 샷 추가" */
  opt: string;
  /** 1개 단가 (사이즈·추가옵션 반영) */
  unit: number;
  qty: number;
}

export const newDraft = (item: MenuItem): OptionDraft => ({
  item,
  temp: item.iceOnly ? 'ice' : null,
  size: null,
  ice: 'normal',
  extras: {},
  qty: 1,
});

/** 메뉴별로 고를 수 있는 추가 옵션만 남긴다. */
export function extrasFor(item: MenuItem) {
  if (item.dessert) return [];
  const milky = /라떼|카푸치노|모카/.test(item.name);
  return EXTRAS.filter(({ key }) => {
    if (key === 'shot') return item.cat === 'coffee';
    if (key === 'syrup') return true;
    if (key === 'light') return item.cat === 'coffee' || item.cat === 'tea';
    return milky;
  });
}

export function unitPrice(draft: OptionDraft) {
  const extras = EXTRAS.filter(({ key }) => draft.extras[key]).reduce((sum, e) => sum + e.price, 0);
  return draft.item.price + (draft.size === 'large' ? LARGE_SURCHARGE : 0) + extras;
}

export function optionText(draft: OptionDraft) {
  if (draft.item.dessert) return '';
  const parts: string[] = [];
  if (draft.temp) parts.push(draft.temp === 'hot' ? 'HOT' : 'ICE');
  if (draft.size) parts.push(draft.size === 'large' ? '라지' : '레귤러');
  if (draft.temp === 'ice') {
    parts.push(`얼음 ${ICE_LEVELS.find((i) => i.key === draft.ice)!.label}`);
  }
  EXTRAS.forEach(({ key, label }) => {
    if (draft.extras[key]) parts.push(label === '우유 변경' ? '오트우유' : label);
  });
  return parts.join(' · ');
}

/** 아직 못 고른 필수 옵션 */
export function missingOption(draft: OptionDraft | null): 'temp' | 'size' | null {
  if (!draft || draft.item.dessert) return null;
  if (!draft.temp) return 'temp';
  if (!draft.size) return 'size';
  return null;
}

export const toCartLine = (draft: OptionDraft): CartLine => ({
  name: draft.item.name,
  item: draft.item,
  draft,
  opt: optionText(draft),
  unit: unitPrice(draft),
  qty: draft.qty,
});

export const lineKey = (line: CartLine) => `${line.name}|${line.opt}`;

export const cartTotal = (cart: CartLine[]) => cart.reduce((sum, l) => sum + l.unit * l.qty, 0);

export const cartCount = (cart: CartLine[]) => cart.reduce((sum, l) => sum + l.qty, 0);

/** 음료 1잔당 스탬프 1개 — 디저트는 제외 */
export const stampCount = (cart: CartLine[]) =>
  cart.filter((l) => !l.item.dessert).reduce((sum, l) => sum + l.qty, 0);

export const unitWord = (item: MenuItem) => (item.dessert ? '개' : '잔');
