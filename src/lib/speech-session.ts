
export interface SpeechSessionOptions {
  createRecognition: () => SpeechRecognition | null;
  /** 안내를 재생하고, 종료 시 done을 호출한다. 반환 함수는 재생을 취소한다. */
  speak: (text: string, done: () => void) => () => void;
  onListening: (listening: boolean) => void;
  onPaused: (paused: boolean) => void;
  onTranscript: (text: string) => void;
  /** Promise를 돌려주면(서버 응답 대기) 끝난 뒤에 듣기를 다시 시작한다. */
  onUtterance: (text: string) => void | Promise<void>;
  onError: (message: string) => void;
}

interface Guidance {
  automatic: boolean;
  speak: boolean;
  text: string;
}

/** 안내 재생 → 듣기 → 발화 처리 → 다음 안내 */
export class SpeechSession {
  private guidance: Guidance = {
    automatic: false,
    speak: false,
    text: "",
  };

  private engine: SpeechRecognition | null = null;
  private cancelSpeech: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  private generation = 0;
  private speaking = false;
  private paused = false;
  private blocked = false;
  private visible = true;
  private disposed = false;
  private errors = 0;

  private options: SpeechSessionOptions;

  constructor(options: SpeechSessionOptions) {
    this.options = options;
  }

  update(next: Guidance) {
    if (this.disposed) return;

    const previous = this.guidance;
    this.guidance = next;

    if (previous.automatic !== next.automatic) {
      this.paused = false;
      this.blocked = false;
      this.errors = 0;
      this.options.onPaused(false);
    }

    if (
      previous.automatic === next.automatic &&
      previous.speak === next.speak &&
      previous.text === next.text
    ) {
      return;
    }

    this.stop();
    this.guide();
  }

  toggle() {
    if (this.disposed) return;

    if (
      this.engine ||
      (this.guidance.automatic && !this.paused && !this.blocked)
    ) {
      this.paused = true;
      this.stop();
      this.options.onPaused(true);
      return;
    }

    this.paused = false;
    this.blocked = false;
    this.errors = 0;
    this.options.onPaused(false);

    this.stop();
    this.startListening();
  }

  /**
   * 안내 음성을 즉시 중단하고
   * 사용자 음성인식을 바로 시작한다.
   */
  interruptAndListen() {
    if (this.disposed || !this.visible) return;

    // 일시정지 및 오류 상태 해제
    this.paused = false;
    this.blocked = false;
    this.errors = 0;

    this.options.onPaused(false);

    // 기존 안내 음성 및 음성인식 엔진 종료
    this.stop();

    // 사용자 음성인식 즉시 시작
    this.startListening();
  }

  retry() {
    if (this.disposed) return;

    this.paused = false;
    this.blocked = false;
    this.errors = 0;

    this.options.onPaused(false);

    this.stop();
    this.startListening();
  }

  setVisible(visible: boolean) {
    if (this.disposed || visible === this.visible) return;

    this.visible = visible;
    this.stop();

    if (visible) {
      this.guide();
    }
  }

  dispose() {
    this.disposed = true;
    this.stop();
  }

  private stop() {
    this.generation++;

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = null;
    this.speaking = false;

    const cancel = this.cancelSpeech;
    this.cancelSpeech = null;

    cancel?.();

    this.releaseEngine();
  }

  private releaseEngine() {
    const engine = this.engine;
    this.engine = null;

    if (engine) {
      engine.onresult = null;
      engine.onerror = null;
      engine.onend = null;

      try {
        engine.abort();
      } catch {
        /* 이미 종료된 엔진 */
      }
    }

    this.options.onListening(false);
  }

  private guide() {
    if (
      this.disposed ||
      !this.visible ||
      this.paused ||
      this.blocked
    ) {
      return;
    }

    if (!this.guidance.speak || !this.guidance.text) {
      this.schedule();
      return;
    }

    const generation = this.generation;

    this.speaking = true;

    const done = () => {
      if (
        this.disposed ||
        generation !== this.generation
      ) {
        return;
      }

      this.speaking = false;
      this.schedule();
    };

    try {
      this.cancelSpeech = this.options.speak(
        this.guidance.text,
        done,
      );
    } catch {
      done();
    }
  }

  private schedule(delay = 350) {
    if (
      !this.guidance.automatic ||
      this.disposed ||
      !this.visible ||
      this.paused ||
      this.blocked ||
      this.speaking ||
      this.engine ||
      this.timer
    ) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      this.startListening();
    }, delay);
  }

  private fail(message: string) {
    this.blocked = true;
    this.paused = true;

    this.stop();

    this.options.onPaused(true);
    this.options.onError(message);
  }

  private startListening() {
    if (
      this.disposed ||
      !this.visible ||
      this.paused ||
      this.blocked ||
      this.speaking ||
      this.engine
    ) {
      return;
    }

    try {
      const engine = this.options.createRecognition();

      if (!engine) {
        this.fail(
          "이 브라우저는 음성 인식을 지원하지 않아요. 위 예시 문장을 눌러 보세요.",
        );
        return;
      }

      this.engine = engine;

      engine.lang = "ko-KR";
      engine.continuous = false;
      engine.interimResults = true;

      engine.onresult = (event) => {
        if (this.engine !== engine) return;

        const result = event.results[event.resultIndex];

        if (!result) return;

        const text = result[0].transcript;

        this.options.onTranscript(text);

        if (!result.isFinal) return;

        this.errors = 0;
        this.releaseEngine();

        if (text.trim()) {
          const pending = this.options.onUtterance(text);

          if (pending instanceof Promise) {
            pending.then(
              () => this.schedule(),
              () => this.schedule(),
            );

            return;
          }
        }

        this.schedule();
      };

      engine.onerror = (event) => {
        if (this.engine !== engine) return;

        this.releaseEngine();

        if (
          /not-allowed|service-not-allowed|audio-capture|language-not-supported/.test(
            event.error,
          )
        ) {
          this.fail(
            "마이크를 쓸 수 없어요. 브라우저의 마이크 권한과 연결을 확인한 뒤 다시 듣기를 눌러 주세요.",
          );
        } else if (
          event.error === "no-speech" ||
          event.error === "aborted"
        ) {
          this.schedule();
        } else {
          this.errors++;

          if (
            this.errors >= 3 ||
            !this.guidance.automatic
          ) {
            this.fail(
              "음성 인식 연결이 끊겼어요. 연결을 확인한 뒤 다시 듣기를 눌러 주세요.",
            );
          } else {
            this.schedule(1000 * this.errors);
          }
        }
      };

      engine.onend = () => {
        if (this.engine !== engine) return;

        this.releaseEngine();
        this.schedule();
      };

      this.options.onTranscript("");
      this.options.onListening(true);

      engine.start();
    } catch {
      this.fail(
        "음성 인식을 시작하지 못했어요. 마이크 권한을 확인한 뒤 다시 눌러 주세요.",
      );
    }
  }
}
