'use client';

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  MENU_ITEMS,
  MODE_LABEL,
  findMenuItem,
  type CategoryKey,
  type MenuItem,
  type ModeKey,
  type PayKey,
  type ScreenKey,
} from '@/data/menu';
import type { DialogState, StaffState } from '@/lib/dialog';
import {
  applyOptionSpeech,
  matchCategory,
  matchItem,
  matchMode,
  matchPay,
  parseQty,
  recommendationFor,
} from '@/lib/intent';
import { josa, squash } from '@/lib/korean';
import {
  cartTotal,
  missingOption,
  newDraft,
  optionText,
  stampCount,
  toCartLine,
  unitWord,
  type CartLine,
  type OptionDraft,
} from '@/lib/pricing';

/** 음성을 이만큼 연속으로 못 알아들으면 직원 호출을 제안한다. */
export const FAIL_LIMIT = 2;

export interface KioskState {
  screen: ScreenKey;
  mode: ModeKey;
  cat: CategoryKey;
  cart: CartLine[];
  draft: OptionDraft | null;
  /** 장바구니 수정 중인 줄 번호, 새로 담는 중이면 -1 */
  editIndex: number;
  listening: boolean;
  voicePaused: boolean;
  transcript: string;
  /** 한 번만 띄우는 안내 문구 (있으면 기본 배너 문구를 덮는다) */
  say: string | null;
  fails: number;
  staff: StaffState | null;
  phone: string;
  pay: PayKey | null;
  /** 필수 옵션을 더 물어보는 동안 기억하는 음성 결제 수단 */
  pendingPay: PayKey | null;
  orderNo: number;
  receipt: boolean;
  stamp: number;
  /** 추천 배지를 달 메뉴 이름 */
  recommended: string | null;
}

export interface KioskActions {
  go: (screen: ScreenKey, patch?: Partial<KioskState>) => void;
  reset: () => void;
  jump: (screen: ScreenKey) => void;
  setMode: (mode: ModeKey) => void;
  setCategory: (cat: CategoryKey) => void;
  tapItem: (item: MenuItem) => void;
  updateDraft: (patch: Partial<OptionDraft>) => void;
  toggleExtra: (key: keyof OptionDraft['extras']) => void;
  addDraftToCart: (draft?: OptionDraft) => void;
  changeLineQty: (index: number, delta: number) => void;
  removeLine: (index: number) => void;
  editLine: (index: number) => void;
  clearCart: () => void;
  confirmCart: () => void;
  pressPhoneKey: (key: string) => void;
  savePoint: (digits: string) => void;
  skipPoint: () => void;
  startPay: (pay: PayKey) => void;
  completeDemoPay: () => void;
  cancelPay: () => void;
  finish: (receipt: boolean) => void;
  callStaff: () => void;
  closeStaff: () => void;
  setListening: (listening: boolean) => void;
  setTranscript: (transcript: string) => void;
  /** 발화 한 건을 처리한다. 못 알아들으면 실패 카운트를 올린다. */
  handleUtterance: (text: string) => void;
  noteVoiceError: (message: string) => void;
}

export type KioskStore = KioskState & KioskActions;

const INITIAL: KioskState = {
  screen: 'start',
  mode: 'basic',
  cat: 'coffee',
  cart: [],
  draft: null,
  editIndex: -1,
  listening: false,
  voicePaused: false,
  transcript: '',
  say: null,
  fails: 0,
  staff: null,
  phone: '',
  pay: null,
  pendingPay: null,
  orderNo: 0,
  receipt: false,
  stamp: 0,
  recommended: null,
};

/** 데모용 시드 장바구니 — 단계 이동 버튼으로 중간 화면을 바로 볼 때 채운다. */
function seedCart(): CartLine[] {
  const latte: OptionDraft = { ...newDraft(MENU_ITEMS[1]), temp: 'hot', size: 'regular', qty: 2 };
  const americano: OptionDraft = { ...newDraft(MENU_ITEMS[0]), temp: 'ice', size: 'large', ice: 'less' };
  const cake = newDraft(findMenuItem('치즈케이크')!);
  return [latte, americano, cake].map(toCartLine);
}

