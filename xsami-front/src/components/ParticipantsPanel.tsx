'use client';

import { X, Users, Crown, Hand } from 'lucide-react';
import { useRoomStore } from '@/store/room.store';
import Button from '@/components/ui/Button';

interface ParticipantsPanelProps {
  onClose: () => void;
}

export function ParticipantsPanel({ onClose }: ParticipantsPanelProps) {
  const { participants, myPeerId, myUsername, hostId, raisedHands } = useRoomStore();

  const allParticipants = [
    { peerId: myPeerId || '', username: `${myUsername} (You)`, isYou: true },
    ...Array.from(participants.entries()).map(([peerId, username]) => ({
      peerId,
      username,
      isYou: false,
    })),
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background-card rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-text-primary">Participants</h2>
            <span className="text-sm text-text-secondary">({allParticipants.length})</span>
          </div>
          <Button onClick={onClose} variant="secondary" size="sm" className="gap-2">
            <X className="w-4 h-4" />
            Close
          </Button>
        </div>

        {/* Participants List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {allParticipants.map((participant) => {
              const isHost = participant.peerId === hostId;
              const hasHandRaised = raisedHands.has(participant.peerId);

              return (
                <div
                  key={participant.peerId}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    participant.isYou
                      ? 'bg-primary/5 border-primary/30'
                      : 'bg-background-secondary border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Avatar */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${
                        participant.isYou
                          ? 'bg-gradient-to-br from-primary to-blue-600'
                          : 'bg-gradient-to-br from-blue-500 to-purple-600'
                      }`}
                    >
                      {participant.username.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {participant.username}
                        </p>
                        {isHost && (
                          <div title="Host">
                            <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                          </div>
                        )}
                      </div>
                      {participant.isYou && (
                        <p className="text-xs text-text-secondary">That&apos;s you</p>
                      )}
                    </div>

                    {/* Status Indicators */}
                    <div className="flex items-center gap-2">
                      {hasHandRaised && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full">
                          <Hand className="w-3 h-3 text-blue-500" />
                          <span className="text-xs font-medium text-blue-500">Raised</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t border-border bg-background-secondary/50">
          <p className="text-xs text-text-secondary text-center">
            {raisedHands.size > 0
              ? `${raisedHands.size} participant${raisedHands.size !== 1 ? 's have' : ' has'} raised their hand`
              : 'No hands raised'}
          </p>
        </div>
      </div>
    </div>
  );
}
