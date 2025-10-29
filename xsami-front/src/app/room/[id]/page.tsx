'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  MessageCircle,
  Users,
  Settings,
  Copy,
  Check,
  Shield,
  Lock,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import VideoPlayer from '@/components/ui/VideoPlayer';
import ChatSidebar from '@/components/chat/ChatSidebar';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { ParticipantsPanel } from '@/components/ParticipantsPanel';
import SettingsModal from '@/components/SettingsModal';
import RaisedHandButton from '@/components/RaisedHandButton';
import ReactionPicker from '@/components/ReactionPicker';
import { useRoomStore } from '@/store/room.store';
import { webRTCService } from '@/services/webrtc.service';
import { webSocketService } from '@/services/websocket.service';
import { useWebRTCSignaling } from '@/hooks/useWebRTCSignaling';
import { useChat } from '@/hooks/useChat';
import { getWebSocketUrl, copyToClipboard } from '@/lib/utils';
import type { ReactionType } from '@/types';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [isCopied, setIsCopied] = useState(false);
  const [username, setUsername] = useState('');
  const [isUsernameSet, setIsUsernameSet] = useState(false);
  const [isMediaInitialized, setIsMediaInitialized] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isParticipantsPanelOpen, setIsParticipantsPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [peerReactions, setPeerReactions] = useState<Map<string, ReactionType[]>>(new Map());
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null); // Keep camera stream separate

  const {
    localStream,
    screenStream,
    peerConnections,
    mediaSettings,
    myUsername,
    myPeerId,
    participants,
    raisedHands,
    isHost,
    isRoomLocked,
    recordingState,
    activeSharingPeerId,
    setLocalStream,
    setScreenStream,
    setRoomId,
    setMyUsername,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    setActiveSharingPeer,
    toggleChat,
    isChatOpen,
    unreadCount,
    clearUnreadCount,
  } = useRoomStore();

  // Initialize WebRTC signaling
  const { renegotiatePeerConnection } = useWebRTCSignaling(roomId, screenStream || undefined);

  // Initialize chat
  const { sendMessage, messages, isChatEnabled } = useChat(roomId);

  // Initialize room on mount
  useEffect(() => {
    setRoomId(roomId);
    promptForUsername();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, setRoomId]);

  // Initialize media and WebSocket after username is set
  useEffect(() => {
    if (isUsernameSet && !isMediaInitialized) {
      initializeMedia();
      connectWebSocket();
      setIsMediaInitialized(true);
    }

    return () => {
      if (isMediaInitialized) {
        cleanup();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUsernameSet, isMediaInitialized]);

  // Clear unread count when chat opens
  useEffect(() => {
    if (isChatOpen) {
      clearUnreadCount();
    }
  }, [isChatOpen, clearUnreadCount]);

  // Listen for incoming reactions from other participants
  useEffect(() => {
    const handlePeerReaction = (event: CustomEvent) => {
      const { peerId, emoji } = event.detail;
      
      if (peerId && emoji) {
        setPeerReactions((prev) => {
          const updated = new Map(prev);
          const current = updated.get(peerId) || [];
          updated.set(peerId, [...current, emoji]);
          return updated;
        });

        // Clear after animation duration
        setTimeout(() => {
          setPeerReactions((prev) => {
            const updated = new Map(prev);
            const current = updated.get(peerId) || [];
            const filtered = current.slice(1); // Remove first reaction
            if (filtered.length === 0) {
              updated.delete(peerId);
            } else {
              updated.set(peerId, filtered);
            }
            return updated;
          });
        }, 3000);
      }
    };

    window.addEventListener('peer-reaction' as any, handlePeerReaction as any);
    return () => {
      window.removeEventListener('peer-reaction' as any, handlePeerReaction as any);
    };
  }, []);

  const promptForUsername = () => {
    // Check session storage
    const storedUsername = sessionStorage.getItem(`username_${roomId}`);
    
    if (storedUsername) {
      setUsername(storedUsername);
      setMyUsername(storedUsername);
      setIsUsernameSet(true);
    } else {
      const name = prompt('Please enter your name:', 'Guest');
      const finalName = name?.trim() || `Guest_${Math.random().toString(36).substr(2, 5)}`;
      setUsername(finalName);
      setMyUsername(finalName);
      sessionStorage.setItem(`username_${roomId}`, finalName);
      setIsUsernameSet(true);
    }
  };

  const initializeMedia = async () => {
    try {
      const stream = await webRTCService.getUserMedia();
      setLocalStream(stream);
      setCameraStream(stream); // Save camera stream separately
      console.log('Local media initialized');
    } catch (error) {
      console.error('Error accessing media:', error);
      alert('Could not access camera and microphone. Please grant permissions.');
    }
  };

  const connectWebSocket = () => {
    const wsUrl = getWebSocketUrl(`/room/${roomId}/websocket`);
    console.log('Connecting to WebSocket:', wsUrl);
    
    webSocketService.connect(wsUrl);

    webSocketService.onOpen(() => {
      console.log('Connected to signaling server');
    });

    webSocketService.onError((error) => {
      console.error('WebSocket error:', error);
    });

    webSocketService.onClose(() => {
      console.log('WebSocket closed');
    });
  };

  const handleCopyLink = async () => {
    const roomLink = `${window.location.origin}/room/${roomId}`;
    try {
      await copyToClipboard(roomLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleLeaveRoom = () => {
    if (confirm('Are you sure you want to leave the room?')) {
      cleanup();
      router.push('/');
    }
  };

  const handleScreenShare = async () => {
    console.log('🎯 handleScreenShare called, myPeerId:', myPeerId, 'mediaSettings.screenSharing:', mediaSettings.screenSharing);
    if (!myPeerId) return;

    if (mediaSettings.screenSharing) {
      // Stop screen sharing
      console.log('🛑 Stopping screen share');
      toggleScreenShare();
      setActiveSharingPeer(null);
      setScreenStream(null); // Clear screen stream
      webSocketService.send({
        event: 'screen-share-stopped',
        data: { peerId: myPeerId },
      });

      // Remove screen track from all peer connections
      peerConnections.forEach((peer) => {
        const senders = peer.connection.getSenders();
        const screenSender = senders.find((s) => s.track?.kind === 'video' && s.track.label.includes('screen'));
        if (screenSender) {
          screenSender.replaceTrack(null);
        }
      });
    } else {
      // Start screen sharing
      try {
        console.log('📺 Starting screen share');
        const screenStream = await webRTCService.getDisplayMedia();
        console.log('📺 Screen stream obtained:', screenStream.getVideoTracks().map(t => t.label));
        setScreenStream(screenStream); // Store screen stream
        toggleScreenShare();
        setActiveSharingPeer(myPeerId);
        if (!cameraStream && localStream) {
          setCameraStream(localStream);
        }
        webSocketService.send({
          event: 'screen-share-started',
          data: { 
            peerId: myPeerId,
            username: myUsername,
          },
        });

        // Add screen track to all peer connections
        peerConnections.forEach((peer) => {
          const senders = peer.connection.getSenders();
          const screenTrack = screenStream.getVideoTracks()[0];
          if (screenTrack) {
            // Only add if not already present
            const alreadyAdded = senders.some((s) => s.track?.id === screenTrack.id);
            if (!alreadyAdded) {
              peer.connection.addTrack(screenTrack, screenStream);
              console.log(`📺 Added screen track to peer ${peer.id}`);
            }
          }
        });

        // Renegotiate all peer connections to send the new screen track
        peerConnections.forEach((peer) => {
          renegotiatePeerConnection(peer.id);
        });

        // When screen share ends, remove screen track from all peer connections
        screenStream.getVideoTracks()[0].onended = async () => {
          console.log('📺 Screen share ended (user stopped sharing)');
          toggleScreenShare();
          setActiveSharingPeer(null);
          webSocketService.send({
            event: 'screen-share-stopped',
            data: { peerId: myPeerId },
          });
          peerConnections.forEach((peer) => {
            const senders = peer.connection.getSenders();
            const screenSender = senders.find((s) => s.track?.kind === 'video' && s.track.label.includes('screen'));
            if (screenSender) {
              screenSender.replaceTrack(null);
            }
          });
        };
      } catch (error) {
        console.error('❌ Error sharing screen:', error);
        alert('Could not share screen. Please try again.');
      }
    }
  };

  const cleanup = () => {
    if (localStream) {
      webRTCService.stopStream(localStream);
    }
    if (screenStream) {
      webRTCService.stopStream(screenStream);
      setScreenStream(null);
    }
    webSocketService.disconnect();
    // Close all peer connections
    peerConnections.forEach((peer) => {
      webRTCService.closePeerConnection(peer.connection);
    });
  };

  const handleChatToggle = () => {
    toggleChat();
  };

  const handleSendMessage = (message: string) => {
    sendMessage(message);
  };

  const handleReactionSelect = (emoji: ReactionType) => {
    // Send WebSocket message
    webSocketService.send({
      event: 'reaction',
      data: {
        emoji,
        peerId: myPeerId,
      },
    });

    // Show reaction on own video immediately
    if (myPeerId) {
      setPeerReactions((prev) => {
        const updated = new Map(prev);
        const current = updated.get(myPeerId) || [];
        updated.set(myPeerId, [...current, emoji]);
        return updated;
      });

      // Clear after animation
      setTimeout(() => {
        setPeerReactions((prev) => {
          const updated = new Map(prev);
          const current = updated.get(myPeerId!) || [];
          updated.set(myPeerId!, current.slice(1));
          return updated;
        });
      }, 3000);
    }
  };

  if (!isUsernameSet) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary">Setting up room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background-secondary">
      {/* Header */}
      <header className="glass-dark border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-text-primary">
                  Room: <span className="text-primary">{roomId}</span>
                </h2>
                {/* Room Locked Indicator */}
                {isRoomLocked && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full">
                    <Lock className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-xs font-medium text-red-500">Locked</span>
                  </div>
                )}
                {/* Recording Indicator */}
                {recordingState.isRecording && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-red-500">Recording</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-text-secondary mt-1">
                <Users className="w-4 h-4 inline mr-1" />
                {participants.size + 1} participant{participants.size !== 0 ? 's' : ''}
              </p>
            </div>
          </div>

          <Button
            onClick={handleCopyLink}
            variant="secondary"
            size="sm"
            className="gap-2"
          >
            {isCopied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Link
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Screen Sharing Layout */}
        {activeSharingPeerId ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Main Screen Share View */}
            <div className="flex-1 p-6 flex items-center justify-center bg-black/20">
              <div className="relative w-full h-full">
                {/* Screen Share Badge */}
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-2 bg-blue-500/90 backdrop-blur-sm border border-blue-400/50 rounded-lg shadow-lg">
                  <Monitor className="w-4 h-4 text-white" />
                  <span className="text-sm font-medium text-white">
                    {activeSharingPeerId === myPeerId 
                      ? 'You are presenting'
                      : `${peerConnections.get(activeSharingPeerId)?.username || 'Someone'} is presenting`
                    }
                  </span>
                </div>

                {/* Large Screen Share Video */}
                <div className="w-full h-full rounded-lg overflow-hidden bg-black shadow-2xl">
                  {/* Show the screen stream for the sharing user in the main area */}
                  {activeSharingPeerId === myPeerId ? (
                    <VideoPlayer
                      stream={screenStream} // Use stored screen stream
                      username={`${myUsername} (Screen)`}
                      peerId={myPeerId || undefined}
                      isLocal={true}
                      isMuted={!mediaSettings.audioEnabled}
                      isVideoEnabled={true}
                      isHandRaised={myPeerId ? raisedHands.has(myPeerId) : false}
                      reactions={myPeerId ? peerReactions.get(myPeerId) : []}
                    />
                  ) : (
                    <VideoPlayer
                      stream={(() => {
                        const peer = peerConnections.get(activeSharingPeerId);
                        if (!peer || !peer.stream) return null;
                        const videoTracks = peer.stream.getVideoTracks();
                        // Prefer a track labeled 'screen', fallback to the second video track if present
                        let screenTrack = videoTracks.find(t => t.label.toLowerCase().includes('screen'));
                        if (!screenTrack && videoTracks.length > 1) {
                          // Assume the second video track is the screen if two are present
                          screenTrack = videoTracks[1];
                        }
                        // Debug log
                        console.log('Remote video tracks for sharing peer:', videoTracks.map(t => `${t.label} (${t.id})`));
                        return screenTrack ? new MediaStream([screenTrack]) : null;
                      })()}
                      username={peerConnections.get(activeSharingPeerId)?.username || 'Unknown'}
                      peerId={activeSharingPeerId}
                      isMuted={false}
                      isVideoEnabled={true}
                      isHandRaised={raisedHands.has(activeSharingPeerId)}
                      reactions={peerReactions.get(activeSharingPeerId) || []}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Camera Sidebar - ALL participants' cameras */}
            <div className="w-80 bg-background-primary border-l border-border p-4 overflow-y-auto">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Participants ({participants.size + 1})
                </h3>

                {/* Local Camera - ALWAYS SHOW (use cameraStream when sharing) */}
                <div className="rounded-lg overflow-hidden border-2 border-primary/50 bg-background-card">
                  <div className="aspect-video">
                    <VideoPlayer
                      stream={(() => {
                        // Always show camera stream in sidebar
                        if (mediaSettings.screenSharing && cameraStream) {
                          return cameraStream;
                        }
                        // If not sharing, show localStream
                        return localStream;
                      })()}
                      username={`${myUsername} (You)`}
                      peerId={myPeerId || undefined}
                      isLocal={true}
                      isMuted={!mediaSettings.audioEnabled}
                      isVideoEnabled={mediaSettings.videoEnabled}
                      isHandRaised={myPeerId ? raisedHands.has(myPeerId) : false}
                      reactions={myPeerId ? peerReactions.get(myPeerId) : []}
                    />
                  </div>
                </div>

                {/* All Other Participants' Cameras */}
                {(() => {
                  const connectedPeers = Array.from(peerConnections.entries()).filter(([peerId, peer]) => {
                    // Only show peers that have established connections
                    const connectionState = peer.connection.connectionState;
                    const hasStream = !!peer.stream;
                    console.log(`Peer ${peerId} (${peer.username}): connection=${connectionState}, hasStream=${hasStream}`);
                    return connectionState === 'connected' || hasStream;
                  });

                  console.log('🎥 Rendering peer cameras, connected peers:', connectedPeers.map(([id, pc]) => ({
                    id,
                    username: pc.username,
                    hasStream: !!pc.stream,
                    connectionState: pc.connection.connectionState,
                    streamTracks: pc.stream ? {
                      audio: pc.stream.getAudioTracks().length,
                      video: pc.stream.getVideoTracks().length
                    } : null
                  })));

                  return connectedPeers.map(([peerId, peer]) => (
                    <div 
                      key={peerId}
                      className="rounded-lg overflow-hidden border-2 border-border hover:border-primary/30 transition-colors bg-background-card"
                    >
                      <div className="aspect-video">
                        <VideoPlayer
                          stream={(() => {
                            // Always show camera stream in sidebar
                            if (peerId === activeSharingPeerId && peer.stream) {
                              const camTrack = peer.stream.getVideoTracks().find(t => !t.label.includes('screen'));
                              return camTrack ? new MediaStream([camTrack]) : null;
                            }
                            return peer.stream || null;
                          })()}
                          username={peerId === activeSharingPeerId ? `${peer.username || 'Unknown'} (Sharing Screen)` : (peer.username || 'Unknown')}
                          peerId={peerId}
                          isMuted={false}
                          isVideoEnabled={peerId !== activeSharingPeerId}
                          isHandRaised={raisedHands.has(peerId)}
                          reactions={peerReactions.get(peerId) || []}
                        />
                      </div>
                    </div>
                  ));
                })()}

                {/* Show message if no other participants */}
                {Array.from(peerConnections.entries()).filter(([peerId, peer]) => 
                  peer.connection.connectionState === 'connected' || peer.stream
                ).length === 0 && (
                  <div className="text-center py-8 text-text-secondary">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No other participants connected</p>
                    <p className="text-xs mt-1">Share the room link to invite others</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Normal Grid Layout (No Screen Share) */
          <div className="flex-1 p-6 overflow-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-fr">
              {/* Local Video */}
              <VideoPlayer
                stream={localStream}
                username={`${myUsername} (You)`}
                peerId={myPeerId || undefined}
                isLocal={true}
                isMuted={!mediaSettings.audioEnabled}
                isVideoEnabled={mediaSettings.videoEnabled}
                isHandRaised={myPeerId ? raisedHands.has(myPeerId) : false}
                reactions={myPeerId ? peerReactions.get(myPeerId) : []}
              />

              {/* Remote Videos */}
              {Array.from(peerConnections.entries()).map(([peerId, peer]) => (
                <VideoPlayer
                  key={peerId}
                  stream={peer.stream || null}
                  username={peer.username}
                  peerId={peerId}
                  isMuted={false}
                  isVideoEnabled={true}
                  isHandRaised={raisedHands.has(peerId)}
                  reactions={peerReactions.get(peerId) || []}
                />
              ))}
            </div>
          </div>
        )}

        {/* Chat Sidebar */}
        {isChatOpen && (
          <ChatSidebar
            messages={messages}
            onSendMessage={handleSendMessage}
            onClose={handleChatToggle}
            isChatEnabled={isChatEnabled}
            currentUsername={myUsername}
          />
        )}
      </div>

      {/* Controls Bar */}
      <div className="glass-dark border-t border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Microphone */}
            <Button
              onClick={toggleAudio}
              variant={mediaSettings.audioEnabled ? 'secondary' : 'danger'}
              size="md"
              className="gap-2"
              title={mediaSettings.audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
            >
              {mediaSettings.audioEnabled ? (
                <>
                  <Mic className="w-5 h-5" />
                  <span className="hidden sm:inline">Mute</span>
                </>
              ) : (
                <>
                  <MicOff className="w-5 h-5" />
                  <span className="hidden sm:inline">Unmute</span>
                </>
              )}
            </Button>

            {/* Camera */}
            <Button
              onClick={toggleVideo}
              variant={mediaSettings.videoEnabled ? 'secondary' : 'danger'}
              size="md"
              className="gap-2"
              title={mediaSettings.videoEnabled ? 'Stop video' : 'Start video'}
            >
              {mediaSettings.videoEnabled ? (
                <>
                  <Video className="w-5 h-5" />
                  <span className="hidden sm:inline">Stop Video</span>
                </>
              ) : (
                <>
                  <VideoOff className="w-5 h-5" />
                  <span className="hidden sm:inline">Start Video</span>
                </>
              )}
            </Button>

            {/* Screen Share */}
            <Button
              onClick={handleScreenShare}
              variant={mediaSettings.screenSharing ? 'primary' : 'secondary'}
              size="md"
              className="gap-2"
              title={mediaSettings.screenSharing ? 'Stop sharing' : 'Share screen'}
            >
              {mediaSettings.screenSharing ? (
                <>
                  <MonitorOff className="w-5 h-5" />
                  <span className="hidden sm:inline">Stop Sharing</span>
                </>
              ) : (
                <>
                  <Monitor className="w-5 h-5" />
                  <span className="hidden sm:inline">Share Screen</span>
                </>
              )}
            </Button>

            {/* Raised Hand */}
            <RaisedHandButton />

            {/* Reactions */}
            <ReactionPicker onReactionSelect={handleReactionSelect} />
          </div>

          <div className="flex items-center gap-3">
            {/* Participants Panel */}
            <Button
              onClick={() => setIsParticipantsPanelOpen(true)}
              variant="secondary"
              size="md"
              className="gap-2"
              title="View participants"
            >
              <Users className="w-5 h-5" />
              <span className="hidden sm:inline">Participants</span>
              <span className="bg-primary/20 text-primary text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                {participants.size + 1}
              </span>
            </Button>

            {/* Admin Panel (Host Only) */}
            {isHost && (
              <Button
                onClick={() => setIsAdminPanelOpen(true)}
                variant="secondary"
                size="md"
                className="gap-2"
                title="Admin panel"
              >
                <Shield className="w-5 h-5" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            )}

            {/* Settings */}
            <Button
              onClick={() => setIsSettingsOpen(true)}
              variant="secondary"
              size="md"
              className="gap-2"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
              <span className="hidden sm:inline">Settings</span>
            </Button>

            {/* Chat Toggle */}
            <Button
              onClick={handleChatToggle}
              variant="secondary"
              size="md"
              className="relative gap-2"
              title="Toggle chat"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="hidden sm:inline">Chat</span>
              {unreadCount > 0 && !isChatOpen && (
                <span className="absolute -top-1 -right-1 bg-danger text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>

            {/* Leave Room */}
            <Button
              onClick={handleLeaveRoom}
              variant="danger"
              size="md"
              className="gap-2"
              title="Leave room"
            >
              <PhoneOff className="w-5 h-5" />
              <span className="hidden sm:inline">Leave</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Admin Panel Modal */}
      {isAdminPanelOpen && <AdminPanel onClose={() => setIsAdminPanelOpen(false)} />}

      {/* Participants Panel Modal */}
      {isParticipantsPanelOpen && (
        <ParticipantsPanel onClose={() => setIsParticipantsPanelOpen(false)} />
      )}

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