export const useKioskStore = create<KioskStore>((set, get) => ({
  ...INITIAL,

  go: (screen, patch) => {
    set({ screen, say: null, recommended: null, pendingPay: null, ...patch });
  },

  reset: () => {
    set({ ...INITIAL, mode: get().mode, voicePaused: get().voicePaused });
  },

  jump: (screen) => {
    if (screen === 'start') {
      get().reset();
      return;
    }
    const { cart, draft } = get();
    const patch: Partial<KioskState> = {};
    if (screen === 'option' && !draft) {
      patch.draft = newDraft(MENU_ITEMS[1]);
      patch.editIndex = -1;
    }
    if (['cart', 'point', 'pay', 'done'].includes(screen) && !cart.length) {
      patch.cart = seedCart();
    }
    if (screen === 'done') patch.orderNo = 127;
    get().go(screen, patch);
  },

  setMode: (mode) => {
    const label = MODE_LABEL[mode];
    const say =
      mode === 'voice'
        ? '음성 모드예요. 말로만 주문할 수 있어요. 드실 메뉴를 말씀해 주세요.'
        : `${josa(label, '으로', '로')} 바꿨어요.`;
    if (get().screen === 'start') {
      get().go('menu', { mode });
      set({ say });
      return;
    }
    set({ mode, say });
  },

  setCategory: (cat) => set({ cat, say: null }),

  tapItem: (item) => {
    if (item.soldout) {
      const alt = MENU_ITEMS.find((i) => i.cat === item.cat && !i.soldout && i !== item)!;
      get().go('menu', { cat: item.cat });
      set({
        recommended: alt.name,
        say: `죄송해요, ${josa(item.name, '은', '는')} 지금 품절이에요. 대신 ${josa(
          alt.name,
          '은',
          '는',
        )} 어떠세요?`,
      });
      return;
    }
    if (item.dessert) {
      get().addDraftToCart(newDraft(item));
      return;
    }
    get().go('option', { draft: newDraft(item), editIndex: -1 });
  },

  updateDraft: (patch) => {
    const draft = get().draft;
    if (!draft) return;
    set({ draft: { ...draft, ...patch }, say: null });
  },

  toggleExtra: (key) => {
    const draft = get().draft;
    if (!draft) return;
    set({
      draft: { ...draft, extras: { ...draft.extras, [key]: !draft.extras[key] } },
      say: null,
    });
  },

  addDraftToCart: (input) => {
    const state = get();
    const draft = input ?? state.draft;
    if (!draft) return;

    // 필수 옵션이 빠졌으면 담지 않고 옵션 화면에 머문다.
    if (missingOption(draft)) {
      set({ draft, say: null });
      return;
    }

    const line = toCartLine(draft);
    const cart = [...state.cart];
    if (state.editIndex >= 0) {
      cart.splice(state.editIndex, 1, line);
    } else {
      const same = cart.findIndex((l) => l.name === line.name && l.opt === line.opt);
      if (same >= 0) cart[same] = { ...cart[same], qty: cart[same].qty + line.qty };
      else cart.push(line);
    }

    const changed = state.editIndex >= 0;
    const opt = line.opt ? ` ${line.opt.split(' · ').join(' ')}` : '';
    get().go('menu', { cart, cat: draft.item.cat, draft: null, editIndex: -1 });
    set({
      say: `${line.name}${opt} ${line.qty}${unitWord(draft.item)} ${
        changed ? '으로 바꿨어요' : '담았어요'
      }. 더 필요하신 게 있나요?`,
    });
  },

  changeLineQty: (index, delta) =>
    set((s) => ({
      cart: s.cart.map((line, i) =>
        i === index ? { ...line, qty: Math.max(1, line.qty + delta) } : line,
      ),
      say: null,
    })),

  removeLine: (index) =>
    set((s) => ({
      cart: s.cart.filter((_, i) => i !== index),
      say: `${josa(s.cart[index].name, '을', '를')} 뺐어요.`,
    })),

  editLine: (index) => {
    const line = get().cart[index];
    if (!line) return;
    get().go('option', { draft: { ...line.draft, qty: line.qty }, editIndex: index });
  },

  clearCart: () => set({ cart: [], say: '장바구니를 모두 비웠어요.' }),

  confirmCart: () => {
    if (get().cart.length) get().go('point');
  },

  pressPhoneKey: (key) => {
    const phone = get().phone;
    const next =
      key === 'back' ? phone.slice(0, -1) : key === 'clear' ? '' : (phone + key).slice(0, 11);
    set({ phone: next });
  },

  savePoint: (digits) => {
    const stamp = stampCount(get().cart);
    get().go('pay', { phone: digits, stamp });
    set({ say: `스탬프 ${stamp}개가 적립됐어요. 결제 수단을 골라 주세요.` });
  },

  skipPoint: () => get().go('pay', { phone: '', stamp: 0 }),

  startPay: (pay) => {
    if (!get().cart.length) {
      set({ say: '장바구니가 비어 있어요. 메뉴를 먼저 담아 주세요.' });
      return;
    }
    get().go('paying', { pay });
  },

  completeDemoPay: () => {
    if (get().screen === 'paying') get().go('receipt');
  },

  cancelPay: () => {
    get().go('pay', { pay: null });
    set({ say: '결제를 취소했어요. 결제 수단을 다시 골라 주세요.' });
  },

  finish: (receipt) => get().go('done', { receipt, orderNo: 100 + Math.floor(Math.random() * 900) }),

  callStaff: () => set({ staff: 'called' }),
  closeStaff: () => set({ staff: null }),

  setListening: (listening) => set({ listening }),
  setTranscript: (transcript) => set({ transcript }),

  noteVoiceError: (message) => set({ listening: false, say: message }),

  handleUtterance: (text) => {
    set({ transcript: text });
    const understood = resolveIntent(get, text);
    if (understood) {
      set({ fails: 0 });
      return;
    }
    const fails = get().fails + 1;
    if (fails >= FAIL_LIMIT) set({ fails: 0, staff: 'fail' });
    else set({ fails, say: '잘 알아듣지 못했어요. 다시 한 번 말씀해 주세요.' });
  },
}));

