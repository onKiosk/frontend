import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SpeechSession } from '@/lib/speech-session';

function setup(t, overrides = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const engines = [];
  const speech = [];
  const utterances = [];
  const errors = [];
  let listening = false;
  let paused = false;
  let transcript = '';
  const session = new SpeechSession({
    createRecognition: () => {
      const engine = {
        starts: 0, aborts: 0,
        start() { this.starts++; },
        abort() { this.aborts++; },
        result(text, isFinal = true) {
          this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript: text }, isFinal }] });
        },
        error(error) { this.onerror?.({ error }); },
        end() { this.onend?.({}); },
      };
      engines.push(engine);
      return engine;
    },
    speak: (text, done) => {
      const item = { text, done, canceled: false };
      speech.push(item);
      return () => { item.canceled = true; };
    },
    onListening: (value) => { listening = value; },
    onPaused: (value) => { paused = value; },
    onTranscript: (value) => { transcript = value; },
    onUtterance: (text) => utterances.push(text),
    onError: (message) => errors.push(message),
    ...overrides,
  });
  t.after(() => session.dispose());
  return {
    session, engines, speech, utterances, errors,
    get listening() { return listening; },
    get paused() { return paused; },
    get transcript() { return transcript; },
    update(text = '메뉴를 말씀해 주세요', automatic = true) {
      session.update({ text, automatic, speak: automatic });
    },
    finishSpeech() { speech.at(-1).done(); t.mock.timers.tick(350); },
  };
}

test('음성 모드는 안내가 끝난 뒤 마이크를 자동으로 켠다', (t) => {
  const h = setup(t);
  h.update();
  t.mock.timers.tick(10000);
  assert.equal(h.engines.length, 0);
  h.finishSpeech();
  assert.equal(h.engines.length, 1);
  assert.equal(h.listening, true);
  assert.equal(h.engines[0].lang, 'ko-KR');
  assert.equal(h.engines[0].continuous, false);
});

test('중간 결과는 표시만 하고 확정 발화만 한 번 처리한 뒤 다시 듣는다', (t) => {
  const h = setup(t);
  h.update(); h.finishSpeech();
  const engine = h.engines[0];
  const staleResult = engine.onresult;
  engine.result('아메', false);
  assert.equal(h.transcript, '아메');
  assert.deepEqual(h.utterances, []);
  engine.result('아메리카노');
  staleResult({ resultIndex: 0, results: [{ 0: { transcript: '아메리카노' }, isFinal: true }] });
  assert.deepEqual(h.utterances, ['아메리카노']);
  assert.equal(h.listening, false);
  t.mock.timers.tick(350);
  assert.equal(h.engines.length, 2);
  assert.equal(h.listening, true);
});

test('새 옵션 안내가 있으면 재연결을 미루고 안내 후에 듣는다', (t) => {
  const h = setup(t);
  h.update(); h.finishSpeech();
  h.engines[0].result('아메리카노');
  h.update('온도를 골라 주세요');
  t.mock.timers.tick(1000);
  assert.equal(h.engines.length, 1);
  assert.equal(h.listening, false);
  h.finishSpeech();
  assert.equal(h.engines.length, 2);
});

test('침묵과 브라우저의 자동 종료는 주문 실패로 처리하지 않고 재연결한다', (t) => {
  const h = setup(t);
  h.update(); h.finishSpeech();
  h.engines[0].error('no-speech');
  t.mock.timers.tick(350);
  h.engines[1].end();
  t.mock.timers.tick(350);
  assert.equal(h.engines.length, 3);
  assert.deepEqual(h.utterances, []);
  assert.deepEqual(h.errors, []);
  assert.equal(h.speech.length, 1);
});

test('자동 대기를 멈추면 화면이 바뀌어도 꺼진 상태를 유지하고 수동으로 재개한다', (t) => {
  const h = setup(t);
  h.update(); h.finishSpeech();
  h.session.toggle();
  h.update('다음 안내');
  t.mock.timers.tick(10000);
  assert.equal(h.engines.length, 1);
  assert.equal(h.listening, false);
  assert.equal(h.paused, true);
  h.session.toggle();
  assert.equal(h.engines.length, 2);
  assert.equal(h.paused, false);
});

