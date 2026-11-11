/** 한국어 표기 도우미 — 금액, 조사, 단위. */

export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/** 받침 여부 */
function hasBatchim(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code < 11172 && code % 28 > 0;
}

/** josa('아메리카노', '을', '를') → '아메리카노를' */
export const josa = (word: string, withBatchim: string, without: string) =>
  word + (hasBatchim(word) ? withBatchim : without);

/** 공백 제거 — 음성 인식 결과 비교용 */
export const squash = (s: string) => s.replace(/\s/g, "");
