import React from 'react';
import { Heart } from 'lucide-react';

type FavoriteHeartButtonProps = {
  isFavorited: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  ariaLabel: string;
  className?: string;
};

export function FavoriteHeartButton({
  isFavorited,
  onClick,
  title = '收藏单集',
  ariaLabel,
  className = '',
}: FavoriteHeartButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full p-1 px-1.5 transition-transform hover:bg-neutral-50 active:scale-110 focus:outline-none ${className}`.trim()}
      title={title}
      aria-label={ariaLabel}
    >
      <Heart
        className="h-5.5 w-5.5 transition-transform"
        color={isFavorited ? '#D14A28' : '#1A1A1A'}
        fill={isFavorited ? '#D14A28' : 'none'}
        strokeWidth={1.8}
      />
    </button>
  );
}
