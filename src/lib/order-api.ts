import type { IceKey, PayKey } from "@/data/menu";
import { actionApiUrl, isActionApiEnabled } from "@/lib/action-api";
import type {
  ServerCartItem,
  ServerIce,
  ServerItemOptions,
  ServerPayMethod,
} from "@/lib/action-types";
import type { CartLine } from "@/lib/pricing";

/**
 * 주문 저장(POST /api/orders)과 스탬프 적립(POST /api/stamps).
 * 서버 app/routers/orders.py와 맞춘다. 두 함수 모두 예외를 던지지 않고 결과 객체를 돌려준다.
 * 전화번호는 요청 본문으로만 보내고 로그·오류 문구에는 남기지 않는다.
 */

/** 서버가 한 줄(quantity)에 허용하는 최대 수량 / 스탬프 1회 요청 최대 개수. */
const MAX_LINE_QTY = 9;
const MAX_STAMPS_PER_REQUEST = 10;
const orderTimeoutMs = () =>
  Number(process.env.NEXT_PUBLIC_ORDER_TIMEOUT_MS ?? 6000);

const PAY: Record<PayKey, ServerPayMethod> = {
  card: "CARD",
  samsung: "SAMSUNG_PAY",
  kakao: "KAKAO_PAY",
  naver: "NAVER_PAY",
  apple: "APPLE_PAY",
  cash: "CASH",
};

const ICE: Record<IceKey, ServerIce> = {
  normal: "NORMAL",
  less: "LESS",
  none: "NONE",
  more: "MORE",
};

/** 장바구니 한 줄 → 서버 주문 항목. 디저트는 메뉴·수량만 보낸다(서버가 옵션을 거부한다). */
function lineToItem(line: CartLine): ServerCartItem {
  const { item, draft } = line;
  const out: ServerCartItem = { menu: line.name, quantity: line.qty };
  if (item.dessert) return out;

  if (draft.temp) out.temperature = draft.temp === "hot" ? "HOT" : "ICE";
  if (draft.size) out.size = draft.size === "large" ? "LARGE" : "REGULAR";

  const options: ServerItemOptions = {};
  if (draft.temp === "ice") options.ice = ICE[draft.ice]; // HOT에는 얼음 옵션을 붙일 수 없다
  if (draft.extras.shot) options.shot = 1;
  if (draft.extras.syrup) options.syrup = 1;
  if (draft.extras.light) options.strength = "LIGHT";
  if (draft.extras.milk) options.milk = "OAT"; // 화면에서 "오트우유"로 보여 준다
  if (Object.keys(options).length) out.options = options;
  return out;
}

/** 수량이 서버 상한(9)을 넘으면 같은 메뉴를 여러 줄로 나눈다. 총액은 같다. */
export function cartToOrderItems(cart: CartLine[]): ServerCartItem[] {
  return cart.flatMap((line) => {
    const base = lineToItem(line);
    const items: ServerCartItem[] = [];
    for (let left = line.qty; left > 0; left -= MAX_LINE_QTY) {
      items.push({ ...base, quantity: Math.min(left, MAX_LINE_QTY) });
    }
    return items;
  });
}

interface ApiJson {
  ok?: boolean;
  error_code?: string | null;
  order_number?: string | null;
  total_price?: number | null;
}

type PostResult = { ok: true; data: ApiJson } | { ok: false; reason: string };

interface CallOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

async function postJson(
  path: string,
  body: unknown,
  options: CallOptions,
): Promise<PostResult> {
  if (!isActionApiEnabled()) return { ok: false, reason: "DISABLED" };
  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? orderTimeoutMs(),
  );
  try {
    const res = await doFetch(`${actionApiUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let data: ApiJson | null = null;
    try {
      data = (await res.json()) as ApiJson;
    } catch {
      data = null;
    }
    if (res.ok && data?.ok) return { ok: true, data };
    return { ok: false, reason: data?.error_code ?? `HTTP_${res.status}` };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, reason: aborted ? "TIMEOUT" : "NETWORK" };
  } finally {
    clearTimeout(timer);
  }
}

export type OrderResult =
  | { kind: "ok"; orderNumber: string; total: number | null }
  | { kind: "fail"; reason: string };

/**
 * 결제가 끝난 장바구니를 서버에 저장하고 주문번호(예: A042)를 받는다.
 * total_price는 보내지 않는다 — 서버가 DB 가격표로 계산한다(화면 합계와 다르면 total로 비교할 수 있다).
 */
export async function createOrder(
  cart: CartLine[],
  pay: PayKey,
  printReceipt: boolean,
  options: CallOptions = {},
): Promise<OrderResult> {
  const r = await postJson(
    "/api/orders",
    {
      items: cartToOrderItems(cart),
      payment_method: PAY[pay],
      pickup_type: "VIBRATION_BELL",
      print_receipt: printReceipt,
    },
    options,
  );
  if (!r.ok) return { kind: "fail", reason: r.reason };
  if (!r.data.order_number) return { kind: "fail", reason: "NO_ORDER_NUMBER" };
  return {
    kind: "ok",
    orderNumber: r.data.order_number,
    total: r.data.total_price ?? null,
  };
}

export type StampResult =
  { kind: "ok" } | { kind: "fail"; reason: string; added: number };

/**
 * 전화번호(4자리 또는 11자리 숫자)로 스탬프를 적립한다.
 * 서버가 1회 요청에 10개까지만 받으므로 많으면 나눠서 보낸다(중간에 실패하면 added에 적립된 수를 돌려준다).
 */
export async function addStamps(
  phone: string,
  count: number,
  options: CallOptions = {},
): Promise<StampResult> {
  let left = count;
  while (left > 0) {
    const n = Math.min(left, MAX_STAMPS_PER_REQUEST);
    const r = await postJson(
      "/api/stamps",
      { phone_number: phone, count: n },
      options,
    );
    if (!r.ok) return { kind: "fail", reason: r.reason, added: count - left };
    left -= n;
  }
  return { kind: "ok" };
}
