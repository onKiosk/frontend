'use client';

import { PAY_METHODS } from '@/data/menu';
import { cartSummary, payingCopy } from '@/lib/dialog';
import { payLabel } from '@/lib/intent';
import { won } from '@/lib/korean';
import { cartTotal } from '@/lib/pricing';
import { useKioskStore } from '@/store/kiosk-store';
import { ActionButton, KioskButton } from '@/components/ui/kiosk-button';

export function PayScreen() {
  const cart = useKioskStore((s) => s.cart);
  const startPay = useKioskStore((s) => s.startPay);

  return (
    <div className="flex flex-col gap-[0.9em] px-[1.1em] py-[1em]">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[1.45em] font-bold">결제 수단</h2>
        <div className="text-[1.2em] font-bold">{won(cartTotal(cart))}</div>
      </div>
      <p className="m-0 rounded-[0.8em] bg-(--k-soft) p-[0.8em] text-[0.85em] font-semibold">
        {cartSummary(cart) || '장바구니가 비어 있어요.'}
      </p>
      <div className="grid grid-cols-2 gap-[0.55em]">
        {PAY_METHODS.map((method) => (
          <KioskButton
            key={method.key}
            onClick={() => startPay(method.key)}
            className="flex min-h-[4.4em] flex-col items-center justify-center gap-[0.2em] text-[1.05em]"
          >
            <span>{method.label}</span>
            <span className="text-[0.7em] font-semibold text-(--k-sub)">{method.hint}</span>
          </KioskButton>
        ))}
      </div>
    </div>
  );
}

export function PayFooter() {
  const go = useKioskStore((s) => s.go);
  return (
    <>
      <ActionButton onClick={() => go('point')}>스탬프 적립하기</ActionButton>
      <div className="flex gap-[0.55em]">
        <ActionButton className="flex-1" onClick={() => go('cart')}>주문 확인·수정</ActionButton>
        <ActionButton className="flex-1" onClick={() => go('menu')}>메뉴 더 담기</ActionButton>
      </div>
    </>
  );
}

/** 기기의 물리적 위치(카드 삽입구·배출구)를 가리키는 표시 */
export function SlotMarker({ label, side }: { label: string; side: 'left' | 'right' }) {
  return (
    <div
      className="absolute bottom-[0.8em] flex flex-col items-center gap-[0.3em]"
      style={side === 'right' ? { right: '1.1em' } : { left: '1.1em' }}
    >
      <div
        className="rounded-[0.8em] bg-(--k-red) px-[0.9em] py-[0.55em] text-[0.85em] font-bold text-white"
        style={{ animation: 'kpulse 1.2s infinite' }}
      >
        {label}
      </div>
      <div aria-hidden className="text-[1.4em] font-bold leading-none text-(--k-red)">
        ▼
      </div>
    </div>
  );
}

export function PayingScreen() {
  const cart = useKioskStore((s) => s.cart);
  const pay = useKioskStore((s) => s.pay);
  const copy = payingCopy(pay);

  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center gap-[0.8em] p-[1.5em] text-center">
        <div className="text-[0.95em] font-bold text-(--k-sub)">
          {pay ? payLabel(pay) : ''} · {won(cartTotal(cart))}
        </div>
        <div className="text-[1.8em] font-bold tracking-[-0.02em] text-pretty">{copy.title}</div>
        <div className="text-[1em] font-semibold text-(--k-sub) text-pretty">{copy.body}</div>
        <div className="mt-[0.6em] text-[0.85em] font-bold">결제 대기 중…</div>
        <div className="text-[0.75em] text-(--k-sub)">데모 화면입니다. 실제 결제는 진행되지 않아요.</div>
      </div>
      <SlotMarker label={copy.slot} side="right" />
    </>
  );
}

export function PayingFooter() {
  const cancelPay = useKioskStore((s) => s.cancelPay);
  const completeDemoPay = useKioskStore((s) => s.completeDemoPay);
  return (
    <>
      <ActionButton variant="primary" onClick={completeDemoPay}>데모 결제 완료</ActionButton>
      <ActionButton onClick={cancelPay}>결제 취소</ActionButton>
    </>
  );
}
