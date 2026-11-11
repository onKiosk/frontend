'use client';

import { useEffect, useState } from 'react';

export const KIOSK_WIDTH = 540;
export const KIOSK_HEIGHT = 960;

/**
 * 540×960 키오스크 화면을 창 크기에 맞춰 축소/확대하는 배율.
 * 서버 렌더와 어긋나지 않도록 1로 시작해 마운트 후 재계산한다.
 */
export function useKioskScale() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const measure = () =>
      setScale(
        Math.max(
          0.4,
          Math.min(
            (window.innerWidth - 20) / KIOSK_WIDTH,
            (window.innerHeight - 70) / KIOSK_HEIGHT,
            1.3,
          ),
        ),
      );
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return scale;
}