/**
 * 발화 → 상태 변경. 처리했으면 true.
 * 화면별 규칙을 먼저 보고, 마지막에 화면과 무관한 규칙(메뉴 주문·추천)을 본다.
 */
function resolveIntent(get: () => KioskStore, raw: string): boolean {
  const said = squash(raw);
  const store = get();
  const screen = store.screen;

  if (/도와|직원/.test(said)) {
    store.callStaff();
    return true;
  }

  const mode = matchMode(said);
  if (mode) {
    store.setMode(mode);
    return true;
  }

  if (screen === 'paying') {
    if (/취소|이전|뒤로|다시/.test(said)) store.cancelPay();
    else useKioskStore.setState({ say: '결제를 기다리고 있어요. 결제 수단을 바꾸려면 “결제 취소”라고 말씀해 주세요.' });
    return true;
  }

  if (screen === 'option' && store.draft) {
    if (/이전|뒤로/.test(said)) {
      store.go('menu');
      return true;
    }
    const item = matchItem(said);
    if (item && item.name !== store.draft.item.name) {
      orderByVoice(store, item, said);
      return true;
    }
    const { draft, hits } = applyOptionSpeech(store.draft, said);
    const pay = matchPay(said);
    if (hits || pay || /담아|없어|괜찮|됐어|그대로|이대로|결제/.test(said)) {
      completeVoiceOrder(store, draft, pay ?? store.pendingPay);
      return true;
    }
  }

  if (screen === 'cart') {
    if (/전체|다|모두/.test(said) && /취소|빼|비워|삭제/.test(said)) {
      store.clearCart();
      return true;
    }
    const item = matchItem(said);
    if (item && /빼|취소|삭제|없애/.test(said)) {
      const has = store.cart.some((l) => l.name === item.name);
      useKioskStore.setState({
        cart: store.cart.filter((l) => l.name !== item.name),
        say: has
          ? `${josa(item.name, '을', '를')} 뺐어요.`
          : `장바구니에 ${josa(item.name, '이', '가')} 없어요.`,
      });
      return true;
    }
    if (/더/.test(said) && !item) {
      store.go('menu');
      return true;
    }
    if (!item && (matchPay(said) || /네|맞아|주문|결제|응/.test(said)) && store.cart.length) {
      checkoutByVoice(store, matchPay(said));
      return true;
    }
  }

  if (screen === 'point') {
    const digits = said.replace(/\D/g, '');
    if (digits.length === 4 || digits.length === 11) {
      store.savePoint(digits);
      const pay = matchPay(said);
      if (pay) store.startPay(pay);
      return true;
    }
    if (/안|건너|괜찮|없/.test(said)) {
      store.skipPoint();
      const pay = matchPay(said);
      if (pay) store.startPay(pay);
      return true;
    }
    const pay = matchPay(said);
    if (pay) {
      store.skipPoint();
      store.startPay(pay);
      return true;
    }
  }

  if (screen === 'receipt') {
    if (/아니|안|괜찮|필요없/.test(said)) {
      store.finish(false);
      return true;
    }
    if (/네|출력|뽑|주세요/.test(said)) {
      store.finish(true);
      return true;
    }
  }

  if (screen === 'done' && /처음/.test(said)) {
    store.reset();
    return true;
  }

  if (/추천/.test(said)) {
    const name = recommendationFor(said);
    const item = findMenuItem(name)!;
    store.go('menu', { cat: item.cat });
    useKioskStore.setState({
      recommended: name,
      say: `${josa(name, '을', '를')} 추천드려요. 주문하시려면 “${name} 주세요”라고 말씀해 주세요.`,
    });
    return true;
  }

  if (['start', 'menu', 'option', 'cart', 'pay'].includes(screen)) {
    const item = matchItem(said);
    if (item) {
      orderByVoice(store, item, said);
      return true;
    }
    const pay = matchPay(said);
    if (pay || /결제/.test(said)) {
      checkoutByVoice(store, pay);
      return true;
    }
    if (screen === 'pay' && /적립|스탬프/.test(said)) {
      store.go('point');
      return true;
    }
    if (screen === 'pay' && /이전|뒤로/.test(said)) {
      store.go('cart');
      return true;
    }
    const cat = matchCategory(said);
    if (cat && screen !== 'cart') {
      store.go('menu', { cat });
      return true;
    }
    if (/장바구니|주문할게/.test(said) && store.cart.length) {
      store.go('cart');
      return true;
    }
    if (/주문|메뉴/.test(said)) {
      store.go('menu');
      return true;
    }
  }

  return false;
}

