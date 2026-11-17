import { actionApiUrl } from "@/lib/action-api";

const TARGET_SAMPLE_RATE = 16000;
const BUFFER_SIZE = 2048;
const SPEECH_THRESHOLD = 0.014;
const PRE_ROLL_CHUNKS = 5;
const SILENCE_AFTER_SPEECH_MS = 1000;
const MAX_SPEECH_MS = 10000;
const NO_SPEECH_TIMEOUT_MS = 8000;
const STT_TIMEOUT_MS = 8000;
const TTS_TIMEOUT_MS = 8000;

export type SpeakFn = (
  text: string,
  done: () => void,
  onBoundary?: (charIndex: number) => void,
) => () => void;

/** Float32 모노 샘플 배열을 16bit PCM WAV Blob으로 인코딩한다. */
export function encodeWavPcm16(
  samples: Float32Array,
  sampleRate: number,
): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function mergeChunks(chunks: Float32Array[]): Float32Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function calcRms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/** SpeechSession과 동일한 인터페이스로 동작하는 서버 STT(WAV 녹음+VAD) 인식기. */
class ServerRecognition extends EventTarget implements SpeechRecognition {
  lang = "ko-KR";
  continuous = false;
  interimResults = true;
  maxAlternatives = 1;

  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;
  onend: ((event: Event) => void) | null = null;

  private closed = false;
  private finalizing = false;
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private watchTimer: ReturnType<typeof setInterval> | null = null;
  private fetchController: AbortController | null = null;

  start(): void {
    if (this.closed) return;
    void this.beginCapture();
  }

  stop(): void {
    if (this.closed || this.finalizing) return;
    this.closed = true;
    this.cleanupAudio();
    this.fetchController?.abort();
  }

  abort(): void {
    this.closed = true;
    this.cleanupAudio();
    this.fetchController?.abort();
  }

  private emitError(error: string, message = "") {
    if (this.closed) return;
    this.closed = true;
    this.onerror?.({ error, message } as SpeechRecognitionErrorEvent);
  }

  private emitResult(transcript: string) {
    if (this.closed) return;
    this.closed = true;
    const alt: SpeechRecognitionAlternative = { transcript, confidence: 1 };
    const result = {
      0: alt,
      isFinal: true,
      length: 1,
    } as unknown as SpeechRecognitionResult;
    const results = {
      0: result,
      length: 1,
    } as unknown as SpeechRecognitionResultList;
    this.onresult?.({ resultIndex: 0, results } as SpeechRecognitionEvent);
  }

