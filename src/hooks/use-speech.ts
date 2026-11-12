"use client";

import { useCallback, useEffect, useRef } from "react";
import { spokenText, staffTexts } from "@/lib/dialog";
import { SpeechSession } from "@/lib/speech-session";
import { useKioskStore } from "@/store/kiosk-store";

/** 모든 모드에서 안내가 끝날 때마다 다음 발화를 자동으로 기다린다. */
export function useSpeech({
  alwaysSpeak = false,
}: { alwaysSpeak?: boolean } = {}) {
  const session = useRef<SpeechSession | null>(null);

  useEffect(() => {
    const controller = new SpeechSession({
      createRecognition: () => {
        const Recognition =
          window.SpeechRecognition ?? window.webkitSpeechRecognition;
        return Recognition ? new Recognition() : null;
      },
      speak: (text, done) => {
        if (!window.speechSynthesis) {
          done();
          return () => {};
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "ko-KR";
        utterance.rate = 1.05;
        utterance.onend = done;
        utterance.onerror = done;
        window.speechSynthesis.speak(utterance);
        return () => {
          utterance.onend = utterance.onerror = null;
          window.speechSynthesis.cancel();
        };
      },
      onListening: (listening) =>
        useKioskStore.getState().setListening(listening),
      onPaused: (voicePaused) => useKioskStore.setState({ voicePaused }),
      onTranscript: (text) => useKioskStore.getState().setTranscript(text),
      onUtterance: (text) => useKioskStore.getState().handleUtterance(text),
      onError: (message) => useKioskStore.getState().noteVoiceError(message),
    });
    session.current = controller;
    const sync = () => {
      const state = useKioskStore.getState();
      controller.update({
        automatic: true,
        speak: state.mode === "voice" || alwaysSpeak,
        text: state.staff
          ? staffTexts(state.staff).join(". ")
          : spokenText(state),
      });
    };
    // 한 발화가 상태를 여러 번 바꾸더라도 최종 안내만 읽는다.
    let queued = false;
    const unsubscribe = useKioskStore.subscribe(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        sync();
      });
    });
    const visibility = () => controller.setVisible(!document.hidden);
    document.addEventListener("visibilitychange", visibility);
    visibility();
    sync();
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", visibility);
      controller.dispose();
      session.current = null;
    };
  }, [alwaysSpeak]);

  const toggleListen = useCallback(() => session.current?.toggle(), []);
  return { toggleListen };
}