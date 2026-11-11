'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { formatPhone } from '@/lib/dialog';
import { phoneSchema, type PhoneForm } from '@/lib/schemas';
import { useKioskStore } from '@/store/kiosk-store';
import { ActionButton, KioskButton } from '@/components/ui/kiosk-button';

const POINT_FORM_ID = 'point-form';

/** 표시 라벨 → pressPhoneKey에 넘길 키 */
const KEYS: { label: string; value: string }[] = [
  ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => ({ label: d, value: d })),
  { label: '지움', value: 'back' },
  { label: '0', value: '0' },
  { label: '전체 삭제', value: 'clear' },
];

/**
 * 스탬프 적립 화면.
 * 키패드로만 입력하지만 값 검증은 zod 스키마 + react-hook-form이 맡는다
 * (뒷자리 4자리 또는 전체 11자리).
 */
export function PointScreen() {
  const phone = useKioskStore((s) => s.phone);
  const pressPhoneKey = useKioskStore((s) => s.pressPhoneKey);
  const savePoint = useKioskStore((s) => s.savePoint);

  const {
    handleSubmit,
    formState: { errors, isSubmitted },
  } = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    values: { phone },
  });

  const error = isSubmitted ? errors.phone?.message : undefined;

  return (
    <form
      id={POINT_FORM_ID}
      onSubmit={handleSubmit((values) => savePoint(values.phone))}
      className="flex flex-col gap-[0.8em] px-[1.1em] py-[1em]"
    >
      <div>
        <h2 className="text-[1.45em] font-bold">스탬프를 적립할까요?</h2>
        <p className="mt-[0.25em] text-[0.85em] font-semibold text-(--k-sub)">
          전화번호 전체 또는 뒷자리 4자리를 입력해 주세요 · 음료 1잔당 스탬프 1개
        </p>
      </div>

      <output
        htmlFor="phone-keypad"
        className="block rounded-[1em] border-[1.5px] border-(--k-edge) bg-(--k-soft) px-[1em] py-[0.7em] text-center text-[1.6em] font-bold tracking-[0.05em]"
        style={{ color: phone ? 'var(--k-fg)' : 'var(--k-sub)' }}
      >
        {formatPhone(phone)}
      </output>

      {error && (
        <p role="alert" className="text-[0.85em] font-bold text-(--k-red)">
          {error}
        </p>
      )}

      <div id="phone-keypad" className="grid grid-cols-3 gap-[0.45em]">
        {KEYS.map((key) => (
          <KioskButton
            key={key.value}
            onClick={() => pressPhoneKey(key.value)}
            className={`min-h-[3.3em] rounded-[0.8em] ${
              /\d/.test(key.label) ? 'text-[1.4em]' : 'text-[0.9em]'
            }`}
          >
            {key.label}
          </KioskButton>
        ))}
      </div>
    </form>
  );
}

export function PointFooter() {
  const phone = useKioskStore((s) => s.phone);
  const skipPoint = useKioskStore((s) => s.skipPoint);

  const ready = phone.length === 4 || phone.length === 11;

  return (
    <div className="flex gap-[0.55em]">
      <ActionButton className="flex-1" onClick={skipPoint}>
        적립 안 함
      </ActionButton>
      <ActionButton
        type="submit"
        form={POINT_FORM_ID}
        variant="primary"
        className="flex-[1.6]"
        style={{ opacity: ready ? 1 : 0.45 }}
      >
        적립하기
      </ActionButton>
    </div>
  );
}
