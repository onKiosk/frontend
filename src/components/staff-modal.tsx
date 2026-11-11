'use client';

import { staffTexts } from '@/lib/dialog';
import { useKioskStore } from '@/store/kiosk-store';
import { ActionButton } from '@/components/ui/kiosk-button';

/** 직원 호출 · 음성 인식 실패 시 뜨는 시트 */
export function StaffModal({ onRetryVoice }: { onRetryVoice: () => void }) {
  const staff = useKioskStore((s) => s.staff);
  const callStaff = useKioskStore((s) => s.callStaff);
  const closeStaff = useKioskStore((s) => s.closeStaff);

  if (!staff) return null;
  const [title, body] = staffTexts(staff);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="absolute inset-0 box-border flex items-end bg-black/56 p-[1.1em]"
    >
      <div className="mb-[3.2em] flex w-full flex-col gap-[0.8em] rounded-[1.25em] border-[1.5px] border-(--k-fg) bg-(--k-surface) px-[1.2em] pb-[1.1em] pt-[1.4em] text-(--k-fg) shadow-[0_12px_32px_rgba(2,18,48,.10),0_2px_6px_rgba(2,18,48,.06)]">
        <div className="text-[1.45em] font-bold tracking-[-0.02em]">{title}</div>
        <div className="text-[1em] font-semibold text-(--k-sub) text-pretty">{body}</div>

        {staff === 'fail' && (
          <div className="flex gap-[0.55em]">
            <ActionButton className="flex-1 text-[1.05em]" onClick={onRetryVoice}>
              다시 말하기
            </ActionButton>
            <ActionButton variant="danger" className="flex-1 text-[1.05em]" onClick={callStaff}>
              직원 호출
            </ActionButton>
          </div>
        )}

        {staff === 'called' && (
          <ActionButton variant="primary" className="text-[1.05em]" onClick={closeStaff}>
            닫기
          </ActionButton>
        )}
      </div>
    </div>
  );
}
