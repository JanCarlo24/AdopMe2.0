export function createId(cryptoObj = globalThis.crypto) {
  return cryptoObj?.randomUUID
    ? cryptoObj.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
