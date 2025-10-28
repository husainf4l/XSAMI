'use client';

import { Mic, MicOff, Video, VideoOff, Crown, Shield, UserX, MoreVertical, Users } from 'lucide-react';
import { useRoomStore } from '@/store/room.store';
import { webSocketService } from '@/services/websocket.service';
import Button from '@/components/ui/Button';
import { useState } from 'react';

interface ParticipantItemProps {
  peerId: string;
  username: string;
  isCurrentUser: boolean;
  isHost: boolean;
}

function ParticipantItem({ peerId, username, isCurrentUser, isHost }: ParticipantItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const { removePeerConnection, removeParticipant } = useRoomStore();

  const handleMute = () => {
    // Send mute request via WebSocket
    // Note: Backend needs to implement this to force mute remote participant
    console.log('Mute participant:', peerId);
    
    // For now, this would require backend support
    // webSocketService.send({
    //   event: 'mute-participant',
    //   data: { peerId },
    // });
  };

  const handlePromoteCoHost = () => {
    // Send co-host promotion via WebSocket
    // Note: Backend needs to implement co-host permissions
    console.log('Promote to co-host:', peerId);
    
    // webSocketService.send({
    //   event: 'promote-co-host',
    //   data: { peerId },
    // });
  };

  const handleRemove = () => {
    if (confirm(`Remove ${username} from the room?`)) {
      // Remove locally first
      removePeerConnection(peerId);
      removeParticipant(peerId);
      
      // Send kick/remove message via WebSocket
      webSocketService.send({
        event: 'kicked',
        data: { targetPeerId: peerId },
      });
      
      console.log('Removed participant:', peerId);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-background-secondary/50 transition-colors group">
      <div className="flex items-center gap-3 flex-1">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-primary font-semibold text-sm">
            {username.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-text-primary font-medium truncate">
              {username}
              {isCurrentUser && <span className="text-text-secondary text-sm"> (You)</span>}
            </p>
            {isHost && (
              <Crown className="w-4 h-4 text-warning flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-text-secondary truncate">{peerId}</p>
        </div>
      </div>

      {/* Actions (only for non-current users) */}
      {!isCurrentUser && (
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            onClick={handleMute}
            variant="secondary"
            size="sm"
            className="gap-1"
            title="Mute participant"
          >
            <MicOff className="w-3 h-3" />
          </Button>

          <Button
            onClick={handlePromoteCoHost}
            variant="secondary"
            size="sm"
            className="gap-1"
            title="Make co-host"
          >
            <Shield className="w-3 h-3" />
          </Button>

          <Button
            onClick={handleRemove}
            variant="danger"
            size="sm"
            className="gap-1"
            title="Remove from room"
          >
            <UserX className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function ParticipantsList() {
  const { participants, myPeerId, myUsername, isHost, hostId } = useRoomStore();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">
          Participants ({participants.size + 1})
        </h3>
      </div>

      <div className="space-y-2">
        {/* Current User */}
        {myPeerId && (
          <ParticipantItem
            peerId={myPeerId}
            username={myUsername}
            isCurrentUser={true}
            isHost={isHost}
          />
        )}

        {/* Other Participants */}
        {Array.from(participants.entries()).map(([peerId, username]) => (
          <ParticipantItem
            key={peerId}
            peerId={peerId}
            username={typeof username === 'string' ? username : 'Participant'}
            isCurrentUser={false}
            isHost={peerId === hostId}
          />
        ))}

        {/* Empty State */}
        {participants.size === 0 && (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary">No other participants yet</p>
            <p className="text-sm text-text-muted mt-1">
              Share the room link to invite others
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
