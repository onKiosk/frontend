'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ICE_LEVELS, LARGE_SURCHARGE, type IceKey, type SizeKey, type TempKey } from '@/data/menu';
import { won } from '@/lib/korean';
import { extrasFor, missingOption, unitPrice, type OptionDraft } from '@/lib/pricing';
import { optionSchema, type OptionForm } from '@/lib/schemas';
import { useKioskStore } from '@/store/kiosk-store';
import { ActionButton } from '@/components/ui/kiosk-button';
import { SelectButton } from '@/components/ui/select-button';

const OPTION_FORM_ID = 'option-form';

const photoStyle = {
  background: 'repeating-linear-gradient(135deg,var(--k-soft) 0 6px,var(--k-bg) 6px 12px)',
} as const;

const toFormValues = (draft: OptionDraft): OptionForm => ({
  dessert: draft.item.dessert,
  temp: draft.temp,
  size: draft.size,
  ice: draft.ice,
  qty: draft.qty,
});

/**
 * 옵션 선택 화면.
 * 값은 스토어의 draft가 단일 출처이고(음성으로도 바뀌니까),
 * react-hook-form은 zod 스키마로 "담기" 시점을 검증하는 역할만 맡는다.
 */
export function OptionScreen() {
  const draft = useKioskStore((s) => s.draft);
  const updateDraft = useKioskStore((s) => s.updateDraft);
  const addDraftToCart = useKioskStore((s) => s.addDraftToCart);

  const {
    handleSubmit,
    formState: { errors },
  } = useForm<OptionForm>({
    resolver: zodResolver(optionSchema),
    values: draft ? toFormValues(draft) : undefined,
  });

  if (!draft) return null;
  const { item } = draft;

  const tempOptions: { key: TempKey; label: string }[] = item.iceOnly
    ? [{ key: 'ice', label: 'ICE 차갑게' }]
    : [
        { key: 'hot', label: 'HOT 따뜻하게' },
        { key: 'ice', label: 'ICE 차갑게' },
      ];

  const sizeOptions: { key: SizeKey; label: string }[] = [
    { key: 'regular', label: '레귤러' },
    { key: 'large', label: `라지 (+${LARGE_SURCHARGE}원)` },
  ];

  const tempNote = item.iceOnly
    ? 'ICE만 가능해요'
    : (errors.temp?.message ?? (draft.temp ? '' : '선택해 주세요'));
  const sizeNote = errors.size?.message ?? (draft.size ? '' : '선택해 주세요');

  return (
    <form
      id={OPTION_FORM_ID}
      onSubmit={handleSubmit(() => addDraftToCart())}
      className="flex flex-col gap-[1em] px-[1.1em] py-[1em]"
    >
      <div className="flex items-center gap-[1em]">
        <div className="h-[4.8em] w-[4.8em] flex-none rounded-[0.8em]" style={photoStyle} />
        <div className="flex-1">
          <div className="text-[1.4em] font-bold">{item.name}</div>
          <div className="mt-[0.2em] font-bold text-(--k-sub)">
            {won(unitPrice(draft) * draft.qty)}
          </div>
        </div>
        <div className="flex items-center gap-[0.4em]">
          <QtyButton
            label="수량 줄이기"
            symbol="−"
            onClick={() => updateDraft({ qty: Math.max(1, draft.qty - 1) })}
          />
          <div className="min-w-[1.6em] text-center text-[1.15em] font-bold">{draft.qty}</div>
          <QtyButton
            label="수량 늘리기"
            symbol="+"
            onClick={() => updateDraft({ qty: Math.min(9, draft.qty + 1) })}
          />
        </div>
      </div>

      {!item.dessert && (
        <>
          <OptionGroup title="온도" note={tempNote}>
            {tempOptions.map((o) => (
              <SelectButton
                key={o.key}
                selected={draft.temp === o.key}
                onClick={() => updateDraft({ temp: o.key })}
                className="min-h-[3em] flex-1 px-[0.3em] text-[0.95em]"
              >
                {o.label}
              </SelectButton>
            ))}
          </OptionGroup>

          <OptionGroup title="사이즈" note={sizeNote}>
            {sizeOptions.map((o) => (
              <SelectButton
                key={o.key}
                selected={draft.size === o.key}
                onClick={() => updateDraft({ size: o.key })}
                className="min-h-[3em] flex-1 px-[0.3em] text-[0.95em]"
              >
                {o.label}
              </SelectButton>
            ))}
          </OptionGroup>

          {draft.temp === 'ice' && (
            <OptionGroup title="얼음 양" note="">
              {ICE_LEVELS.map((o) => (
                <SelectButton
                  key={o.key}
                  selected={draft.ice === o.key}
                  onClick={() => updateDraft({ ice: o.key as IceKey })}
                  className="min-h-[3em] flex-1 px-[0.3em] text-[0.95em]"
                >
                  {o.label}
                </SelectButton>
              ))}
            </OptionGroup>
          )}
        </>
      )}
    </form>
  );
}

function OptionGroup({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-[0.45em] border-none p-0">
      <legend className="flex gap-[0.5em] p-0">
        <span className="text-[0.95em] font-bold">{title}</span>
        {note && <span className="text-[0.78em] font-bold text-(--k-red)">{note}</span>}
      </legend>
      <div className="flex gap-[0.45em]">{children}</div>
    </fieldset>
  );
}

function QtyButton({
  label,
  symbol,
  onClick,
}: {
  label: string;
  symbol: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="h-[2.6em] w-[2.6em] rounded-[0.7em] border-[1.5px] border-(--k-edge) bg-(--k-soft) text-[1em] font-bold text-(--k-fg)"
    >
      {symbol}
    </button>
  );
}

export function OptionFooter() {
  const draft = useKioskStore((s) => s.draft);
  const editIndex = useKioskStore((s) => s.editIndex);
  const toggleExtra = useKioskStore((s) => s.toggleExtra);
  const go = useKioskStore((s) => s.go);

  if (!draft) return null;
  const extras = extrasFor(draft.item);
  const blocked = missingOption(draft) !== null;

  return (
    <>
      {extras.length > 0 && (
        <>
          <div className="text-[0.9em] font-bold">추가 옵션</div>
          <div className="flex gap-[0.4em]">
            {extras.map((extra) => (
              <SelectButton
                key={extra.key}
                selected={!!draft.extras[extra.key]}
                onClick={() => toggleExtra(extra.key)}
                className="flex min-h-[3.2em] flex-1 flex-col items-center justify-center px-[0.2em] text-[0.82em] leading-[1.2]"
              >
                <span>{extra.label}</span>
                <span className="text-[0.85em] font-semibold opacity-80">
                  {extra.price ? `+${extra.price}원` : '무료'}
                </span>
              </SelectButton>
            ))}
          </div>
        </>
      )}
      <div className="flex gap-[0.55em]">
        <ActionButton className="flex-1" onClick={() => go('menu')}>
          이전
        </ActionButton>
        <ActionButton
          type="submit"
          form={OPTION_FORM_ID}
          variant="primary"
          className="flex-[2.2]"
          style={{ opacity: blocked ? 0.45 : 1 }}
        >
          {editIndex >= 0 ? '변경 완료' : '장바구니에 담기'}
        </ActionButton>
      </div>
    </>
  );
}
