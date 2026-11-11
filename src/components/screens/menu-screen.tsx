"use client";

import { CATEGORIES, MENU_ITEMS } from "@/data/menu";
import { won } from "@/lib/korean";
import { cartCount, cartTotal } from "@/lib/pricing";
import { useKioskStore } from "@/store/kiosk-store";
import { ActionButton } from "@/components/ui/kiosk-button";
import { SelectButton } from "@/components/ui/select-button";

/** 사진이 들어갈 자리 — 데모라서 사선 패턴으로 대체한다. */
const photoStyle = {
  background:
    "repeating-linear-gradient(135deg,var(--k-soft) 0 6px,var(--k-bg) 6px 12px)",
} as const;

export function MenuScreen() {
  const cat = useKioskStore((s) => s.cat);
  const mode = useKioskStore((s) => s.mode);
  const transcript = useKioskStore((s) => s.transcript);
  const recommended = useKioskStore((s) => s.recommended);
  const setCategory = useKioskStore((s) => s.setCategory);
  const tapItem = useKioskStore((s) => s.tapItem);

  const items = MENU_ITEMS.filter((i) => i.cat === cat);
  const cols = mode === "contrast" ? 2 : 3;

  return (
    <div className="flex flex-col gap-[0.8em] px-[1.1em] py-[0.9em]">
      <div
        className="min-h-[1.4em] rounded-[1em] border-[1.5px] border-(--k-edge) bg-(--k-soft) px-[1em] py-[0.7em] text-[1em] font-bold"
        style={{ color: transcript ? "var(--k-fg)" : "var(--k-sub)" }}
      >
        {transcript
          ? `“${transcript}”`
          : "“아메리카노 하나 주세요”처럼 말해 보세요"}
      </div>

      <div className="flex gap-[0.35em]" role="tablist" aria-label="메뉴 종류">
        {CATEGORIES.map((c) => (
          <SelectButton
            key={c.key}
            selected={cat === c.key}
            onClick={() => setCategory(c.key)}
            className="min-h-[2.9em] flex-1 p-0 text-[0.92em]"
          >
            {c.label}
          </SelectButton>
        ))}
      </div>

      <div
        className="grid gap-[0.55em]"
        style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` }}
      >
        {items.map((item) => {
          const isRecommended = recommended === item.name;
          const badge = item.soldout ? "품절" : isRecommended ? "추천" : null;
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => tapItem(item)}
              aria-disabled={item.soldout}
              className="relative flex flex-col gap-[0.4em] rounded-[1em] border-[1.5px] bg-(--k-soft) p-[0.5em] text-left text-(--k-fg)"
              style={{
                borderColor: isRecommended ? "var(--k-ink)" : "var(--k-edge)",
                opacity: item.soldout ? 0.45 : 1,
              }}
            >
              <div
                className="flex aspect-[4/3] w-full items-center justify-center rounded-[0.7em] font-mono text-[0.6em] text-(--k-sub)"
                style={photoStyle}
              >
                메뉴 사진
              </div>
              <div className="text-[0.92em] font-bold leading-[1.25]">
                {item.name}
              </div>
              <div className="text-[0.8em] font-bold text-(--k-sub)">
                {won(item.price)}
              </div>
              {badge && (
                <div
                  className="absolute right-[0.8em] top-[0.8em] rounded-[0.4em] px-[0.5em] py-[0.2em] text-[0.7em] font-bold"
                  style={{
                    background: item.soldout ? "var(--k-fg)" : "var(--k-ink)",
                    color: item.soldout ? "var(--k-bg)" : "#fff",
                  }}
                >
                  {badge}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MenuFooter() {
  const cart = useKioskStore((s) => s.cart);
  const go = useKioskStore((s) => s.go);

  const lastLine = cart.length
    ? cart
        .map((l) => `${l.name}${l.opt ? ` (${l.opt})` : ""} × ${l.qty}`)
        .join(", ")
    : "아직 담은 메뉴가 없어요";

  return (
    <>
      <div className="rounded-[1em] border-[1.5px] border-(--k-line) px-[0.9em] py-[0.6em]">
        <div className="font-bold">
          장바구니 {cartCount(cart)}개 · {won(cartTotal(cart))}
        </div>
        <div className="mt-[0.15em] text-[0.78em] font-semibold text-(--k-sub)">
          {lastLine}
        </div>
      </div>
      <div className="flex gap-[0.55em]">
        <ActionButton className="flex-1" onClick={() => go("cart")}>
          장바구니 보기
        </ActionButton>
        <ActionButton
          variant="primary"
          className="flex-1"
          onClick={() => go("cart")}
        >
          주문하기
        </ActionButton>
      </div>
    </>
  );
}
