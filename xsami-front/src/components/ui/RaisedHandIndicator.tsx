'use client';

import { Hand } from 'lucide-react';

interface RaisedHandIndicatorProps {
  isVisible: boolean;
}

export default function RaisedHandIndicator({ isVisible }: RaisedHandIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div className="absolute top-2 right-2 z-10">
      <div className="bg-blue-500 text-white rounded-full p-2 shadow-lg animate-bounce">
        <Hand className="w-5 h-5" fill="currentColor" />
      </div>
    </div>
  );
}
