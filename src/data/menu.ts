/**
 * 온메모리 시드 데이터. 서버/DB 없이 이 파일 하나가 카페의 전체 카탈로그다.
 */

export type CategoryKey = "coffee" | "latte" | "tea" | "ade" | "dessert";
export type ExtraKey = "shot" | "syrup" | "light" | "milk";
export type IceKey = "normal" | "less" | "none" | "more";
export type TempKey = "hot" | "ice";
export type SizeKey = "regular" | "large";
export type PayKey = "card" | "samsung" | "kakao" | "naver" | "apple" | "cash";
export type ModeKey = "basic" | "low" | "contrast" | "voice";
export type ScreenKey =
  | "start"
  | "menu"
  | "option"
  | "cart"
  | "point"
  | "pay"
  | "paying"
  | "receipt"
  | "done";

export interface MenuItem {
  name: string;
  price: number;
  cat: CategoryKey;
  soldout: boolean;
  iceOnly: boolean;
  dessert: boolean;
}

export const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "coffee", label: "커피" },
  { key: "latte", label: "라떼" },
  { key: "tea", label: "차" },
  { key: "ade", label: "에이드" },
  { key: "dessert", label: "디저트" },
];

/** [이름, 가격, 플래그] — 's' 품절, 'i' ICE 전용, 'si' 품절 + ICE 전용 */
type RawItem = [string, number] | [string, number, "s" | "i" | "si"];

const RAW: Record<CategoryKey, RawItem[]> = {
  coffee: [
    ["아메리카노", 4500],
    ["카페라떼", 5000],
    ["바닐라라떼", 5500],
    ["카푸치노", 5000],
    ["카페모카", 5500],
    ["콜드브루", 5000, "si"],
  ],
  latte: [
    ["초코라떼", 5000],
    ["녹차라떼", 5500],
    ["고구마라떼", 5500],
    ["딸기라떼", 6000],
  ],
  tea: [
    ["유자차", 5000],
    ["대추차", 5500],
    ["캐모마일", 4500],
    ["얼그레이", 4500],
    ["복숭아 아이스티", 4500, "i"],
  ],
  ade: [
    ["자몽에이드", 5500],
    ["레몬에이드", 5500],
    ["청포도에이드", 5500],
  ],
  dessert: [
    ["치즈케이크", 6000],
    ["티라미수", 6500],
    ["초코쿠키", 3000],
    ["베이글", 3500],
    ["플레인크루아상", 4000],
    ["마카롱", 2500, "s"],
    ["소금빵", 3500],
  ],
};

export const MENU_ITEMS: MenuItem[] = CATEGORIES.flatMap(({ key }) =>
  RAW[key].map(([name, price, flag]) => ({
    name,
    price,
    cat: key,
    soldout: !!flag?.includes("s"),
    iceOnly: !!flag?.includes("i") || key === "ade",
    dessert: key === "dessert",
  })),
);

/** 음성 인식용 별칭 — "아아" → "아메리카노" */
export const ALIASES: [string, string][] = [
  ["아아", "아메리카노"],
  ["크루아상", "플레인크루아상"],
  ["아이스티", "복숭아 아이스티"],
  ["케이크", "치즈케이크"],
  ["쿠키", "초코쿠키"],
  ["라떼", "카페라떼"],
];

export const EXTRAS: { key: ExtraKey; label: string; price: number }[] = [
  { key: "shot", label: "샷 추가", price: 500 },
  { key: "syrup", label: "시럽 추가", price: 300 },
  { key: "light", label: "연하게", price: 0 },
  { key: "milk", label: "우유 변경", price: 500 },
];

export const ICE_LEVELS: { key: IceKey; label: string }[] = [
  { key: "normal", label: "보통" },
  { key: "less", label: "적게" },
  { key: "none", label: "없이" },
  { key: "more", label: "많이" },
];

export const LARGE_SURCHARGE = 500;

export const PAY_METHODS: { key: PayKey; label: string; hint: string }[] = [
  { key: "card", label: "신용/체크카드", hint: "IC카드 삽입" },
  { key: "samsung", label: "삼성페이", hint: "휴대폰 접촉" },
  { key: "kakao", label: "카카오페이", hint: "바코드 스캔" },
  { key: "naver", label: "네이버페이", hint: "바코드 스캔" },
  { key: "apple", label: "애플페이", hint: "휴대폰 접촉" },
  { key: "cash", label: "현금", hint: "카운터 결제" },
];

export const MODES: { key: ModeKey; label: string; sub: string }[] = [
  { key: "basic", label: "기본 모드", sub: "터치 + 음성" },
  { key: "low", label: "하단 모드", sub: "휠체어 · 저신장" },
  { key: "contrast", label: "고대비 · 큰 글씨", sub: "화면·글자 크게" },
  { key: "voice", label: "음성 모드", sub: "말로만 주문" },
];

export const MODE_LABEL: Record<ModeKey, string> = {
  basic: "기본 모드",
  low: "하단 모드",
  contrast: "고대비 모드",
  voice: "음성 모드",
};

export const STEPS: { key: ScreenKey; label: string }[] = [
  { key: "start", label: "① 시작" },
  { key: "menu", label: "② 메뉴" },
  { key: "option", label: "③ 옵션" },
  { key: "cart", label: "④ 장바구니" },
  { key: "point", label: "⑤ 적립" },
  { key: "pay", label: "⑥ 결제" },
  { key: "done", label: "⑦ 완료" },
];

/** 데모용 "말해보기" 예시 문장 */
export const SAY_CHIPS: Record<ScreenKey, string[]> = {
  start: [
    "아메리카노 하나 주세요",
    "아이스 아메리카노 라지 한 잔 카드로 결제",
    "고대비 모드로 해 줘",
  ],
  menu: [
    "아이스 아메리카노 라지로 두 잔",
    "카페라떼 핫 레귤러 카드로 할게요",
    "콜드브루 주세요",
    "시원한 거 추천해 줘",
  ],
  option: [
    "따뜻하게요",
    "라지로 주세요",
    "아이스 라지 얼음 적게, 샷 추가",
    "레귤러 카드로 할게요",
  ],
  cart: ["네, 맞아요", "아메리카노 빼 줘", "메뉴 더 담을게요"],
  point: ["1234", "적립 안 할게요"],
  pay: [
    "카카오페이로 할게요",
    "카드로 할게요",
    "메뉴 더 담을게요",
    "적립할게요",
  ],
  paying: ["결제 취소"],
  receipt: ["네, 뽑아 주세요", "아니요"],
  done: ["처음으로"],
};

export const RECOGNITION_FAIL_CHIP = "(인식 실패)";

export function findMenuItem(name: string): MenuItem | undefined {
  return MENU_ITEMS.find((item) => item.name === name);
}
