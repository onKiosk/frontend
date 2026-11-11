'use client';

import { RECOGNITION_FAIL_CHIP, SAY_CHIPS } from '@/data/menu';
import { useKioskStore } from '@/store/kiosk-store';

/**
 * 마이크 없이도 흐름을 따라갈 수 있게 하는 데모 장치.
 * 칩을 누르면 그 문장을 말한 것으로 처리한다.
 */
export function SayChips() {
  const screen = useKioskStore((s) => s.screen);
  const handleUtterance = useKioskStore((s) => s.handleUtterance);

  const examples = SAY_CHIPS[screen];
  if (!examples.length) return null;

  const chips = ['paying', 'done'].includes(screen)
    ? examples
    : [...examples, RECOGNITION_FAIL_CHIP];

  return (
    <div className="flex flex-none flex-wrap items-center gap-[0.35em] bg-(--k-bg) px-[1.1em] py-[0.5em]">
      <div className="text-[0.7em] font-bold text-(--k-sub)">말해보기(데모)</div>
      {chips.map((text) => (
        <button
          key={text}
          type="button"
          onClick={() => handleUtterance(text === RECOGNITION_FAIL_CHIP ? '…' : text)}
          className="rounded-full border border-(--k-edge) bg-(--k-soft) px-[0.75em] py-[0.3em] text-[0.75em] font-semibold text-(--k-fg)"
        >
          “{text}”
        </button>
      ))}
    </div>
  );
}
