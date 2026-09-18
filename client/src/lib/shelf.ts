export type ShelfWordLike = {
  word?: { text?: string | null } | null;
  song?: { id?: string | null } | null;
};

/** One shelf card per word (case-insensitive). Keeps the first / newest row. */
export function uniqueShelfWords<T extends ShelfWordLike>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items || []) {
    const key = String(item?.word?.text || '').toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
