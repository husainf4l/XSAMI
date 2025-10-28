'use client';

import { Hand } from 'lucide-react';
import Button from './ui/Button';
import { useRoomStore } from '@/store/room.store';
import { webSocketService } from '@/services/websocket.service';

export default function RaisedHandButton() {
  const { myPeerId, raisedHands, toggleRaiseHand } = useRoomStore();
  
  const isHandRaised = myPeerId ? raisedHands.has(myPeerId) : false;

  const handleToggleHand = () => {
    toggleRaiseHand();
    
    // Send WebSocket message to notify other participants
    webSocketService.send({
      event: isHandRaised ? 'lower-hand' : 'raise-hand',
      data: {
        peerId: myPeerId,
      },
    });
  };

  return (
    <Button
      onClick={handleToggleHand}
      variant={isHandRaised ? 'primary' : 'secondary'}
      size="md"
      className="gap-2 relative"
      title={isHandRaised ? 'Lower hand' : 'Raise hand'}
    >
      <Hand 
        className={`w-5 h-5 transition-transform ${isHandRaised ? 'animate-bounce' : ''}`}
        fill={isHandRaised ? 'currentColor' : 'none'}
      />
      <span className="hidden sm:inline">
        {isHandRaised ? 'Lower Hand' : 'Raise Hand'}
      </span>
      {isHandRaised && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
      )}
    </Button>
  );
}
