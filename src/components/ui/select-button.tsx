"use client";

import type { ButtonHTMLAttributes } from "react";
import { selectedStyle } from "@/lib/theme";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
}

/** 선택/미선택 상태를 가진 옵션 버튼 (온도, 사이즈, 카테고리, 모드…) */
export function SelectButton({
  selected,
  className = "",
  style,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`rounded-[0.8em] border-[1.5px] font-bold ${className}`}
      style={{ ...selectedStyle(selected), ...style }}
      {...rest}
    />
  );
}
