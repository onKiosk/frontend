import { MENU_ITEMS, type ScreenKey } from "@/data/menu";
import type { CartLine } from "@/lib/pricing";
import type {
  ActionApiResponse,
  ActionContext,
  ServerAction,
  ServerCartItem,
} from "@/lib/action-types";

/**
 * 서버 호출 설정 (.env.local)
 *   NEXT_PUBLIC_ACTION_API_URL   예) http://localhost:8000   (비워 두면 서버를 쓰지 않고 기존 규칙만 사용)
 *   NEXT_PUBLIC_ACTION_TIMEOUT_MS 기본 4000 (서버 ONKIOSK_TIMEOUT_S보다 조금 크게)
 * 주의: https(Vercel) 페이지에서 http 주소를 부르면 mixed content로 막힌다.
 */
export const actionApiUrl = () =>
  (process.env.NEXT_PUBLIC_ACTION_API_URL ?? "").replace(/\/$/, "");
export const isActionApiEnabled = () => actionApiUrl() !== "";
const timeoutMs = () =>
  Number(process.env.NEXT_PUBLIC_ACTION_TIMEOUT_MS ?? 4000);

/**
 * 품절 목록을 프론트(menu.ts)에서 보낼지 여부.
 * true: 화면의 품절 표시와 서버 판단이 항상 같다 / false: 서버(DB) 값을 쓴다.
 * TODO(확인 필요): sold_out의 단일 출처를 DB로 통일할지 결정되면 false로 바꾼다.
 */
export const SEND_SOLD_OUT = true;

export const soldOutNames = () =>
  MENU_ITEMS.filter((i) => i.soldout).map((i) => i.name);

/** 100~999 → "A127" (데이터셋 주문번호 형식). 서버 create_order 발급값을 쓰게 되면 이 함수는 대체한다. */
export const formatOrderNumber = (orderNo: number) =>
  `A${String(orderNo).padStart(3, "0")}`;

/** 장바구니 한 줄 → 데이터셋 Context의 cart 항목 (옵션 상세는 생략: 데이터셋 Context도 대부분 생략) */
export function cartToContext(cart: CartLine[]): ServerCartItem[] {
  return cart.map((line) => {
    const base: ServerCartItem = { menu: line.name, quantity: line.qty };
    if (line.item.dessert) return base;
    if (line.draft.temp)
      base.temperature = line.draft.temp === "hot" ? "HOT" : "ICE";
    if (line.draft.size)
      base.size = line.draft.size === "large" ? "LARGE" : "REGULAR";
    return base;
  });
}

export interface ContextSource {
  screen: ScreenKey;
  cart: CartLine[];
  fails: number;
  orderNo: number;
}

/**
 * 프론트 상태 → 서버 Context.
 * screen은 프론트 이름(9종)을 그대로 보낸다(서버가 6종으로 바꾼다).
 * 키 구성은 데이터셋 Context와 같게 맞춘다(학습 때 보지 못한 키를 보내면 모델이 흔들릴 수 있음):
 *   menu/cart 계열 → cart, sold_out / point → payment_pending / pay → order_confirmed /
 *   receipt → payment_status / done → payment_status, order_number, pickup
 */
export function toContext(s: ContextSource): ActionContext {
  const ctx: ActionContext = { screen: s.screen };
  switch (s.screen) {
    case "start":
    case "menu":
    case "option":
    case "cart":
      ctx.cart = cartToContext(s.cart);
      if (SEND_SOLD_OUT) ctx.sold_out = soldOutNames();
      break;
    case "point":
      ctx.payment_pending = true;
      break;
    case "pay":
      ctx.order_confirmed = true;
      break;
    case "paying":
      ctx.order_confirmed = true;
      ctx.payment_pending = true;
      break;
    case "receipt":
      ctx.payment_status = "approved";
      break;
    case "done":
      ctx.payment_status = "approved";
      ctx.order_number = formatOrderNumber(s.orderNo);
      ctx.pickup = "VIBRATION_BELL";
      break;
  }
  if (s.fails > 0) ctx.recognition_failure_count = s.fails;
  return ctx;
}

export type ActionResult =
  | {
      kind: "action";
      action: ServerAction;
      answerText?: string;
      repairs: string[];
    }
  | { kind: "fallback"; reason: string };

/**
 * POST /api/action. 서버가 꺼져 있거나(설정 없음) 느리거나 실패하면 kind:'fallback'을 돌려주고,
 * 호출한 쪽이 기존 resolveIntent(정규식)로 처리한다. 이 함수는 예외를 던지지 않는다.
 */
export async function requestAction(
  userText: string,
  context: ActionContext,
  options: {
    timeoutMs?: number;
    sttLatencyMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<ActionResult> {
  if (!isActionApiEnabled()) return { kind: "fallback", reason: "DISABLED" };
  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? timeoutMs(),
  );
  try {
    const res = await doFetch(`${actionApiUrl()}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_text: userText,
        context,
        ...(options.sttLatencyMs !== undefined
          ? { stt_latency_ms: options.sttLatencyMs }
          : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { kind: "fallback", reason: `HTTP_${res.status}` };
    const data = (await res.json()) as ActionApiResponse;
    if (data.ok && !data.fallback && data.action) {
      return {
        kind: "action",
        action: data.action,
        answerText: data.answer_text ?? undefined,
        repairs: data.repairs ?? [],
      };
    }
    return { kind: "fallback", reason: data.error_code ?? "UNKNOWN" };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { kind: "fallback", reason: aborted ? "TIMEOUT" : "NETWORK" };
  } finally {
    clearTimeout(timer);
  }
}
