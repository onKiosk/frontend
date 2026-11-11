'use client';

import { bannerText } from '@/lib/dialog';
import { useDialogState, useKioskStore } from '@/store/kiosk-store';

const BARS = [0.5, 0.8, 1, 0.7, 0.9, 0.6, 1, 0.75, 0.55];

/** 듣고 있을 때의 파형 */
function VoiceWave() {
  return (
    <div aria-hidden className="flex h-[34px] flex-none items-center gap-[3px]">
      {BARS.map((height, i) => (
        <div
          key={i}
          className="w-1 rounded-[2px] bg-(--k-banner-fg)"
          style={{ height: 34 * height, animation: `kwave .9s ease-in-out ${i * 0.08}s infinite` }}
        />
      ))}
    </div>
  );
}

/**
 * 화면 상단의 AI 안내 배너. 말하는 내용을 그대로 자막으로 띄운다
 * — 음성 안내를 듣지 못하는 사람도 같은 정보를 받게 하려고.
 */
export function AiBanner({ onToggleListen }: { onToggleListen: () => void }) {
  const dialog = useDialogState();
  const listening = useKioskStore((s) => s.listening);
  const voicePaused = useKioskStore((s) => s.voicePaused);
  const transcript = useKioskStore((s) => s.transcript);

  return (
    <div
      className="mx-[1.1em] mt-[0.7em] box-border flex min-h-[4.6em] flex-none items-center gap-[0.9em] rounded-[1.1em] bg-(--k-banner) px-[1.1em] py-[0.9em] text-(--k-banner-fg)"
      role="status"
      aria-live="polite"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-[0.25em] text-[0.72em] font-bold opacity-85">
          {transcript ? `“${transcript}”` : dialog.mode === 'voice'
            ? voicePaused ? '자동 듣기 일시 정지' : '음성 모드 · 안내 후 자동으로 들어요'
            : 'AI 안내 · 음성 + 자막'}
        </div>
        <div className="text-[1.15em] font-bold leading-[1.35] tracking-[-0.02em] text-pretty">
          {listening ? '듣고 있어요…' : bannerText(dialog)}
        </div>
      </div>
      {listening && <VoiceWave />}
      <button
        type="button"
        onClick={onToggleListen}
        aria-pressed={dialog.mode === 'voice' ? !voicePaused : listening}
        className="h-[4.4em] w-[4.4em] flex-none rounded-full border-[1.5px] border-(--k-banner-fg) text-[0.78em] font-bold leading-[1.15]"
        style={{
          background: listening ? 'var(--k-red)' : 'transparent',
          color: listening ? '#fff' : 'var(--k-banner-fg)',
        }}
      >
        {dialog.mode === 'voice'
          ? voicePaused ? '다시 듣기' : '음성 멈추기'
          : listening ? '멈추기' : '눌러서 말하기'}
      </button>
    </div>
  );
}
