'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRoomStore } from '@/store/room.store';
import { webSocketService } from '@/services/websocket.service';
import { webRTCService } from '@/services/webrtc.service';
import type {
  WebSocketMessage,
  PeerJoinedMessage,
  PeerLeftMessage,
  OfferMessage,
  AnswerMessage,
  CandidateMessage,
} from '@/types';

/**
 * Modern WebRTC Signaling Hook
 * 
 * Features:
 * - Automatic peer connection management
 * - Proper cleanup and resource management
 * - Separate camera and screen tracks
 * - ICE candidate queuing
 * - Connection quality monitoring
 * - Error recovery
 */
export function useWebRTCSignaling(roomId: string) {
  const {
    myPeerId,
    myUsername,
    localStream,
    screenStream,
    setMyPeerId,
    setIsHost,
    setHostId,
    setRoomLocked,
    addPeerConnection,
    removePeerConnection,
    updatePeerStream,
    updatePeerCameraStream,
    updatePeerScreenStream,
    addParticipant,
    removeParticipant,
    setActiveSharingPeer,
    addRaisedHand,
    removeRaisedHand,
    setChatEnabled,
  } = useRoomStore();

  // ICE candidate queue - stores candidates until remote description is set
  const iceCandidateQueue = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  
  // Track if we've joined the room
  const hasJoined = useRef(false);

  // Track peers who are actively screen sharing (announced via WebSocket)
  const screenSharingPeers = useRef<Set<string>>(new Set());

  /**
   * Handle incoming remote tracks
   */
  const handleRemoteTrack = useCallback((event: RTCTrackEvent, peerId: string) => {
    const stream = event.streams[0];
    const track = event.track;

    if (!stream) {
      console.warn('⚠️ No stream for track from:', peerId);
      return;
    }

    console.log('📥 Remote track:', {
      peer: peerId,
      kind: track.kind,
      label: track.label,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
    });

    // Get current peer connection from store
    const currentConnections = useRoomStore.getState().peerConnections;
    const peer = currentConnections.get(peerId);

    if (!peer) {
      console.warn('⚠️ Peer not found:', peerId);
      console.warn('Available peers:', Array.from(currentConnections.keys()));
      return;
    }

    // Detect if this is a screen share track
    // Method 1: Check displaySurface if available (most reliable native method)
    let isScreenTrack = false;
    if (track.kind === 'video') {
      try {
        const settings = track.getSettings();
        if (settings.displaySurface) {
          isScreenTrack = true;
          console.log('🖥️ Screen detected via displaySurface:', settings.displaySurface);
        }
      } catch (error) {
        // Ignore if not supported
      }
    }
    
    // Method 2: Fallback to label/ID checking
    if (!isScreenTrack) {
      isScreenTrack =
        track.label.toLowerCase().includes('screen') ||
        track.label.toLowerCase().includes('display') ||
        track.label.toLowerCase().includes('window') ||
        stream.id.includes('screen');
    }
    
    // Method 3: Check if this peer has been announced as screen sharing
    // If they're screen sharing and we receive a NEW video track AFTER they already have camera tracks
    if (!isScreenTrack && screenSharingPeers.current.has(peerId) && track.kind === 'video') {
      const hasExistingCameraTrack = peer.cameraStream && peer.cameraStream.getVideoTracks().length > 0;
      const hasExistingScreenTrack = peer.screenStream && peer.screenStream.getVideoTracks().length > 0;
      
      // If peer already has camera but no screen yet, this new track is the screen
      if (hasExistingCameraTrack && !hasExistingScreenTrack) {
        isScreenTrack = true;
        console.log('🖥️ Screen detected via WebSocket (new track after camera) for:', peerId);
      } 
      // If peer has neither camera nor screen yet, this first track is the camera
      else if (!hasExistingCameraTrack && !hasExistingScreenTrack) {
        isScreenTrack = false;
        console.log('📹 First track is camera (screen coming next) for:', peerId);
      }
      // If peer already has screen, any new track is additional (likely camera renegotiation)
      else if (hasExistingScreenTrack) {
        isScreenTrack = false;
        console.log('📹 Additional track after screen (treating as camera) for:', peerId);
      }
    }

    if (isScreenTrack) {
      console.log('🖥️ Screen track from:', peerId);
      updatePeerScreenStream(peerId, stream);
      setActiveSharingPeer(peerId);
      
      // Handle screen track ending
      track.onended = () => {
        console.log('🛑 Screen track ended:', peerId);
        updatePeerScreenStream(peerId, null);
        screenSharingPeers.current.delete(peerId);
        const state = useRoomStore.getState();
        if (state.activeSharingPeerId === peerId) {
          setActiveSharingPeer(null);
        }
      };
    } else {
      console.log('📹 Camera/mic track from:', peerId);
      
      // Build camera stream from all non-screen tracks
      let cameraStream = peer.cameraStream || new MediaStream();
      
      // Add track if not already present
      const existingTrack = cameraStream.getTrackById(track.id);
      if (!existingTrack) {
        cameraStream.addTrack(track);
      }
      
      updatePeerCameraStream(peerId, cameraStream);
      
      // Handle track ending
      track.onended = () => {
        console.log('🛑 Camera track ended:', peerId, track.kind);
      };
    }

    // Update merged stream (for backwards compatibility)
    const cameraStream = peer.cameraStream;
    const screenStreamObj = peer.screenStream;
    const allTracks = [
      ...(cameraStream?.getTracks() || []),
      ...(screenStreamObj?.getTracks() || []),
    ];
    const mergedStream = new MediaStream(allTracks);
    updatePeerStream(peerId, mergedStream);

    console.log('✅ Peer streams updated:', {
      peer: peerId,
      camera: cameraStream?.getTracks().length || 0,
      screen: screenStreamObj?.getTracks().length || 0,
    });
  }, [updatePeerStream, updatePeerCameraStream, updatePeerScreenStream, setActiveSharingPeer]);

  /**
   * Handle ICE candidate
   */
  const handleIceCandidate = useCallback((candidate: RTCIceCandidate, peerId: string) => {
    console.log('🧊 Sending ICE candidate to:', peerId);
    
    webSocketService.send({
      event: 'candidate',
      data: {
        peerId: myPeerId,
        username: myUsername,
        targetPeerId: peerId,
        candidate: candidate.toJSON(),
      },
    });
  }, [myPeerId, myUsername]);

  /**
   * Handle connection state changes
   */
  const handleConnectionStateChange = useCallback((state: RTCPeerConnectionState, peerId: string) => {
    console.log(`🔗 Connection state [${peerId}]:`, state);

    switch (state) {
      case 'connected':
        console.log('✅ Connected to:', peerId);
        break;
      case 'disconnected':
        console.warn('⚠️ Disconnected from:', peerId);
        break;
      case 'failed':
      case 'closed':
        console.error('❌ Connection failed/closed:', peerId);
        removePeerConnection(peerId);
        removeParticipant(peerId);
        break;
    }
  }, [removePeerConnection, removeParticipant]);

  /**
   * Create and send offer
   */
  const createAndSendOffer = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
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
      
      console.log('📤 Offer sent to:', peerId);
    } catch (error) {
      console.error('❌ Failed to create offer:', error);
    }
  }, [myPeerId, myUsername]);

  /**
   * Create and send answer
   */
  const createAndSendAnswer = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    try {
      const answer = await webRTCService.createAnswer(pc);
      
      webSocketService.send({
        event: 'answer',
        data: {
          peerId: myPeerId,
          username: myUsername,
          targetPeerId: peerId,
          sdp: answer.sdp,
        },
      });
      
      console.log('📤 Answer sent to:', peerId);
    } catch (error) {
      console.error('❌ Failed to create answer:', error);
    }
  }, [myPeerId, myUsername]);

  /**
   * Create peer connection
   */
  const createPeerConnection = useCallback((
    peerId: string,
    username: string,
    isInitiator: boolean
  ): RTCPeerConnection => {
    console.log('🔗 Creating peer connection:', { peerId, username, isInitiator });

    // Create peer connection
    const pc = webRTCService.createPeerConnection(
      (candidate: RTCIceCandidate) => handleIceCandidate(candidate, peerId),
      (event: RTCTrackEvent) => handleRemoteTrack(event, peerId),
      (state: RTCPeerConnectionState) => handleConnectionStateChange(state, peerId)
    );

    // Add to store FIRST (before adding tracks to avoid race condition)
    addPeerConnection(peerId, { id: peerId, connection: pc, username });
    addParticipant(peerId, username);
    console.log('✅ Peer added to store:', peerId);

    // Add local tracks
    if (localStream) {
      const senders = webRTCService.addStreamToPeer(pc, localStream);
      console.log(`📤 Added ${senders.length} local tracks to:`, peerId);
    }

    // Add screen tracks if sharing
    if (screenStream) {
      const senders = webRTCService.addStreamToPeer(pc, screenStream);
      console.log(`📤 Added ${senders.length} screen tracks to:`, peerId);
    }

    // Handle negotiation
    pc.onnegotiationneeded = async () => {
      if (isInitiator && myPeerId && myUsername) {
        console.log('🤝 Negotiation needed with:', peerId);
        await createAndSendOffer(peerId, pc);
      }
    };

    // Initiate if we're the caller
    if (isInitiator) {
      createAndSendOffer(peerId, pc);
    }

    return pc;
  }, [
    myPeerId,
    myUsername,
    localStream,
    screenStream,
    handleIceCandidate,
    handleRemoteTrack,
    handleConnectionStateChange,
    addPeerConnection,
    addParticipant,
    createAndSendOffer,
  ]);

  /**
   * Handle signaling messages
   */
  const handleSignalingMessage = useCallback(async (message: WebSocketMessage) => {
    switch (message.event) {
      case 'peers': {
        const data = message.data;
        setMyPeerId(data.yourId);
        setIsHost(data.isHost);
        setHostId(data.hostId);
        setRoomLocked(data.roomLocked ?? false);

        console.log('👥 Received peers list:', {
          yourId: data.yourId,
          isHost: data.isHost,
          peersCount: data.peers?.length || 0,
        });

        // Create connections to existing peers
        (data.peers || []).forEach((peer: any) => {
          const peerId = typeof peer === 'string' ? peer : peer.peerId;
          const username = typeof peer === 'string' ? `User ${peer.slice(-4)}` : peer.username;

          if (peerId && peerId !== data.yourId) {
            const currentConnections = useRoomStore.getState().peerConnections;
            if (!currentConnections.has(peerId)) {
              createPeerConnection(peerId, username, true);
            }
          }
        });
        break;
      }

      case 'peer-joined': {
        const { peerId, username } = message.data as PeerJoinedMessage;
        console.log('👤 Peer joined:', { peerId, username });

        if (peerId && peerId !== myPeerId) {
          const currentConnections = useRoomStore.getState().peerConnections;
          if (!currentConnections.has(peerId)) {
            createPeerConnection(peerId, username, false);
          }
        }
        break;
      }

      case 'peer-left': {
        const { peerId } = message.data as PeerLeftMessage;
        console.log('👋 Peer left:', peerId);

        // Clean up screen sharing tracking
        screenSharingPeers.current.delete(peerId);

        const currentConnections = useRoomStore.getState().peerConnections;
        const peer = currentConnections.get(peerId);
        if (peer) {
          webRTCService.closePeerConnection(peer.connection);
          removePeerConnection(peerId);
          removeParticipant(peerId);
        }
        break;
      }

      case 'offer': {
        const data = message.data as OfferMessage;
        console.log('📥 Received offer from:', data.peerId);

        let currentConnections = useRoomStore.getState().peerConnections;
        let peer = currentConnections.get(data.peerId);

        // Create peer connection if it doesn't exist
        if (!peer) {
          const pc = createPeerConnection(data.peerId, data.username || 'Guest', false);
          currentConnections = useRoomStore.getState().peerConnections;
          peer = currentConnections.get(data.peerId);
        }

        if (peer) {
          await webRTCService.setRemoteDescription(peer.connection, {
            type: 'offer',
            sdp: data.sdp,
          });

          // Process queued ICE candidates
          const queue = iceCandidateQueue.current.get(data.peerId);
          if (queue) {
            console.log(`🧊 Processing ${queue.length} queued candidates for:`, data.peerId);
            for (const candidate of queue) {
              await webRTCService.addIceCandidate(peer.connection, candidate);
            }
            iceCandidateQueue.current.delete(data.peerId);
          }

          await createAndSendAnswer(data.peerId, peer.connection);
        }
        break;
      }

      case 'answer': {
        const data = message.data as AnswerMessage;
        console.log('📥 Received answer from:', data.peerId);

        const currentConnections = useRoomStore.getState().peerConnections;
        const peer = currentConnections.get(data.peerId);

        if (peer) {
          await webRTCService.setRemoteDescription(peer.connection, {
            type: 'answer',
            sdp: data.sdp,
          });

          // Process queued ICE candidates
          const queue = iceCandidateQueue.current.get(data.peerId);
          if (queue) {
            console.log(`🧊 Processing ${queue.length} queued candidates for:`, data.peerId);
            for (const candidate of queue) {
              await webRTCService.addIceCandidate(peer.connection, candidate);
            }
            iceCandidateQueue.current.delete(data.peerId);
          }
        }
        break;
      }

      case 'candidate': {
        const data = message.data as CandidateMessage;
        console.log('🧊 Received ICE candidate from:', data.peerId);

        const currentConnections = useRoomStore.getState().peerConnections;
        const peer = currentConnections.get(data.peerId);

        if (peer) {
          // Parse candidate if it's a string
          const candidate = typeof data.candidate === 'string' 
            ? JSON.parse(data.candidate) 
            : data.candidate;

          if (peer.connection.remoteDescription) {
            await webRTCService.addIceCandidate(peer.connection, candidate);
          } else {
            // Queue candidate if remote description not yet set
            if (!iceCandidateQueue.current.has(data.peerId)) {
              iceCandidateQueue.current.set(data.peerId, []);
            }
            iceCandidateQueue.current.get(data.peerId)!.push(candidate);
            console.log('🧊 Queued ICE candidate for:', data.peerId);
          }
        }
        break;
      }

      case 'screen-share-started': {
        const { peerId } = message.data;
        console.log('🖥️ Peer started screen sharing:', peerId);
        
        // Mark this peer as screen sharing
        // The next video track received will be detected as screen share
        screenSharingPeers.current.add(peerId);
        setActiveSharingPeer(peerId);
        
        // Don't reclassify existing tracks - wait for the actual screen track to arrive
        // The detection logic will properly classify new incoming tracks
        break;
      }

      case 'screen-share-stopped': {
        const { peerId } = message.data;
        console.log('🛑 Peer stopped screen sharing:', peerId);
        
        // Remove from screen sharing peers
        screenSharingPeers.current.delete(peerId);
        
        const state = useRoomStore.getState();
        if (state.activeSharingPeerId === peerId) {
          setActiveSharingPeer(null);
        }
        
        // Clear screen stream
        updatePeerScreenStream(peerId, null);
        break;
      }

      case 'raise-hand': {
        const { peerId, username } = message.data;
        console.log('✋ Hand raised:', username);
        addRaisedHand(peerId, username);
        break;
      }

      case 'lower-hand': {
        const { peerId } = message.data;
        console.log('👋 Hand lowered:', peerId);
        removeRaisedHand(peerId);
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

      case 'reaction': {
        // Reactions are handled at the page component level via custom event
        // This allows the page to manage temporary reaction animations
        const { peerId, emoji } = message.data;
        if (peerId && emoji) {
          console.log('🎉 Reaction received:', emoji, 'from:', peerId);
          // Dispatch custom event for the page to handle
          window.dispatchEvent(new CustomEvent('peer-reaction', {
            detail: { peerId, emoji }
          }));
        }
        break;
      }
    }
  }, [
    myPeerId,
    setMyPeerId,
    setIsHost,
    setHostId,
    setRoomLocked,
    createPeerConnection,
    removePeerConnection,
    removeParticipant,
    createAndSendAnswer,
    setActiveSharingPeer,
    addRaisedHand,
    removeRaisedHand,
    setChatEnabled,
  ]);

  /**
   * Initialize WebSocket connection
   */
  useEffect(() => {
    if (!myUsername) {
      console.log('⏸️ Waiting for username...');
      return;
    }

    if (!localStream) {
      console.log('⏸️ Waiting for local stream...');
      return;
    }

    if (hasJoined.current) {
      console.log('✅ Already joined');
      return;
    }

    const wsUrl = `ws://localhost:8080/room/${roomId}/websocket`;
    console.log('🔌 Connecting to:', wsUrl, 'with media ready');

    // Subscribe to messages
    const unsubscribe = webSocketService.onMessage(handleSignalingMessage);

    // Connect
    webSocketService.connect(wsUrl);

    // Send join message when connected
    const unsubscribeOpen = webSocketService.onOpen(() => {
      const joinPeerId = myPeerId || `peer_${crypto.randomUUID().slice(0, 8)}`;
      
      console.log('📤 Sending join:', { peerId: joinPeerId, username: myUsername, hasMedia: true });
      
      webSocketService.send({
        event: 'join',
        data: { peerId: joinPeerId, username: myUsername },
      });

      hasJoined.current = true;
    });

    return () => {
      console.log('🧹 Cleaning up WebSocket subscriptions');
      unsubscribe();
      unsubscribeOpen();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, myUsername, localStream]);

  /**
   * Add screen stream to existing peers when sharing starts
   */
  useEffect(() => {
    if (!screenStream) return;

    console.log('🖥️ Screen stream available, adding to peers...');
    
    const currentConnections = useRoomStore.getState().peerConnections;
    currentConnections.forEach((peer) => {
      // Skip if peer connection is not in a valid state
      if (peer.connection.connectionState === 'closed' || peer.connection.connectionState === 'failed') {
        console.log('⏭️ Skipping closed/failed peer connection:', peer.id);
        return;
      }

      try {
        console.log('➕ Adding screen stream to:', peer.id);
        const addedSenders = webRTCService.addStreamToPeer(peer.connection, screenStream);
        
        // Trigger renegotiation if we added tracks
        if (addedSenders.length > 0) {
          console.log('🔄 Triggering renegotiation after adding screen tracks');
          createAndSendOffer(peer.id, peer.connection);
        }
      } catch (error) {
        console.error('❌ Error adding screen stream to peer:', peer.id, error);
      }
    });
  }, [screenStream, createAndSendOffer]);


  return {
    createPeerConnection,
  };
}
