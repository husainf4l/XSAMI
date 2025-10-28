'use client';

import { useEffect, useState } from 'react';
import { ReactionType } from '@/types';

interface FloatingReactionProps {
  emoji: ReactionType;
  onComplete: () => void;
}

export default function FloatingReaction({ emoji, onComplete }: FloatingReactionProps) {
  const [position] = useState(() => ({
    left: `${50 + Math.random() * 30 - 15}%`, // 35-65%
    animationDelay: `${Math.random() * 0.3}s`,
  }));

  useEffect(() => {
    // Remove after animation completes
    const timer = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="absolute pointer-events-none z-20 text-4xl animate-float-up"
      style={{
        left: position.left,
        bottom: '20%',
        animationDelay: position.animationDelay,
      }}
    >
      {emoji}
    </div>
  );
}
