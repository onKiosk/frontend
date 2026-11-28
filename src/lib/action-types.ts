/**
 * 서버(POST /api/action)와 주고받는 타입. 서버 app/schemas.py와 1:1로 맞춘다.
 * Action을 추가/변경하면 서버 schemas.py와 apply-action.ts를 함께 고칠 것.
 */

export type ServerTemperature = "HOT" | "ICE";
export type ServerSize = "REGULAR" | "LARGE";
export type ServerIce = "NORMAL" | "LESS" | "NONE" | "MORE";
export type ServerStrength = "NORMAL" | "LIGHT";
export type ServerMilk = "REGULAR" | "SOY" | "OAT";

export interface ServerItemOptions {
  ice?: ServerIce;
  shot?: number;
  syrup?: number;
  strength?: ServerStrength;
  milk?: ServerMilk;
}

export interface ServerCartItem {
  menu: string;
  quantity: number;
  temperature?: ServerTemperature;
  size?: ServerSize;
  options?: ServerItemOptions;
}

export interface ServerCartChanges {
  quantity?: number;
  temperature?: ServerTemperature;
  size?: ServerSize;
  ice?: ServerIce;
  shot?: number;
  syrup?: number;
  strength?: ServerStrength;
  milk?: ServerMilk;
}

export type ServerPayMethod =
  "CARD" | "SAMSUNG_PAY" | "KAKAO_PAY" | "NAVER_PAY" | "APPLE_PAY" | "CASH";

export type ServerAction =
  | { action: "add_to_cart"; items: ServerCartItem[] }
  | {
      action: "ask_clarification";
      field: "temperature" | "size";
      item: string;
      choices: string[];
    }
  | { action: "recommend_menu"; items: string[]; confirmation_required: true }
  | { action: "show_cart" }
  | { action: "modify_cart"; target: string; changes: ServerCartChanges }
  | { action: "remove_from_cart"; target: string }
  | { action: "reset_order" }
  | { action: "confirm_order"; summary_required: true }
  | { action: "inform_sold_out"; item: string; alternatives: string[] }
  | { action: "show_category"; category: "COFFEE" | "NON_COFFEE" | "DESSERT" }
  | { action: "start_payment"; method: ServerPayMethod }
  | { action: "open_loyalty_input"; input_mode: "KEYPAD" | "LAST4_KEYPAD" }
  | { action: "open_coupon_list" }
  | { action: "set_receipt"; print: boolean }
  | {
      action: "announce_order";
      order_number: string;
      pickup: "VIBRATION_BELL" | "DINE_IN" | "TAKEOUT";
    }
  | {
      action: "set_accessibility";
      mode: "LOWER_TOUCH" | "HIGH_CONTRAST" | "VOICE_GUIDE";
    }
  | {
      action: "call_staff";
      reason:
        | "USER_REQUESTED_ASSISTANCE"
        | "VOICE_RECOGNITION_FAILED_TWICE"
        | "KIOSK_MALFUNCTION";
    }
  | { action: "no_action"; reason: "OUT_OF_DOMAIN" | "NO_COMMAND" }
  // v5.5 합의안 추가 Action (필드명은 v5.5 엑셀 확인 필요)
  | { action: "answer_question"; topic: string; answer_code: string };

/** 서버로 보내는 Context. 화면별로 데이터셋 Context와 같은 키만 담는다. */
export interface ActionContext {
  screen: string;
  cart?: ServerCartItem[];
  sold_out?: string[];
  recognition_failure_count?: number;
  payment_pending?: boolean;
  order_confirmed?: boolean;
  payment_status?: "approved";
  order_number?: string;
  pickup?: "VIBRATION_BELL";
}

export interface ActionApiResponse {
  ok: boolean;
  fallback: boolean;
  action: ServerAction | null;
  error_code?: string | null;
  detail?: string | null;
  answer_text?: string | null;
  repairs?: string[];
  source?: "model" | "rule";
  screen?: string | null;
  llm_latency_ms?: number | null;
}
