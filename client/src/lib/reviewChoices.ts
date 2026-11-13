/** Three meanings for a review question: the real one and two from the learner's other words. */
export function buildReviewChoices(correct: string, pool: string[]): string[] {
  const right = correct.trim();
  if (!right) return [];
  const key = (value: string) => value.trim().toLowerCase();
  const seen = new Set([key(right)]);
  const distractors: string[] = [];
  for (const raw of shuffle(pool)) {
    const text = String(raw || '').trim();
    if (!text || seen.has(key(text))) continue;
    seen.add(key(text));
    distractors.push(text);
    if (distractors.length === 2) break;
  }
  return shuffle([right, ...distractors]);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
