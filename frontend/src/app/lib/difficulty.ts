/** Returns Tailwind classes for a difficulty badge/pill. */
export function difficultyClass(difficulty: string): string {
  switch (difficulty.toLowerCase()) {
    case 'easy':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25';
    case 'medium':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/25';
    case 'hard':
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/25';
    default:
      return 'bg-muted text-muted-foreground border border-border';
  }
}

/** Returns just the text color class for a difficulty label (no background). */
export function difficultyTextClass(difficulty: string): string {
  switch (difficulty.toLowerCase()) {
    case 'easy':   return 'text-emerald-400';
    case 'medium': return 'text-amber-400';
    case 'hard':   return 'text-rose-400';
    default:       return 'text-muted-foreground';
  }
}
