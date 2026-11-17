"use client";

import { bannerText } from "@/lib/dialog";
import { useDialogState, useKioskStore } from "@/store/kiosk-store";

type AiBannerProps = {
  isSpeaking: boolean;
  onToggleGuidance: () => void;
};

export function AiBanner({ isSpeaking, onToggleGuidance }: AiBannerProps) {
  const dialog = useDialogState();
  const listening = useKioskStore((state) => state.listening);
  const transcript = useKioskStore((state) => state.transcript);

  const guidance = bannerText(dialog);

  return (
    <section className="mx-auto flex w-full items-center gap-4 rounded-xl bg-black px-4 py-3 text-white">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold">
          <span className="text-neutral-400">AI 음성 안내</span>
          {listening && (
            <span className="inline-flex items-center gap-1 text-green-300">
              <span
                aria-hidden
                className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-400"
              />
              말씀을 듣고 있어요...
            </span>
          )}
        </div>

        <p className="text-sm font-medium leading-relaxed">{guidance}</p>

        {transcript && (
          <p className="mt-1 text-xs text-sky-300">
            인식된 음성: “{transcript}”
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onToggleGuidance}
        aria-label={
          isSpeaking
            ? "음성 안내를 멈추고 사용자 음성 듣기"
            : "멈춘 부분부터 안내 음성 다시 듣기"
        }
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-white bg-black text-center text-xs font-bold text-white transition hover:bg-neutral-800 focus:outline-none focus:ring-4 focus:ring-white/40 active:scale-95"
      >
        {isSpeaking ? (
          <span className="leading-tight">
            음성
            <br />
            멈춤
          </span>
        ) : (
          <span className="leading-tight">
            다시
            <br />
            듣기
          </span>
        )}
      </button>
    </section>
  );
}
