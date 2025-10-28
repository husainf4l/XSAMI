'use client';

import { useState } from 'react';
import { Smile } from 'lucide-react';
import { ReactionType } from '@/types';
import Button from './ui/Button';

const REACTIONS: ReactionType[] = ['👍', '❤️', '😂', '🎉', '👏', '🤔'];

interface ReactionPickerProps {
  onReactionSelect: (emoji: ReactionType) => void;
}

export default function ReactionPicker({ onReactionSelect }: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleReactionClick = (emoji: ReactionType) => {
    onReactionSelect(emoji);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Reaction Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="secondary"
        size="md"
        className="gap-2"
        title="Send reaction"
      >
        <Smile className="w-5 h-5" />
        <span className="hidden sm:inline">React</span>
      </Button>

      {/* Reactions Popup */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Picker */}
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 bg-background-card border border-border rounded-xl shadow-large p-2 flex gap-1">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReactionClick(emoji)}
                className="text-3xl hover:scale-125 transition-transform duration-200 p-2 hover:bg-background-hover rounded-lg"
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
