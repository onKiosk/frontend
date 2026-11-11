import type { ModeKey } from '@/data/menu';

/**
 * 원본 디자인의 light / contrast 팔레트.
 * CSS 변수로 주입해 Tailwind 임의값(`bg-(--k-soft)`)에서 그대로 쓴다.
 */
export interface KioskTheme {
  bg: string;
  surface: string;
  fg: string;
  sub: string;
  line: string;
  soft: string;
  edge: string;
  ink: string;
  inkFg: string;
  selBg: string;
  selFg: string;
  banner: string;
  bannerFg: string;
  red: string;
  fs: string;
}

export const THEMES: Record<'light' | 'contrast', KioskTheme> = {
  light: {
    bg: '#FFFFFF',
    surface: '#FFFFFF',
    fg: '#191F28',
    sub: '#4E5968',
    line: '#E5E8EB',
    soft: '#F2F4F6',
    edge: 'transparent',
    ink: '#3182F6',
    inkFg: '#FFFFFF',
    selBg: '#E8F3FF',
    selFg: '#1B64DA',
    banner: '#191F28',
    bannerFg: '#FFFFFF',
    red: '#D32F3C',
    fs: '17px',
  },
  contrast: {
    bg: '#000000',
    surface: '#000000',
    fg: '#FFFFFF',
    sub: '#E8E8E8',
    line: '#FFFFFF',
    soft: '#262626',
    edge: '#FFFFFF',
    ink: '#FFD400',
    inkFg: '#000000',
    selBg: '#FFD400',
    selFg: '#000000',
    banner: '#FFD400',
    bannerFg: '#000000',
    red: '#D0021B',
    fs: '21px',
  },
};

export const themeFor = (mode: ModeKey) => (mode === 'contrast' ? THEMES.contrast : THEMES.light);

/** 테마를 CSS 변수 묶음으로 — 루트 div의 style에 그대로 펼친다. */
export function themeVars(theme: KioskTheme) {
  return {
    '--k-bg': theme.bg,
    '--k-surface': theme.surface,
    '--k-fg': theme.fg,
    '--k-sub': theme.sub,
    '--k-line': theme.line,
    '--k-soft': theme.soft,
    '--k-edge': theme.edge,
    '--k-ink': theme.ink,
    '--k-ink-fg': theme.inkFg,
    '--k-sel-bg': theme.selBg,
    '--k-sel-fg': theme.selFg,
    '--k-banner': theme.banner,
    '--k-banner-fg': theme.bannerFg,
    '--k-red': theme.red,
  } as React.CSSProperties;
}

/** 선택 상태에 따른 배경/글자/테두리 — 원본 sel() 헬퍼. */
export function selectedStyle(on: boolean): React.CSSProperties {
  return on
    ? { background: 'var(--k-sel-bg)', color: 'var(--k-sel-fg)', borderColor: 'var(--k-ink)' }
    : { background: 'var(--k-soft)', color: 'var(--k-fg)', borderColor: 'var(--k-edge)' };
}
