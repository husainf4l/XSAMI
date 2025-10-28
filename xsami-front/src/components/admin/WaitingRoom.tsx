'use client';

import { Clock, Check, X, UserPlus } from 'lucide-react';
import { useRoomStore } from '@/store/room.store';
import { webSocketService } from '@/services/websocket.service';
import Button from '@/components/ui/Button';

export function WaitingRoom() {
  const { waitingParticipants, removeWaitingParticipant } = useRoomStore();

  const handleAdmit = (peerId: string, username: string) => {
    // Send admit message to backend
    webSocketService.send({
      event: 'admit-participant',
      data: { peerId },
    });

    // Remove from waiting list
    removeWaitingParticipant(peerId);

    // Show notification
    console.log(`Admitted ${username} to the room`);
  };

  const handleDeny = (peerId: string, username: string) => {
    // Send deny message to backend
    webSocketService.send({
      event: 'deny-participant',
      data: { peerId },
    });

    // Remove from waiting list
    removeWaitingParticipant(peerId);

    // Show notification
    console.log(`Denied ${username} from the room`);
  };

  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - timestamp.getTime()) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  if (waitingParticipants.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-20 h-20 bg-background-secondary rounded-full flex items-center justify-center mb-4">
          <UserPlus className="w-10 h-10 text-text-secondary" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          No Participants Waiting
        </h3>
        <p className="text-text-secondary text-sm max-w-md">
          When the room is locked, new participants will appear here waiting to be admitted.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">
          Waiting to Join ({waitingParticipants.size})
        </h3>
        <p className="text-xs text-text-secondary">
          Review and admit participants
        </p>
      </div>

      <div className="space-y-2">
        {Array.from(waitingParticipants.values()).map((participant) => (
          <div
            key={participant.peerId}
            className="flex items-center justify-between p-4 bg-background-secondary rounded-lg border border-border hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                {participant.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {participant.username}
                </p>
                <div className="flex items-center gap-1 text-xs text-text-secondary">
                  <Clock className="w-3 h-3" />
                  <span>Waiting {formatTime(participant.timestamp)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
              <Button
                onClick={() => handleAdmit(participant.peerId, participant.username)}
                variant="primary"
                size="sm"
                className="gap-1.5"
              >
                <Check className="w-4 h-4" />
                Admit
              </Button>
              <Button
                onClick={() => handleDeny(participant.peerId, participant.username)}
                variant="danger"
                size="sm"
                className="gap-1.5"
              >
                <X className="w-4 h-4" />
                Deny
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <UserPlus className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary mb-1">
              Waiting Room Enabled
            </p>
            <p className="text-xs text-text-secondary">
              New participants must be admitted by the host when the room is locked.
              They will be notified once approved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
