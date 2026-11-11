"use client";

import { useKioskScale } from "@/hooks/use-kiosk-scale";
import { useSpeech } from "@/hooks/use-speech";
import { KioskFrame } from "@/components/kiosk-frame";
import { StepNav } from "@/components/step-nav";

export function KioskApp() {
  const scale = useKioskScale();
  const { toggleListen } = useSpeech();

  return (
    <main className="box-border flex min-h-screen flex-col items-center gap-3 px-2.5 pb-5 pt-3.5">
      <StepNav />
      <KioskFrame scale={scale} onToggleListen={toggleListen} />
    </main>
  );
}