  private cleanupAudio() {
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
    if (this.processor) {
      this.processor.onaudioprocess = null;
      try {
        this.processor.disconnect();
      } catch {
        /* ignore */
      }
      this.processor = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        /* ignore */
      }
      this.source = null;
    }
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
  }

  private async beginCapture() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (this.closed) {
        for (const t of stream.getTracks()) t.stop();
        return;
      }
      this.stream = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) {
        this.cleanupAudio();
        this.emitError("audio-capture", "AudioContext를 지원하지 않습니다.");
        return;
      }

      const ctx = new AudioCtx({ sampleRate: TARGET_SAMPLE_RATE });
      this.ctx = ctx;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      if (this.closed) {
        this.cleanupAudio();
        return;
      }

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      this.source = source;
      this.processor = processor;

      const preRoll: Float32Array[] = [];
      const recorded: Float32Array[] = [];
      let heardSpeech = false;
      const startedAt = Date.now();
      let speechStartedAt = 0;
      let lastVoiceAt = 0;
      const actualSampleRate = ctx.sampleRate || TARGET_SAMPLE_RATE;

      processor.onaudioprocess = (ev) => {
        if (this.closed || this.finalizing) return;
        const input = ev.inputBuffer.getChannelData(0);
        const copy = new Float32Array(input);
        const rms = calcRms(copy);
        const now = Date.now();

        if (!heardSpeech) {
          preRoll.push(copy);
          if (preRoll.length > PRE_ROLL_CHUNKS) preRoll.shift();
          if (rms >= SPEECH_THRESHOLD) {
            heardSpeech = true;
            speechStartedAt = now;
            lastVoiceAt = now;
            recorded.push(...preRoll);
            preRoll.length = 0;
          }
        } else {
          recorded.push(copy);
          if (rms >= SPEECH_THRESHOLD) {
            lastVoiceAt = now;
          }
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      this.watchTimer = setInterval(() => {
        if (this.closed || this.finalizing) return;
        const now = Date.now();
        if (!heardSpeech) {
          if (now - startedAt >= NO_SPEECH_TIMEOUT_MS) {
            this.cleanupAudio();
            this.emitError("no-speech");
          }
          return;
        }
        const silenceElapsed = now - lastVoiceAt;
        const speechElapsed = now - speechStartedAt;
        if (
          silenceElapsed >= SILENCE_AFTER_SPEECH_MS ||
          speechElapsed >= MAX_SPEECH_MS
        ) {
          this.finalizing = true;
          this.cleanupAudio();
          void this.submitWav(mergeChunks(recorded), actualSampleRate);
        }
      }, 100);
    } catch (e) {
      this.cleanupAudio();
      const name = e instanceof Error ? e.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        this.emitError("not-allowed", "마이크 권한이 거부되었습니다.");
      } else {
        this.emitError("audio-capture", "마이크를 사용할 수 없습니다.");
      }
    }
  }

  private async submitWav(samples: Float32Array, sampleRate: number) {
    if (this.closed || samples.length === 0) {
      this.emitError("no-speech");
      return;
    }
    const wav = encodeWavPcm16(samples, sampleRate);
    const controller = new AbortController();
    this.fetchController = controller;
    const timer = setTimeout(() => controller.abort(), STT_TIMEOUT_MS);

    try {
      const res = await fetch(`${actionApiUrl()}/api/stt`, {
        method: "POST",
        headers: { "Content-Type": "audio/wav" },
        body: wav,
        signal: controller.signal,
      });
      if (this.closed) return;
      if (!res.ok) {
        this.emitError("network");
        return;
      }
      const data = (await res.json()) as {
        ok?: boolean;
        text?: string;
        speech_detected?: boolean;
      };
      if (this.closed) return;
      if (data.ok && data.speech_detected && data.text?.trim()) {
        this.emitResult(data.text.trim());
      } else {
        this.emitError("no-speech");
      }
    } catch (e) {
      if (this.closed) return;
      if (e instanceof Error && e.name === "AbortError") {
        this.emitError("network");
      } else {
        this.emitError("network");
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createServerRecognition(): SpeechRecognition | null {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    return null;
  }
  return new ServerRecognition();
}

/** 서버 VITS TTS(/api/tts)를 호출해 WAV를 재생한다. 오류 시 브라우저 TTS로 폴백한다. */
export function speakWithServer(
  text: string,
  done: () => void,
  onBoundary?: (charIndex: number) => void,
  fallbackSpeak?: SpeakFn,
): () => void {
  let canceled = false;
  let audio: HTMLAudioElement | null = null;
  let objectUrl: string | null = null;
  let cancelFallback: (() => void) | null = null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

  const cleanupAudio = () => {
    if (audio) {
      audio.ontimeupdate = null;
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
        audio.removeAttribute("src");
      } catch {
        /* ignore */
      }
      audio = null;
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  };

  const runFallback = () => {
    if (canceled) return;
    if (fallbackSpeak) {
      cancelFallback = fallbackSpeak(text, done, onBoundary);
    } else {
      done();
    }
  };

  void (async () => {
    try {
      const res = await fetch(`${actionApiUrl()}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speed: 1.0 }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (canceled) return;
      if (!res.ok) {
        runFallback();
        return;
      }

      const blob = await res.blob();
      if (canceled) return;

      objectUrl = URL.createObjectURL(blob);
      audio = new Audio(objectUrl);
      audio.ontimeupdate = () => {
        if (!audio || canceled) return;
        if (audio.duration > 0 && Number.isFinite(audio.duration)) {
          const idx = Math.min(
            text.length,
            Math.floor((audio.currentTime / audio.duration) * text.length),
          );
          onBoundary?.(idx);
        }
      };
      audio.onended = () => {
        if (canceled) return;
        cleanupAudio();
        done();
      };
      audio.onerror = () => {
        if (canceled) return;
        cleanupAudio();
        runFallback();
      };

      await audio.play();
    } catch {
      clearTimeout(timer);
      cleanupAudio();
      runFallback();
    }
  })();

  return () => {
    canceled = true;
    clearTimeout(timer);
    controller.abort();
    cleanupAudio();
    cancelFallback?.();
  };
}