test('안내 중 일시 정지한 뒤 늦게 도착한 TTS 종료 이벤트는 무시한다', (t) => {
  const h = setup(t);
  h.update();
  const staleDone = h.speech[0].done;
  h.session.toggle();
  staleDone();
  t.mock.timers.tick(10000);
  assert.equal(h.engines.length, 0);
  assert.equal(h.paused, true);
});

test('음성 모드에서 나가면 인식·재시작을 중단하고 기본 모드는 클릭 한 번에 한 발화만 듣는다', (t) => {
  const h = setup(t);
  h.update(); h.finishSpeech();
  h.update('기본 모드', false);
  t.mock.timers.tick(10000);
  assert.equal(h.listening, false);
  assert.equal(h.engines.length, 1);
  h.session.toggle();
  h.engines[1].result('치즈케이크');
  t.mock.timers.tick(10000);
  assert.equal(h.engines.length, 2);
  assert.deepEqual(h.utterances, ['치즈케이크']);
});

test('권한 거부 후에는 자동 재시도하지 않고 다시 듣기로 재시도한다', (t) => {
  const h = setup(t);
  h.update(); h.finishSpeech();
  h.engines[0].error('not-allowed');
  h.update('마이크 권한을 확인해 주세요');
  t.mock.timers.tick(10000);
  assert.equal(h.engines.length, 1);
  assert.equal(h.paused, true);
  assert.equal(h.errors.length, 1);
  h.session.toggle();
  assert.equal(h.engines.length, 2);
});

test('연결 오류는 간격을 늘려 재시도하고 세 번 실패하면 멈춘다', (t) => {
  const h = setup(t);
  h.update(); h.finishSpeech();
  h.engines[0].error('network');
  t.mock.timers.tick(999);
  assert.equal(h.engines.length, 1);
  t.mock.timers.tick(1);
  h.engines[1].error('network');
  t.mock.timers.tick(2000);
  h.engines[2].error('network');
  t.mock.timers.tick(10000);
  assert.equal(h.engines.length, 3);
  assert.equal(h.errors.length, 1);
  assert.equal(h.paused, true);
});

test('브라우저 미지원은 반복하지 않고 안내한다', (t) => {
  const h = setup(t, { createRecognition: () => null });
  h.update(); h.finishSpeech();
  t.mock.timers.tick(10000);
  assert.equal(h.errors.length, 1);
  assert.match(h.errors[0], /지원하지/);
  assert.equal(h.listening, false);
});

test('인식 시작에 실패하면 듣기 상태를 해제하고 재시도를 멈춘다', (t) => {
  const h = setup(t, { createRecognition: () => ({
    start() { throw new Error('cannot start'); },
    abort() {},
  }) });
  h.update(); h.finishSpeech();
  t.mock.timers.tick(10000);
  assert.equal(h.errors.length, 1);
  assert.equal(h.paused, true);
  assert.equal(h.listening, false);
});

test('음성 합성을 사용할 수 없어도 자동 듣기를 시작한다', (t) => {
  const h = setup(t, { speak: () => { throw new Error('unavailable'); } });
  h.update();
  t.mock.timers.tick(350);
  assert.equal(h.engines.length, 1);
});

test('탭이 숨겨지면 마이크를 끄고 돌아오면 안내 후 재개한다', (t) => {
  const h = setup(t);
  h.update(); h.finishSpeech();
  h.session.setVisible(false);
  t.mock.timers.tick(10000);
  assert.equal(h.listening, false);
  assert.equal(h.engines.length, 1);
  h.session.setVisible(true);
  h.finishSpeech();
  assert.equal(h.engines.length, 2);
});

test('언마운트 후 늦은 인식·TTS 이벤트와 타이머가 다시 마이크를 켜지 않는다', (t) => {
  const h = setup(t);
  h.update(); h.finishSpeech();
  const staleEnd = h.engines[0].onend;
  const staleSpeech = h.speech[0].done;
  h.session.dispose();
  staleEnd(); staleSpeech();
  h.update('새 안내');
  t.mock.timers.tick(10000);
  assert.equal(h.engines.length, 1);
  assert.equal(h.listening, false);
});
