'use client';

import { won } from '@/lib/korean';
import { cartTotal, lineKey } from '@/lib/pricing';
import { useKioskStore } from '@/store/kiosk-store';
import { ActionButton, KioskButton } from '@/components/ui/kiosk-button';

export function CartScreen() {
  const cart = useKioskStore((s) => s.cart);
  const clearCart = useKioskStore((s) => s.clearCart);
  const changeLineQty = useKioskStore((s) => s.changeLineQty);
  const removeLine = useKioskStore((s) => s.removeLine);
  const editLine = useKioskStore((s) => s.editLine);

  return (
    <div className="flex flex-col gap-[0.6em] px-[1.1em] py-[1em]">
      <div className="flex items-center justify-between">
        <h2 className="text-[1.45em] font-bold tracking-[-0.02em]">주문을 확인해 주세요</h2>
        <KioskButton
          className="rounded-[0.7em] px-[0.8em] py-[0.4em] text-[0.8em]"
          onClick={clearCart}
        >
          전체 비우기
        </KioskButton>
      </div>

      {!cart.length && (
        <div className="py-[2.5em] text-center font-bold text-(--k-sub)">
          장바구니가 비어 있어요
        </div>
      )}

      {cart.map((line, index) => (
        <div
          key={lineKey(line)}
          className="flex flex-col gap-[0.55em] rounded-[1em] border-[1.5px] border-(--k-edge) bg-(--k-soft) px-[0.9em] py-[0.8em]"
        >
          <div className="flex justify-between gap-[0.6em]">
            <div className="min-w-0">
              <div className="text-[1.1em] font-bold">
                {line.name} × {line.qty}
              </div>
              <div className="mt-[0.2em] text-[0.8em] font-semibold text-(--k-sub)">
                {line.opt || '옵션 없음'}
              </div>
            </div>
            <div className="whitespace-nowrap font-bold">{won(line.unit * line.qty)}</div>
          </div>
          <div className="flex items-center gap-[0.4em]">
            <SquareButton label={`${line.name} 수량 줄이기`} onClick={() => changeLineQty(index, -1)}>
              −
            </SquareButton>
            <div className="min-w-[1.6em] text-center font-bold">{line.qty}</div>
            <SquareButton label={`${line.name} 수량 늘리기`} onClick={() => changeLineQty(index, 1)}>
              +
            </SquareButton>
            <div className="flex-1" />
            {!line.item.dessert && (
              <KioskButton
                className="h-[2.6em] rounded-[0.7em] px-[1em] text-[0.85em]"
                onClick={() => editLine(index)}
              >
                옵션 변경
              </KioskButton>
            )}
            <KioskButton
              className="h-[2.6em] rounded-[0.7em] px-[1em] text-[0.85em]"
              onClick={() => removeLine(index)}
            >
              삭제
            </KioskButton>
          </div>
        </div>
      ))}

      <div className="mt-[0.3em] flex justify-between border-t border-(--k-line) px-[0.2em] py-[0.6em] text-[1.2em] font-bold">
        <div>총 결제 금액</div>
        <div>{won(cartTotal(cart))}</div>
      </div>
    </div>
  );
}

function SquareButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <KioskButton
      aria-label={label}
      className="h-[2.6em] w-[2.6em] rounded-[0.7em]"
      onClick={onClick}
    >
      {children}
    </KioskButton>
  );
}

export function CartFooter() {
  const cart = useKioskStore((s) => s.cart);
  const go = useKioskStore((s) => s.go);
  const confirmCart = useKioskStore((s) => s.confirmCart);

  return (
    <div className="flex gap-[0.55em]">
      <ActionButton className="flex-1" onClick={() => go('menu')}>
        메뉴 더 담기
      </ActionButton>
      <ActionButton
        variant="primary"
        className="flex-[1.6]"
        style={{ opacity: cart.length ? 1 : 0.45 }}
        onClick={confirmCart}
      >
        네, 주문할게요
      </ActionButton>
    </div>
  );
}
