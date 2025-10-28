'use client';

import { Hand, X } from 'lucide-react';
import Button from '../ui/Button';
import { useRoomStore } from '@/store/room.store';
import { webSocketService } from '@/services/websocket.service';

export default function RaisedHandsList() {
  const { raisedHands, removeRaisedHand } = useRoomStore();

  const handleLowerHand = (peerId: string) => {
    removeRaisedHand(peerId);
    
    // Send WebSocket message to lower the participant's hand
    webSocketService.send({
      event: 'lower-hand',
      data: { peerId },
    });
  };

  const handleClearAll = () => {
    // Lower each hand individually
    raisedHands.forEach((hand, peerId) => {
      removeRaisedHand(peerId);
      
      // Send WebSocket message for each participant
      webSocketService.send({
        event: 'lower-hand',
        data: { peerId },
      });
    });
  };

  if (raisedHands.size === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Hand className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No raised hands</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with Clear All button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">
          Raised Hands ({raisedHands.size})
        </h3>
        {raisedHands.size > 0 && (
          <Button
            onClick={handleClearAll}
            variant="danger"
            size="sm"
            className="text-xs"
          >
            Clear All
          </Button>
        )}
      </div>

      {/* List of raised hands */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {Array.from(raisedHands.entries()).map(([peerId, hand]) => (
          <div
            key={peerId}
            className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 text-white rounded-full p-2">
                <Hand className="w-4 h-4" fill="currentColor" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{hand.username}</p>
                <p className="text-xs text-gray-400">
                  Raised {new Date(hand.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <Button
              onClick={() => handleLowerHand(peerId)}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white"
              title="Lower hand"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
