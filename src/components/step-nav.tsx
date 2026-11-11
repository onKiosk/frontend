"use client";

import { STEPS } from "@/data/menu";
import { useKioskStore } from "@/store/kiosk-store";

/** 데모용 단계 이동 바 — 실제 키오스크에는 없는, 화면을 바로 열어 보는 장치. */
export function StepNav() {
  const screen = useKioskStore((s) => s.screen);
  const jump = useKioskStore((s) => s.jump);

  return (
    <nav
      aria-label="데모 단계 이동"
      className="flex flex-wrap justify-center gap-1.5"
    >
      {STEPS.map(({ key, label }) => {
        const active =
          screen === key ||
          (key === "pay" && ["paying", "receipt"].includes(screen));
        return (
          <button
            key={key}
            type="button"
            onClick={() => jump(key)}
            aria-current={active ? "step" : undefined}
            className="rounded-full border border-[#55524E] px-3 py-1.5 text-[13px] font-semibold"
            style={{
              background: active ? "#F1EFEA" : "transparent",
              color: active ? "#1B1A18" : "#D8D5CF",
            }}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
