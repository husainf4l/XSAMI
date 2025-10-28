'use client';

import { useEffect, useCallback } from 'react';
import { useRoomStore } from '@/store/room.store';
import { webSocketService } from '@/services/websocket.service';
import { webRTCService } from '@/services/webrtc.service';
import {
  WebSocketMessage,
  PeersMessage,
  PeerJoinedMessage,
  PeerLeftMessage,
  OfferMessage,
  AnswerMessage,
  CandidateMessage,
} from '@/types';

export const useWebRTCSignaling = (roomId: string) => {
  const {
    myPeerId,
    myUsername,
    localStream,
    peerConnections,
    setMyPeerId,
    setIsHost,
    setHostId,
    setRoomLocked,
    addPeerConnection,
    removePeerConnection,
    updatePeerStream,
    addParticipant,
    removeParticipant,
    setActiveSharingPeer,
    addRaisedHand,
    removeRaisedHand,
    setChatEnabled,
  } = useRoomStore();

  /**
   * Handle incoming peer tracks (video/audio)
   */
  const handleRemoteTrack = useCallback(
    (event: RTCTrackEvent, peerId: string) => {
      console.log('🎵 Received remote track from', peerId, ':', event.track.kind);
      console.log('Track details:', {
        id: event.track.id,
        kind: event.track.kind,
        enabled: event.track.enabled,
        muted: event.track.muted,
        readyState: event.track.readyState,
        streams: event.streams.length,
      });
      
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        console.log('Stream details:', {
          id: stream.id,
          audioTracks: stream.getAudioTracks().length,
          videoTracks: stream.getVideoTracks().length,
          audioEnabled: stream.getAudioTracks()[0]?.enabled,
        });
        updatePeerStream(peerId, stream);
        console.log('✅ Updated peer stream for', peerId);
      } else {
        console.warn('⚠️ No stream attached to track event');
      }
    },
    [updatePeerStream]
  );

  /**
   * Handle ICE candidate events
   */
  const handleIceCandidate = useCallback(
    (candidate: RTCIceCandidate, peerId: string) => {
      if (!myPeerId) return;

      webSocketService.send({
        event: 'candidate',
        data: {
          peerId: myPeerId,
          targetPeerId: peerId,
          candidate: JSON.stringify(candidate),
        },
      });
    },
    [myPeerId]
  );

  /**
   * Handle peer connection state changes
   */
  const handleConnectionStateChange = useCallback(
    (state: RTCPeerConnectionState, peerId: string) => {
      console.log(`🔌 Connection state with ${peerId}:`, state);

      if (state === 'connected') {
        console.log(`✅ Successfully connected to ${peerId}`);
      } else if (state === 'failed') {
        console.error(`❌ Connection failed with ${peerId}`);
        removePeerConnection(peerId);
        removeParticipant(peerId);
      } else if (state === 'disconnected') {
        console.warn(`⚠️ Disconnected from ${peerId}`);
        // Don't immediately remove, might reconnect
      } else if (state === 'closed') {
        console.log(`🔒 Connection closed with ${peerId}`);
        removePeerConnection(peerId);
        removeParticipant(peerId);
      }
    },
    [removePeerConnection, removeParticipant]
  );

  /**
   * Create a new peer connection
   */
  const createPeerConnection = useCallback(
    (peerId: string, username: string, isInitiator: boolean) => {
      console.log(`🔗 Creating peer connection for ${peerId} (${username}), initiator: ${isInitiator}`);

      // Create RTCPeerConnection
      const pc = webRTCService.createPeerConnection(
        (candidate) => handleIceCandidate(candidate, peerId),
        (event) => handleRemoteTrack(event, peerId),
        (state) => handleConnectionStateChange(state, peerId)
      );

      // Add local stream to peer connection
      if (localStream) {
        console.log('📤 Adding local stream to peer connection:', {
          audioTracks: localStream.getAudioTracks().length,
          videoTracks: localStream.getVideoTracks().length,
          audioEnabled: localStream.getAudioTracks()[0]?.enabled,
          videoEnabled: localStream.getVideoTracks()[0]?.enabled,
        });
        webRTCService.addStreamToPeer(pc, localStream);
      } else {
        console.warn('⚠️ No local stream available to add to peer connection');
      }

      // Store peer connection
      addPeerConnection(peerId, {
        id: peerId,
        connection: pc,
        username,
      });

      addParticipant(peerId, username);

      console.log(`✅ Peer connection created for ${username}, total connections:`, peerConnections.size + 1);

      // If initiator, create and send offer
      if (isInitiator) {
        createAndSendOffer(peerId, pc);
      }

      return pc;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      localStream,
      handleIceCandidate,
      handleRemoteTrack,
      handleConnectionStateChange,
      addPeerConnection,
      addParticipant,
    ]
  );  /**
   * Create and send WebRTC offer
   */
  const createAndSendOffer = async (peerId: string, pc: RTCPeerConnection) => {
    if (!myPeerId || !myUsername) return;

    try {
      const offer = await webRTCService.createOffer(pc);

      webSocketService.send({
        event: 'offer',
        data: {
          peerId: myPeerId,
          username: myUsername,
          targetPeerId: peerId,
          sdp: offer.sdp,
        },
      });

      console.log('Sent offer to', peerId);
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  /**
   * Handle WebRTC offer from remote peer
   */
  const handleOffer = async (message: OfferMessage) => {
    const { peerId, username, sdp } = message;

    console.log('📨 Received offer from', peerId, username);

    // Get or create peer connection
    let peer = peerConnections.get(peerId);
    let pc: RTCPeerConnection;

    if (!peer) {
      console.log('🆕 Creating new peer connection for offer from', username);
      pc = createPeerConnection(peerId, username, false);
    } else {
      console.log('♻️ Reusing existing peer connection for', username);
      pc = peer.connection;
      // Update participant name
      addParticipant(peerId, username);
    }

    try {
      // Set remote description
      await webRTCService.setRemoteDescription(pc, {
        type: 'offer',
        sdp: sdp,
      });

      // Create and send answer
      const answer = await webRTCService.createAnswer(pc);

      webSocketService.send({
        event: 'answer',
        data: {
          peerId: myPeerId,
          targetPeerId: peerId,
          sdp: answer.sdp,
        },
      });

      console.log('✅ Sent answer to', peerId);
    } catch (error) {
      console.error('❌ Error handling offer:', error);
    }
  };

  /**
   * Handle WebRTC answer from remote peer
   */
  const handleAnswer = async (message: AnswerMessage) => {
    const { peerId, sdp } = message;

    console.log('📬 Received answer from', peerId);

    const peer = peerConnections.get(peerId);
    if (!peer) {
      console.error('❌ Peer connection not found for', peerId);
      return;
    }

    try {
      await webRTCService.setRemoteDescription(peer.connection, {
        type: 'answer',
        sdp: sdp,
      });

      console.log('✅ Set remote description for', peerId);
      console.log('🔗 Connection state:', peer.connection.connectionState);
      console.log('🧊 ICE connection state:', peer.connection.iceConnectionState);
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  };

  /**
   * Handle ICE candidate
   */
  const handleCandidate = async (message: CandidateMessage) => {
    const { peerId, candidate: candidateStr } = message;

    const peer = peerConnections.get(peerId);
    if (!peer) {
      console.warn('⚠️ Received ICE candidate for unknown peer:', peerId);
      return;
    }

    try {
      const candidate = JSON.parse(candidateStr) as RTCIceCandidateInit;
      await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('🧊 Added ICE candidate from', peerId);
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
    }
  };

  /**
   * Handle signaling messages from WebSocket
   */
  const handleSignalingMessage = useCallback(
    async (message: WebSocketMessage) => {
      switch (message.event) {
        case 'peers': {
          const data = message.data as PeersMessage;
          console.log('Received peers list:', data);
          console.log('Peers details:', {
            yourId: data.yourId,
            isHost: data.isHost,
            hostId: data.hostId,
            peers: data.peers,
            roomLocked: data.roomLocked
          });

          // Set our peer ID and role
          setMyPeerId(data.yourId);
          setIsHost(data.isHost);
          setHostId(data.hostId);
          
          if (data.roomLocked !== undefined) {
            setRoomLocked(data.roomLocked);
          }

          // Create peer connections for existing peers
          if (data.peers && data.peers.length > 0) {
            console.log(`🔗 Connecting to ${data.peers.length} existing peer(s)`);
            data.peers.forEach((peerId) => {
              if (peerId !== data.yourId && !peerConnections.has(peerId)) {
                // We are the initiator for existing peers
                // The actual username will be received in the offer/answer exchange
                console.log(`📞 Initiating connection to peer: ${peerId}`);
                createPeerConnection(peerId, `User ${peerId.substr(-4)}`, true);
              }
            });
          } else {
            console.log('📭 No existing peers in the room');
          }
          break;
        }

        case 'peer-joined': {
          const data = message.data as PeerJoinedMessage;
          console.log('👤 Peer joined:', data.peerId, data.username);
          console.log('Current peer connections before adding:', Array.from(peerConnections.keys()));

          if (data.peerId !== myPeerId) {
            if (!peerConnections.has(data.peerId)) {
              // Create peer connection and wait for their offer (they are the initiator)
              console.log(`🤝 Preparing to receive offer from: ${data.username}`);
              createPeerConnection(data.peerId, data.username, false);
            } else {
              // Update username if connection already exists
              console.log(`📝 Updating username for ${data.peerId}: ${data.username}`);
              addParticipant(data.peerId, data.username);
            }
          }
          break;
        }

        case 'peer-left': {
          const data = message.data as PeerLeftMessage;
          console.log('Peer left:', data.peerId);

          const peer = peerConnections.get(data.peerId);
          if (peer) {
            webRTCService.closePeerConnection(peer.connection);
            removePeerConnection(data.peerId);
            removeParticipant(data.peerId);
          }
          break;
        }

        case 'offer': {
          await handleOffer(message.data as OfferMessage);
          break;
        }

        case 'answer': {
          await handleAnswer(message.data as AnswerMessage);
          break;
        }

        case 'candidate': {
          await handleCandidate(message.data as CandidateMessage);
          break;
        }

        case 'screen-share-started': {
          console.log('📺 Received screen-share-started event:', message.data);
          setActiveSharingPeer(message.data.peerId);
          break;
        }

        case 'screen-share-stopped': {
          console.log('🛑 Received screen-share-stopped event:', message.data);
          setActiveSharingPeer(null);
          break;
        }

        case 'room-locked': {
          setRoomLocked(true);
          break;
        }

        case 'room-unlocked': {
          setRoomLocked(false);
          break;
        }

        case 'kicked': {
          alert('You have been removed from the room by the host.');
          window.location.href = '/';
          break;
        }

        case 'raise-hand': {
          // Handle remote participant raising hand
          const { peerId, username } = message.data;
          if (peerId && username) {
            addRaisedHand(peerId, username);
          }
          break;
        }

        case 'lower-hand': {
          // Handle remote participant lowering hand
          const { peerId } = message.data;
          if (peerId) {
            removeRaisedHand(peerId);
          }
          break;
        }

        case 'reaction': {
          // Handle reaction from remote participant
          const { peerId, emoji } = message.data;
          if (peerId && emoji) {
            // Dispatch custom event for VideoPlayer to handle
            window.dispatchEvent(
              new CustomEvent('peer-reaction', {
                detail: { peerId, emoji },
              })
            );
          }
          break;
        }

        case 'chat-enabled': {
          setChatEnabled(true);
          break;
        }

        case 'chat-disabled': {
          setChatEnabled(false);
          break;
        }

        default:
          console.log('Unknown signaling event:', message.event);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      myPeerId,
      peerConnections,
      createPeerConnection,
      setMyPeerId,
      setIsHost,
      setHostId,
      setRoomLocked,
      removePeerConnection,
      removeParticipant,
      setActiveSharingPeer,
      addRaisedHand,
      removeRaisedHand,
      setChatEnabled,
    ]
  );

  /**
   * Initialize WebSocket connection and send join message
   */
  useEffect(() => {
    if (!myUsername) return;

    const unsubscribe = webSocketService.onMessage(handleSignalingMessage);

    // Send join message when connected
    const unsubscribeOpen = webSocketService.onOpen(() => {
      const tempPeerId = `peer_${Math.random().toString(36).substr(2, 9)}`;
      
      webSocketService.send({
        event: 'join',
        data: {
          peerId: tempPeerId,
          username: myUsername,
        },
      });
    });

    return () => {
      unsubscribe();
      unsubscribeOpen();
    };
  }, [myUsername, handleSignalingMessage]);

  return {
    createPeerConnection,
  };
};
