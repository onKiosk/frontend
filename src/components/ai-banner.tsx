"use client";

import { bannerText } from "@/lib/dialog";
import { useDialogState, useKioskStore } from "@/store/kiosk-store";

type AiBannerProps = {
  onInterruptAndListen: () => void;
};

export function AiBanner({ onInterruptAndListen }: AiBannerProps) {
  const dialog = useDialogState();
  const listening = useKioskStore((state) => state.listening);
  const transcript = useKioskStore((state) => state.transcript);

  const guidance = bannerText(dialog);

  return (
    <section className="mx-auto flex w-full items-center gap-4 rounded-xl bg-black px-4 py-3 text-white">
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-semibold text-neutral-400">
          AI 음성 안내
        </p>

        <p className="text-sm font-medium leading-relaxed">
          {guidance}
        </p>

        {listening && (
          <p className="mt-1 text-xs text-green-300">
            {transcript
              ? `인식된 음성: ${transcript}`
              : "말씀을 듣고 있어요..."}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onInterruptAndListen}
        aria-label="음성 안내를 멈추고 사용자 음성 듣기"
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-white bg-black text-center text-xs font-bold text-white transition hover:bg-neutral-800 focus:outline-none focus:ring-4 focus:ring-white/40 active:scale-95"
      >
        <span className="leading-tight">
          음성
          <br />
          멈춤
        </span>
      </button>
    </section>
  );
}