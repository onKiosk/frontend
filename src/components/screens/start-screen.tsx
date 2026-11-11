'use client';

import { MODES } from '@/data/menu';
import { useKioskStore } from '@/store/kiosk-store';
import { SelectButton } from '@/components/ui/select-button';

export function StartScreen({ onToggleListen }: { onToggleListen: () => void }) {
  const listening = useKioskStore((s) => s.listening);
  const transcript = useKioskStore((s) => s.transcript);
  const say = useKioskStore((s) => s.say);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[1.1em] px-[1.5em] py-[1.2em] text-center">
      <div>
        <div className="text-[2.2em] font-bold tracking-[-0.03em]">안녕하세요!</div>
        <div className="mt-[0.3em] text-[1.1em] font-semibold text-(--k-sub)">
          편한 방법을 골라 주세요
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleListen}
        aria-pressed={listening}
        className="h-[8.5em] w-[8.5em] rounded-full border-none text-[1.2em] font-bold leading-[1.3] text-(--k-ink-fg)"
        style={{
          background: listening ? 'var(--k-red)' : 'var(--k-ink)',
          animation: listening ? 'kpulse 1.2s infinite' : 'none',
        }}
      >
        {listening ? '듣고 있어요…' : '눌러서 말하기'}
      </button>

      <div className="min-h-[1.4em] text-[1em] font-bold">
        {transcript ? `“${transcript}”` : (say ?? '')}
      </div>
      <div className="rounded-[1em] bg-(--k-soft) px-[1em] py-[0.8em] text-[0.9em] font-semibold">
        예) “고대비 모드로 해 줘”, “따뜻한 라떼 주세요”
      </div>
      <div className="text-[0.78em] text-(--k-sub)">
        모드는 언제든 상단 [모드 변경]에서 바꿀 수 있어요
      </div>
    </div>
  );
}

export function StartFooter() {
  const mode = useKioskStore((s) => s.mode);
  const setMode = useKioskStore((s) => s.setMode);

  return (
    <div className="grid grid-cols-2 gap-[0.55em]">
      {MODES.map((m) => (
        <SelectButton
          key={m.key}
          selected={mode === m.key}
          onClick={() => setMode(m.key)}
          className="flex min-h-[4.6em] flex-col items-center justify-center gap-[0.15em] rounded-[1em] text-[1.02em]"
        >
          <span>{m.label}</span>
          <span className="text-[0.72em] font-semibold opacity-85">{m.sub}</span>
        </SelectButton>
      ))}
    </div>
  );
}
