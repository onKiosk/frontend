"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { spokenText, staffTexts } from "@/lib/dialog";
import { SpeechSession } from "@/lib/speech-session";
import { useKioskStore } from "@/store/kiosk-store";

/** 모든 모드에서 안내가 끝날 때마다 다음 발화를 자동으로 기다린다. */
export function useSpeech({
  alwaysSpeak = true,
}: { alwaysSpeak?: boolean } = {}) {
  const session = useRef<SpeechSession | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const controller = new SpeechSession({
      createRecognition: () => {
        const Recognition =
          window.SpeechRecognition ?? window.webkitSpeechRecognition;

        return Recognition ? new Recognition() : null;
      },

      speak: (text, done, onBoundary) => {
        if (!window.speechSynthesis) {
          done();
          return () => {};
        }

        // 이전 잔여 발화 안전 정리
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        utterance.lang = "ko-KR";
        utterance.rate = 1.05;
        utterance.onboundary = (event) => {
          if (typeof event.charIndex === "number") {
            onBoundary?.(event.charIndex);
          }
        };
        utterance.onend = done;
        utterance.onerror = done;

        window.speechSynthesis.speak(utterance);

        return () => {
          utterance.onboundary = null;
          utterance.onend = null;
          utterance.onerror = null;

          window.speechSynthesis.cancel();
        };
      },

      onSpeaking: (speaking) => setIsSpeaking(speaking),

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

    const visibility = () => {
      controller.setVisible(!document.hidden);
    };

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

  // 음성 멈춤 <-> 다시 듣기(이어서 재생) 통합 토글
  const toggleGuidance = useCallback(
    () => session.current?.toggleGuidance(),
    [],
  );

  // 기존 음성인식 일시정지 및 재개
  const toggleListen = useCallback(() => session.current?.toggle(), []);

  // 기존 음성인식 재시도
  const retryListen = useCallback(() => session.current?.retry(), []);

  // 기존 호환용
  const interruptAndListen = useCallback(
    () => session.current?.interruptAndListen(),
    [],
  );

  return {
    isSpeaking,
    toggleGuidance,
    toggleListen,
    retryListen,
    interruptAndListen,
  };
}