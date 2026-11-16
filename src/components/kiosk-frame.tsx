"use client";

import { themeFor, themeVars } from "@/lib/theme";
import { useKioskStore } from "@/store/kiosk-store";
import { KIOSK_HEIGHT, KIOSK_WIDTH } from "@/hooks/use-kiosk-scale";
import { ModeSelector } from "@/components/mode-selector";
import { StaffModal } from "@/components/staff-modal";
import { CartFooter, CartScreen } from "@/components/screens/cart-screen";
import { MenuFooter, MenuScreen } from "@/components/screens/menu-screen";
import { OptionFooter, OptionScreen } from "@/components/screens/option-screen";
import {
  PayFooter,
  PayScreen,
  PayingFooter,
  PayingScreen,
} from "@/components/screens/pay-screen";
import { PointFooter, PointScreen } from "@/components/screens/point-screen";
import {
  DoneFooter,
  DoneScreen,
  ReceiptFooter,
  ReceiptScreen,
} from "@/components/screens/receipt-screen";

interface Props {
  scale: number;
  onRetryListen: () => void;
}

/** 540×960 키오스크 화면 한 대. */
export function KioskFrame({ scale, onRetryListen }: Props) {
  const mode = useKioskStore((s) => s.mode);
  const callStaff = useKioskStore((s) => s.callStaff);

  const theme = themeFor(mode);
  const isLow = mode === "low";

  return (
    <div
      data-screen-label="Kiosk"
      className="relative flex flex-none flex-col overflow-hidden rounded-[18px] bg-(--k-bg) text-(--k-fg) shadow-[0_20px_60px_rgba(0,0,0,.45)] [font-variant-numeric:tabular-nums] tracking-[-0.005em]"
      style={{
        ...themeVars(theme),
        zoom: scale,
        width: KIOSK_WIDTH,
        height: KIOSK_HEIGHT,
        fontSize: theme.fs,
      }}
    >
      <header className="flex h-[3.4em] flex-none items-center justify-between border-b border-(--k-line) bg-(--k-surface) px-[1.1em]">
        <div className="text-[1.1em] font-bold tracking-[-0.02em]">
          온키오스크 카페
        </div>
      </header>

      {/* 모드 선택은 늘 보인다. 하단 모드에서는 손이 닿는 아래쪽으로 옮긴다. */}
      {!isLow && <ModeSelector className="mx-[1.1em] mt-[0.7em]" />}

      {/* 하단 모드: 손이 닿는 아래쪽으로 조작부를 몰아 준다 */}
      {isLow && (
        <div className="flex h-[8em] flex-none items-end justify-center pb-[0.7em] text-[0.85em] font-bold text-(--k-sub)">
          ↓ 모든 조작은 화면 아래쪽에서 할 수 있어요
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-auto">
        <ScreenBody />
      </div>

      <div className="flex flex-none flex-col gap-[0.55em] border-t border-(--k-line) bg-(--k-surface) px-[1.1em] py-[0.8em]">
        <ScreenFooter />
      </div>

      {isLow && (
        <ModeSelector className="border-t border-(--k-line) bg-(--k-surface) px-[1.1em] pb-[0.8em] pt-[0.6em]" />
      )}

      <button
        type="button"
        onClick={callStaff}
        className="min-h-[3.3em] flex-none border-none bg-(--k-red) text-[0.95em] font-bold text-white"
      >
        직원 호출 (“도와주세요”라고 말해도 돼요)
      </button>

      <StaffModal onRetryVoice={onRetryListen} />
    </div>
  );
}

function ScreenBody() {
  const screen = useKioskStore((s) => s.screen);

  switch (screen) {
    case "menu":
      return <MenuScreen />;
    case "option":
      return <OptionScreen />;
    case "cart":
      return <CartScreen />;
    case "point":
      return <PointScreen />;
    case "pay":
      return <PayScreen />;
    case "paying":
      return <PayingScreen />;
    case "receipt":
      return <ReceiptScreen />;
    case "done":
      return <DoneScreen />;
  }
}

function ScreenFooter() {
  const screen = useKioskStore((s) => s.screen);

  switch (screen) {
    case "menu":
      return <MenuFooter />;
    case "option":
      return <OptionFooter />;
    case "cart":
      return <CartFooter />;
    case "point":
      return <PointFooter />;
    case "pay":
      return <PayFooter />;
    case "paying":
      return <PayingFooter />;
    case "receipt":
      return <ReceiptFooter />;
    case "done":
      return <DoneFooter />;
  }
}
