interface DifficultyBadgeProps {
  difficulty: 'easy' | 'medium' | 'hard';
  size?: 'sm' | 'md' | 'lg';
}

export function DifficultyBadge({ difficulty, size = 'md' }: DifficultyBadgeProps) {
  const styles = {
    easy: 'bg-success text-white',
    medium: 'bg-warning text-white',
    hard: 'bg-error text-white',
  };

  const sizes = {
    sm: 'px-2.5 py-1 text-xs rounded-md',
    md: 'px-3 py-1.5 text-sm rounded-lg',
    lg: 'px-4 py-2 text-sm rounded-lg',
  };

  return (
    <span className={`inline-flex font-bold shadow-sm ${styles[difficulty]} ${sizes[size]}`}>
      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
    </span>
  );
}
