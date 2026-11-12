import {
  CATEGORIES,
  MENU_ITEMS,
  type CategoryKey,
  type ModeKey,
  type PayKey,
  type ScreenKey,
} from "@/data/menu";
import { won } from "@/lib/korean";
import {
  cartTotal,
  extrasFor,
  missingOption,
  unitWord,
  type CartLine,
  type OptionDraft,
} from "@/lib/pricing";

/** 안내 문구를 만드는 데 필요한 상태만 */
export interface DialogState {
  screen: ScreenKey;
  mode: ModeKey;
  cat: CategoryKey;
  cart: CartLine[];
  draft: OptionDraft | null;
  say: string | null;
  pay: PayKey | null;
  orderNo: number;
  /** 서버가 발급한 주문번호(예: "A042"). 없으면 orderNo(임시 번호)를 "N번"으로 읽는다. */
  orderNumber?: string | null;
}

/** "아메리카노 ICE 라지 2잔, 치즈케이크 1개" */
export function cartSummary(cart: CartLine[]) {
  return cart
    .map((line) => {
      const opt = line.opt ? ` ${line.opt.split(" · ").join(" ")}` : "";
      return `${line.name}${opt} ${line.qty}${unitWord(line.item)}`;
    })
    .join(", ");
}

/** 배너에 띄우는 한 줄 (= 자막) */
export function bannerText(s: DialogState): string {
  if (s.say) return s.say;
  switch (s.screen) {
    case "start":
      return "안녕하세요. 편한 방법을 고르시거나, 드실 메뉴를 말씀해 주세요.";
    case "menu":
      return "드실 메뉴를 말씀하시거나 눌러 주세요";
    case "option": {
      const missing = missingOption(s.draft);
      if (missing === "temp")
        return "따뜻한 걸로 드릴까요, 차가운 걸로 드릴까요?";
      if (missing === "size")
        return "사이즈는 레귤러, 라지 중 어떤 걸로 드릴까요?";
      return "추가 옵션이 있으면 말씀해 주세요. 없으면 “담아 주세요”";
    }
    case "cart":
      return s.cart.length
        ? `${cartSummary(s.cart)}. 총 ${won(cartTotal(s.cart))}, 맞으신가요?`
        : "장바구니가 비어 있어요. 메뉴를 담아 주세요.";
    case "point":
      return "스탬프 적립할 전화번호를 눌러 주세요. 건너뛰려면 “적립 안 할게요”";
    case "pay":
      return `총 ${won(cartTotal(s.cart))}입니다. 결제 수단을 말씀하시거나 골라 주세요.`;
    case "paying":
      return payingCopy(s.pay).title;
    case "receipt":
      return "결제가 완료됐어요. 영수증을 출력할까요?";
    case "done": {
      const no = s.orderNumber ?? `${s.orderNo}번`;
      return `주문번호 ${no}입니다. 화면 아래 왼쪽 배출구에서 진동벨을 가져가 주세요. 벨이 울리면 픽업대로 와 주세요.`;
    }
  }
}

/** 음성 모드에서는 화면을 못 본다고 보고 목록까지 읽어 준다. */
export function spokenText(s: DialogState): string {
  let text = bannerText(s);
  if (s.mode !== "voice") return text;

  if (s.screen === "menu" && !s.say) {
    const label = CATEGORIES.find((c) => c.key === s.cat)!.label;
    const list = MENU_ITEMS.filter((i) => i.cat === s.cat)
      .map((i) => `${i.name} ${i.price}원${i.soldout ? " 품절" : ""}`)
      .join(", ");
    text += `. ${label} 메뉴는 ${list}가 있어요. 다른 종류는 커피, 라떼, 차, 에이드, 디저트라고 말씀해 주세요.`;
  }
  if (s.screen === "option" && s.draft && !missingOption(s.draft)) {
    const names = extrasFor(s.draft.item).map((e) => e.label);
    if (names.length) text += `. 가능한 추가 옵션은 ${names.join(", ")}이에요.`;
  }
  if (s.screen === "menu" && s.cart.length) {
    text += ` 지금 장바구니에는 ${cartSummary(s.cart)}가 담겨 있어요.`;
  }
  if (s.screen === "pay") {
    text = `${cartSummary(s.cart)}. ${text} 카드, 삼성페이, 카카오페이, 네이버페이, 애플페이, 현금 중에서 골라 주세요. 메뉴를 더 담거나 스탬프를 적립할 수도 있어요.`;
  }
  if (s.screen === "paying" && !s.say) {
    text = `${cartSummary(s.cart)}. 총 ${won(cartTotal(s.cart))}입니다. ${text} ${payingCopy(s.pay).body}`;
  }
  return text;
}

export type StaffState = "fail" | "called";

export function staffTexts(staff: StaffState): [string, string] {
  return staff === "fail"
    ? [
        "음성을 두 번 인식하지 못했어요",
        "직원을 불러 드릴까요? 화면을 눌러 주문을 계속할 수도 있어요.",
      ]
    : ["직원을 호출했어요", "잠시만 기다려 주세요. 곧 도와드릴게요."];
}

/** 결제 대기 화면 문구 */
export function payingCopy(pay: PayKey | null) {
  if (pay === "card") {
    return {
      title: "IC카드를 꽂아 주세요",
      body: "카드 삽입구는 화면 아래 오른쪽에 있어요. 결제가 끝날 때까지 빼지 마세요.",
      slot: "IC카드 삽입구",
    };
  }
  if (pay === "cash") {
    return {
      title: "카운터에서 결제해 주세요",
      body: "카운터 직원에게 현금 결제를 요청해 주세요.",
      slot: "카운터 →",
    };
  }
  if (pay === "kakao" || pay === "naver") {
    return {
      title: "결제 바코드를 보여 주세요",
      body: "휴대폰의 결제 바코드를 화면 아래 오른쪽 스캐너에 보여 주세요.",
      slot: "바코드 스캐너",
    };
  }
  return {
    title: "휴대폰을 대 주세요",
    body: "결제 단말기는 화면 아래 오른쪽에 있어요.",
    slot: "결제 단말기",
  };
}

/** 전화번호 표시 형식 */
export function formatPhone(digits: string) {
  if (!digits) return "번호를 눌러 주세요";
  if (digits.length > 7)
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length > 3 && digits.startsWith("0"))
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return digits;
}
