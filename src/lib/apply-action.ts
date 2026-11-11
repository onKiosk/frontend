import {
  findMenuItem,
  type CategoryKey,
  type ModeKey,
  type PayKey,
} from "@/data/menu";
import type {
  ServerAction,
  ServerCartChanges,
  ServerCartItem,
  ServerIce,
  ServerPayMethod,
  ServerSize,
  ServerTemperature,
} from "@/lib/action-types";
import { applyOptionSpeech, parseQty } from "@/lib/intent";
import { josa, squash } from "@/lib/korean";
import {
  extrasFor,
  missingOption,
  newDraft,
  toCartLine,
  type OptionDraft,
} from "@/lib/pricing";
// 타입만 가져온다(런타임 순환 import 없음). 스토어는 인자로 받는다.
import type { KioskState, KioskStore } from "@/store/kiosk-store";

export type Patch = (partial: Partial<KioskState>) => void;

/**
 * handled      : 처리함 → 인식 실패 횟수를 0으로
 * unrecognized : 서버가 "명령 없음(NO_COMMAND)"이라고 함 → 인식 실패 1회로 셈
 * unsupported  : 서버 Action은 맞지만 이 화면/메뉴에서 실행할 수 없음 → 기존 규칙으로 폴백
 */
export type ApplyOutcome = "handled" | "unrecognized" | "unsupported";

const TEMP: Record<ServerTemperature, "hot" | "ice"> = {
  HOT: "hot",
  ICE: "ice",
};
const SIZE: Record<ServerSize, "regular" | "large"> = {
  REGULAR: "regular",
  LARGE: "large",
};
const ICE: Record<ServerIce, "normal" | "less" | "none" | "more"> = {
  NORMAL: "normal",
  LESS: "less",
  NONE: "none",
  MORE: "more",
};
const PAY: Record<ServerPayMethod, PayKey> = {
  CARD: "card",
  SAMSUNG_PAY: "samsung",
  KAKAO_PAY: "kakao",
  NAVER_PAY: "naver",
  APPLE_PAY: "apple",
  CASH: "cash",
};
const MODE: Record<"LOWER_TOUCH" | "HIGH_CONTRAST" | "VOICE_GUIDE", ModeKey> = {
  LOWER_TOUCH: "low",
  HIGH_CONTRAST: "contrast",
  VOICE_GUIDE: "voice",
};
const PICKUP_TEXT = {
  VIBRATION_BELL: "진동벨이 울리면 픽업대로 와 주세요.",
  DINE_IN: "자리에서 기다려 주세요.",
  TAKEOUT: "포장 음료는 픽업대에서 받아 가세요.",
} as const;

/** TODO(결정 필요): 쿠폰 화면이 없으므로 안내 문구만 보여 준다. */
export const COUPON_NOT_READY =
  "쿠폰 기능은 아직 준비 중이에요. 필요하시면 직원에게 문의해 주세요.";
const OUT_OF_DOMAIN_TEXT = "죄송해요, 주문과 관련된 말씀만 도와드릴 수 있어요.";
const EMPTY_CART_TEXT = "장바구니가 비어 있어요. 메뉴를 먼저 담아 주세요.";

/** 서버 add_to_cart 항목 → 스토어의 OptionDraft (메뉴가 허용하지 않는 추가 옵션은 버린다) */
export function itemToDraft(it: ServerCartItem): OptionDraft | null {
  const item = findMenuItem(it.menu);
  if (!item) return null;
  const base = newDraft(item);
  if (item.dessert) return { ...base, qty: it.quantity };

  const o = it.options ?? {};
  const available = new Set(extrasFor(item).map((e) => e.key));
  const extras: OptionDraft["extras"] = {};
  if (o.shot && available.has("shot")) extras.shot = true;
  if (o.syrup && available.has("syrup")) extras.syrup = true;
  if (o.strength === "LIGHT" && available.has("light")) extras.light = true;
  if (o.milk && o.milk !== "REGULAR" && available.has("milk"))
    extras.milk = true; // SOY/OAT 모두 우유 변경

  return {
    ...base,
    temp: item.iceOnly ? "ice" : it.temperature ? TEMP[it.temperature] : null,
    size: it.size ? SIZE[it.size] : null,
    ice: o.ice ? ICE[o.ice] : "normal",
    extras,
    qty: it.quantity,
  };
}

