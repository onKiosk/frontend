"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "soft" | "primary" | "danger";

const VARIANT: Record<Variant, string> = {
  soft: "border-[1.5px] border-(--k-edge) bg-(--k-soft) text-(--k-fg)",
  primary: "border-none bg-(--k-ink) text-(--k-ink-fg)",
  danger: "border-none bg-(--k-red) text-white",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/** 키오스크 기본 버튼 — 손가락으로 누를 수 있는 크기를 기본값으로 잡는다. */
export function KioskButton({
  variant = "soft",
  className = "",
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`rounded-[1em] font-bold leading-tight ${VARIANT[variant]} ${className}`}
      {...rest}
    />
  );
}

/** 액션 바에 들어가는 큰 버튼 */
export function ActionButton({ className = "", ...rest }: Props) {
  return (
    <KioskButton
      className={`min-h-[4em] text-[1.1em] ${className}`}
      {...rest}
    />
  );
}
