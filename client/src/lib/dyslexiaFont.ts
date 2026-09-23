/** Persisted flag: 1 / true / "1" on. "0" and false stay off. */
export function dyslexiaFontOn(value: unknown): boolean {
  return value === 1 || value === true || value === '1';
}
