'use client';

import { MessageCircle, Monitor, Lock, Shield } from 'lucide-react';
import { useRoomStore } from '@/store/room.store';

export function AdminSettings() {
  const {
    isChatEnabled,
    canParticipantsShare,
    isRoomLocked,
    setChatEnabled,
    setCanParticipantsShare,
    setRoomLocked,
  } = useRoomStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-4">Room Settings</h3>
        
        <div className="space-y-4">
          {/* Chat Setting */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-background-secondary border border-border">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-primary" />
              <div>
                <h4 className="font-medium text-text-primary">Chat</h4>
                <p className="text-sm text-text-secondary">
                  Allow participants to send chat messages
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isChatEnabled}
                onChange={(e) => setChatEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-background-primary peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Screen Share Setting */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-background-secondary border border-border">
            <div className="flex items-center gap-3">
              <Monitor className="w-5 h-5 text-primary" />
              <div>
                <h4 className="font-medium text-text-primary">Screen Sharing</h4>
                <p className="text-sm text-text-secondary">
                  Allow all participants to share their screen
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={canParticipantsShare}
                onChange={(e) => setCanParticipantsShare(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-background-primary peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Room Lock Setting */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-background-secondary border border-border">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-primary" />
              <div>
                <h4 className="font-medium text-text-primary">Room Lock</h4>
                <p className="text-sm text-text-secondary">
                  Prevent new participants from joining the room
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isRoomLocked}
                onChange={(e) => setRoomLocked(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-background-primary peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-text-primary mb-1">Host Controls</h4>
            <p className="text-sm text-text-secondary">
              As the host, you have full control over room settings and participants.
              Changes take effect immediately for all participants.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
