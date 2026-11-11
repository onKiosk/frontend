"use client";

import { won } from "@/lib/korean";
import { cartTotal } from "@/lib/pricing";
import { useKioskStore } from "@/store/kiosk-store";
import { ActionButton } from "@/components/ui/kiosk-button";
import { SlotMarker } from "@/components/screens/pay-screen";

export function ReceiptScreen() {
  const cart = useKioskStore((s) => s.cart);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[0.7em] p-[1.5em] text-center">
      <div className="text-[1em] font-bold text-(--k-sub)">
        결제 완료 · {won(cartTotal(cart))}
      </div>
      <div className="text-[2em] font-bold tracking-[-0.02em]">
        영수증을 출력할까요?
      </div>
    </div>
  );
}

export function ReceiptFooter() {
  const finish = useKioskStore((s) => s.finish);
  return (
    <div className="flex gap-[0.55em]">
      <ActionButton className="flex-1" onClick={() => finish(false)}>
        출력 안 함
      </ActionButton>
      <ActionButton
        variant="primary"
        className="flex-1"
        onClick={() => finish(true)}
      >
        영수증 출력
      </ActionButton>
    </div>
  );
}

export function DoneScreen() {
  const orderNo = useKioskStore((s) => s.orderNo);
  const receipt = useKioskStore((s) => s.receipt);
  const stamp = useKioskStore((s) => s.stamp);

  const notes = [
    receipt ? "영수증이 출력됐어요" : "영수증 미출력",
    ...(stamp ? [`스탬프 ${stamp}개 적립`] : []),
  ];

  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center gap-[0.6em] p-[1.5em] text-center">
        <div className="text-[1.1em] font-bold text-(--k-sub)">
          주문이 완료됐어요
        </div>
        <div className="text-[0.95em] font-bold">주문번호</div>
        <div className="text-[5.5em] font-bold leading-none tracking-[-0.03em]">
          {orderNo}
        </div>
        <div className="mt-[0.4em] text-[1.3em] font-bold">
          진동벨을 가져가 주세요
        </div>
        <div className="text-[0.95em] font-semibold text-(--k-sub) text-pretty">
          벨이 울리면 픽업대로 와 주세요
        </div>
        {notes.map((note) => (
          <div
            key={note}
            className="rounded-full bg-(--k-soft) px-[0.9em] py-[0.4em] text-[0.85em] font-bold"
          >
            {note}
          </div>
        ))}
      </div>
      <SlotMarker label="진동벨 배출구" side="left" />
    </>
  );
}

export function DoneFooter() {
  const reset = useKioskStore((s) => s.reset);
  return (
    <ActionButton variant="primary" onClick={reset}>
      처음으로
    </ActionButton>
  );
}