/** 말로 메뉴를 주문했을 때 — 옵션까지 다 말했으면 바로 담는다. */
function orderByVoice(store: KioskStore, item: MenuItem, said: string) {
  if (item.soldout) {
    store.tapItem(item);
    return;
  }
  const base: OptionDraft = { ...newDraft(item), qty: parseQty(said) };
  const { draft } = applyOptionSpeech(base, said);
  // 새 메뉴는 기존 장바구니 수정 상태를 이어받지 않는다.
  store.go('option', { draft, editIndex: -1 });
  completeVoiceOrder(useKioskStore.getState(), draft, matchPay(said));
}

function completeVoiceOrder(store: KioskStore, draft: OptionDraft, pay: PayKey | null) {
  if (missingOption(draft)) {
    useKioskStore.setState({ draft, pendingPay: pay, say: null });
    return;
  }
  store.addDraftToCart(draft);
  checkoutByVoice(useKioskStore.getState(), pay);
}

function checkoutByVoice(store: KioskStore, pay: PayKey | null) {
  if (!store.cart.length) {
    useKioskStore.setState({ say: '장바구니가 비어 있어요. 메뉴를 먼저 담아 주세요.' });
    return;
  }
  if (pay) store.startPay(pay);
  else store.go('pay', { pay: null });
}

/** 파생값 셀렉터 */
export const selectTotal = (s: KioskStore) => cartTotal(s.cart);
export const selectOptionText = (s: KioskStore) => (s.draft ? optionText(s.draft) : '');

/** 안내 문구에 필요한 상태만 얕은 비교로 구독한다. */
export const useDialogState = () =>
  useKioskStore(
    useShallow(
      (s): DialogState => ({
        screen: s.screen,
        mode: s.mode,
        cat: s.cat,
        cart: s.cart,
        draft: s.draft,
        say: s.say,
        pay: s.pay,
        orderNo: s.orderNo,
      }),
    ),
  );