/** modify_cart의 changes를 기존 줄의 draft에 반영 */
export function modifyDraft(
  draft: OptionDraft,
  ch: ServerCartChanges,
): OptionDraft {
  const next: OptionDraft = { ...draft, extras: { ...draft.extras } };
  if (ch.quantity !== undefined) next.qty = ch.quantity;
  if (draft.item.dessert) return next;

  const available = new Set(extrasFor(draft.item).map((e) => e.key));
  if (ch.temperature)
    next.temp = draft.item.iceOnly ? "ice" : TEMP[ch.temperature];
  if (ch.size) next.size = SIZE[ch.size];
  if (ch.ice) {
    next.ice = ICE[ch.ice];
    if (!next.temp) next.temp = "ice";
  }
  if (ch.shot !== undefined && available.has("shot"))
    next.extras.shot = ch.shot > 0;
  if (ch.syrup !== undefined && available.has("syrup"))
    next.extras.syrup = ch.syrup > 0;
  if (ch.strength !== undefined && available.has("light"))
    next.extras.light = ch.strength === "LIGHT";
  if (ch.milk !== undefined && available.has("milk"))
    next.extras.milk = ch.milk !== "REGULAR";
  return next;
}

/** NON_COFFEE는 탭이 3개(라떼/차/에이드)라서 발화 단어로 고른다. 없으면 라떼 탭. */
function nonCoffeeTab(said: string): CategoryKey {
  if (/에이드/.test(said)) return "ade";
  if (/유자차|대추차|캐모마일|얼그레이|아이스티|차종류|차메뉴|티/.test(said))
    return "tea";
  return "latte";
}

const listWithJosa = (names: string[]) =>
  [...names.slice(0, -1), josa(names[names.length - 1], "을", "를")].join(", ");

/**
 * 서버 Action 1건을 화면 상태 변경으로 바꾼다.
 * @param store  getState()로 얻은 현재 스토어(액션 함수 포함)
 * @param patch  useKioskStore.setState
 * @param said   사용자가 말한 원문(되묻기 때 이미 말한 옵션을 채우는 데 사용)
 */
