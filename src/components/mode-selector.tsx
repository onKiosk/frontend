"use client";

import { MODES } from "@/data/menu";
import { useKioskStore } from "@/store/kiosk-store";
import { SelectButton } from "@/components/ui/select-button";

/** 음성 모드는 화면 버튼으로 고르지 않고 말로만 켠다. */
const VISIBLE_MODES = MODES.filter((m) => m.key !== "voice");

/**
 * 화면 모드 선택 바. 어느 화면에서든 항상 보여서
 * 주문 도중에도 한 번에 모드를 바꿀 수 있다.
 */
export function ModeSelector({ className = "" }: { className?: string }) {
  const mode = useKioskStore((s) => s.mode);
  const setMode = useKioskStore((s) => s.setMode);

  return (
    <div
      role="group"
      aria-label="화면 모드"
      className={`grid flex-none grid-cols-3 gap-[0.35em] ${className}`}
    >
      {VISIBLE_MODES.map((m) => (
        <SelectButton
          key={m.key}
          selected={mode === m.key}
          onClick={() => setMode(m.key)}
          className="flex min-h-[3.2em] flex-col items-center justify-center gap-[0.1em] px-[0.2em] py-[0.3em] text-[0.8em] leading-[1.2]"
        >
          <span>{m.short}</span>
          <span className="text-[0.78em] font-semibold opacity-80">
            {m.sub}
          </span>
        </SelectButton>
      ))}
    </div>
  );
}
