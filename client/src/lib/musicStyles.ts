export type MusicStyle = { value: string; label: string };

export function visibleMusicStyles(
  styles: readonly MusicStyle[],
  available: string[] | null,
  current: string,
): MusicStyle[] {
  return styles.filter(
    (opt) => !available || available.includes(opt.value) || opt.value === current,
  );
}
