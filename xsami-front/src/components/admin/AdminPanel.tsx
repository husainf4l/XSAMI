'use client';

import { useState } from 'react';
import { X, Users, Settings, Lock, Unlock, Shield, Hand, UserPlus, Video } from 'lucide-react';
import { useRoomStore } from '@/store/room.store';
import { webSocketService } from '@/services/websocket.service';
import Button from '@/components/ui/Button';
import { ParticipantsList } from './ParticipantsList';
import { AdminSettings } from './AdminSettings';
import RaisedHandsList from './RaisedHandsList';
import { WaitingRoom } from './WaitingRoom';
import { Recording } from './Recording';

interface AdminPanelProps {
  onClose: () => void;
}

type AdminTab = 'participants' | 'hands' | 'settings' | 'waiting' | 'recording';

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('participants');
  
  const {
    isHost,
    participants,
    raisedHands,
    waitingParticipants,
    recordingState,
    isRoomLocked,
    isChatEnabled,
    canParticipantsShare,
    setRoomLocked,
    setChatEnabled,
    setCanParticipantsShare,
  } = useRoomStore();

  // Only show to host
  if (!isHost) {
    return null;
  }

  const handleToggleRoomLock = () => {
    const newState = !isRoomLocked;
    setRoomLocked(newState);
    
    // Send WebSocket message to backend
    webSocketService.send({
      event: newState ? 'room-locked' : 'room-unlocked',
      data: {},
    });
  };

  const handleToggleChat = () => {
    const newState = !isChatEnabled;
    setChatEnabled(newState);
    
    // Send WebSocket message to backend
    webSocketService.send({
      event: newState ? 'chat-enabled' : 'chat-disabled',
      data: {},
    });
  };

  const handleToggleScreenShare = () => {
    const newState = !canParticipantsShare;
    setCanParticipantsShare(newState);
    
    // Note: Backend would need to implement screen-share permission control
    // For now, this is client-side only
    console.log('Screen share permission:', newState ? 'allowed' : 'restricted');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-text-primary">Admin Panel</h2>
          </div>
          <Button
            onClick={onClose}
            variant="secondary"
            size="sm"
            className="gap-2"
          >
            <X className="w-4 h-4" />
            Close
          </Button>
        </div>

        {/* Quick Controls */}
        <div className="p-4 bg-background-secondary border-b border-border">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleToggleRoomLock}
              variant={isRoomLocked ? 'danger' : 'secondary'}
              size="sm"
              className="gap-2"
            >
              {isRoomLocked ? (
                <>
                  <Lock className="w-4 h-4" />
                  Room Locked
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  Room Unlocked
                </>
              )}
            </Button>

            <Button
              onClick={handleToggleChat}
              variant={isChatEnabled ? 'secondary' : 'danger'}
              size="sm"
              className="gap-2"
            >
              {isChatEnabled ? 'Chat Enabled' : 'Chat Disabled'}
            </Button>

            <Button
              onClick={handleToggleScreenShare}
              variant={canParticipantsShare ? 'secondary' : 'danger'}
              size="sm"
              className="gap-2"
            >
              {canParticipantsShare
                ? 'Screen Share: Allowed'
                : 'Screen Share: Host Only'}
            </Button>

            <div className="ml-auto flex items-center gap-2 text-sm text-text-secondary">
              <Users className="w-4 h-4" />
              <span>{participants.size + 1} Participants</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border overflow-x-auto">
          <button
            onClick={() => setActiveTab('participants')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'participants'
                ? 'text-primary border-b-2 border-primary bg-background-secondary/50'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary/30'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Users className="w-4 h-4" />
              Participants
            </div>
          </button>
          <button
            onClick={() => setActiveTab('hands')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'hands'
                ? 'text-primary border-b-2 border-primary bg-background-secondary/50'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary/30'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Hand className="w-4 h-4" />
              Raised Hands
              {raisedHands.size > 0 && (
                <span className="bg-blue-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                  {raisedHands.size}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('waiting')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'waiting'
                ? 'text-primary border-b-2 border-primary bg-background-secondary/50'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary/30'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <UserPlus className="w-4 h-4" />
              Waiting Room
              {waitingParticipants.size > 0 && (
                <span className="bg-yellow-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                  {waitingParticipants.size}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('recording')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'recording'
                ? 'text-primary border-b-2 border-primary bg-background-secondary/50'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary/30'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Video className="w-4 h-4" />
              Recording
              {recordingState.isRecording && (
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'settings'
                ? 'text-primary border-b-2 border-primary bg-background-secondary/50'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary/30'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'participants' && <ParticipantsList />}
          {activeTab === 'hands' && <RaisedHandsList />}
          {activeTab === 'waiting' && <WaitingRoom />}
          {activeTab === 'recording' && <Recording />}
          {activeTab === 'settings' && <AdminSettings />}
        </div>
      </div>
    </div>
  );
}