export function applyAction(
  action: ServerAction,
  store: KioskStore,
  patch: Patch,
  said: string,
  answerText?: string,
): ApplyOutcome {
  const heard = squash(said);

  switch (action.action) {
    case "add_to_cart": {
      const drafts = action.items.map(itemToDraft);
      if (drafts.some((d) => d === null)) return "unsupported";
      patch({ editIndex: -1 }); // 장바구니 수정 중이었어도 새로 담는다
      for (const draft of drafts as OptionDraft[]) {
        if (missingOption(draft)) {
          store.go("option", { draft, editIndex: -1 });
          return "handled";
        }
        store.addDraftToCart(draft);
      }
      return "handled";
    }

    case "ask_clarification": {
      const item = findMenuItem(action.item);
      if (!item) return "unsupported";
      // 서버는 "무엇이 빠졌는지"만 알려 주므로, 이미 말한 옵션은 기존 규칙으로 채운다.
      const { draft } = applyOptionSpeech(
        { ...newDraft(item), qty: parseQty(heard) },
        heard,
      );
      if (missingOption(draft)) {
        store.go("option", { draft, editIndex: -1 }); // 안내 문구가 빠진 옵션을 되묻는다
      } else {
        patch({ editIndex: -1 });
        store.addDraftToCart(draft);
      }
      return "handled";
    }

    case "recommend_menu": {
      const names = action.items.filter((n) => findMenuItem(n));
      if (!names.length) return "unsupported";
      store.go("menu", { cat: findMenuItem(names[0])!.cat });
      patch({
        recommended: names[0],
        say: `${listWithJosa(names)} 추천드려요. 주문하시려면 “${names[0]} 주세요”라고 말씀해 주세요.`,
      });
      return "handled";
    }

    case "show_cart":
      store.go("cart");
      return "handled";

    case "modify_cart": {
      const index = store.cart.findIndex((l) => l.name === action.target);
      if (index < 0) return "unsupported";
      const cart = store.cart.map((line, i) =>
        i === index
          ? toCartLine(modifyDraft(line.draft, action.changes))
          : line,
      );
      store.go("cart", { cart });
      patch({
        say: `${josa(action.target, "을", "를")} 요청하신 대로 바꿨어요.`,
      });
      return "handled";
    }

    case "remove_from_cart": {
      if (!store.cart.some((l) => l.name === action.target))
        return "unsupported";
      patch({
        cart: store.cart.filter((l) => l.name !== action.target),
        say: `${josa(action.target, "을", "를")} 뺐어요.`,
      });
      return "handled";
    }

    case "reset_order":
      store.clearCart();
      return "handled";

    case "confirm_order":
      // 장바구니 화면이 아니면 요약을 보여 주고(되묻기 문구가 총액을 읽어 준다), 이미 장바구니 화면이면 다음 단계로.
      if (!store.cart.length) {
        patch({ say: EMPTY_CART_TEXT });
      } else if (store.screen === "cart") {
        store.confirmCart();
      } else {
        store.go("cart");
      }
      return "handled";

    case "inform_sold_out": {
      const item = findMenuItem(action.item);
      if (!item) return "unsupported";
      const alts = action.alternatives.filter((n) => findMenuItem(n));
      store.go("menu", { cat: item.cat });
      patch({
        recommended: alts[0] ?? null,
        say: alts.length
          ? `죄송해요, ${josa(item.name, "은", "는")} 지금 품절이에요. 대신 ${alts.join(", ")} 중에서 골라 보시겠어요?`
          : `죄송해요, ${josa(item.name, "은", "는")} 지금 품절이에요. 다른 메뉴를 골라 주세요.`,
      });
      return "handled";
    }

    case "show_category": {
      const cat: CategoryKey =
        action.category === "COFFEE"
          ? "coffee"
          : action.category === "DESSERT"
            ? "dessert"
            : nonCoffeeTab(heard);
      store.go("menu", { cat });
      return "handled";
    }

    case "start_payment":
      store.startPay(PAY[action.method]);
      return "handled";

    case "open_loyalty_input":
      store.go("point"); // 키패드는 4자리/11자리 모두 받으므로 input_mode는 구분하지 않는다
      return "handled";

    case "open_coupon_list":
      patch({ say: COUPON_NOT_READY });
      return "handled";

    case "set_receipt":
      if (store.screen === "receipt") store.finish(action.print);
      else patch({ say: "영수증은 결제가 끝난 뒤에 고르실 수 있어요." });
      return "handled";

    case "announce_order":
      patch({
        say:
          store.screen === "done"
            ? `주문번호 ${action.order_number}번입니다. ${PICKUP_TEXT[action.pickup]}`
            : "아직 결제가 끝나지 않았어요.",
      });
      return "handled";

    case "set_accessibility":
      store.setMode(MODE[action.mode]);
      return "handled";

    case "call_staff":
      if (action.reason === "VOICE_RECOGNITION_FAILED_TWICE")
        patch({ staff: "fail", fails: 0 });
      else store.callStaff();
      return "handled";

    case "answer_question":
      if (!answerText) return "unsupported";
      patch({ say: answerText });
      return "handled";

    case "no_action":
      // TODO(결정 필요): NO_COMMAND만 인식 실패로 셀지, OUT_OF_DOMAIN도 셀지
      if (action.reason === "NO_COMMAND") return "unrecognized";
      patch({ say: OUT_OF_DOMAIN_TEXT });
      return "handled";

    default: {
      const unreachable: never = action;
      void unreachable;
      return "unsupported";
    }
  }
}
