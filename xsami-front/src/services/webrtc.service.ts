/**
 * Modern WebRTC Service with:
 * - Peer connection management
 * - Media stream handling (camera, microphone, screen)
 * - Track management
 * - Connection quality monitoring
 * - Error handling and recovery
 */

export interface MediaConstraints {
  video?: boolean | MediaTrackConstraints;
  audio?: boolean | MediaTrackConstraints;
}

export interface ConnectionStats {
  bytesReceived: number;
  bytesSent: number;
  packetsLost: number;
  jitter: number;
  roundTripTime: number;
}

export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'disconnected';

class WebRTCService {
  private readonly defaultConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  private readonly defaultMediaConstraints: MediaConstraints = {
    video: {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  };

  /**
   * Create a peer connection with callbacks
   */
  createPeerConnection(
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    onTrack: (event: RTCTrackEvent) => void,
    onConnectionStateChange: (state: RTCPeerConnectionState) => void,
    config?: Partial<RTCConfiguration>
  ): RTCPeerConnection {
    const finalConfig = { ...this.defaultConfig, ...config };
    const pc = new RTCPeerConnection(finalConfig);

    // ICE candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    // Track handler
    pc.ontrack = (event) => {
      console.log('📥 Track received:', {
        kind: event.track.kind,
        label: event.track.label,
        id: event.track.id,
        streams: event.streams.length,
      });
      onTrack(event);
    };

    // Connection state handler
    pc.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', pc.connectionState);
      onConnectionStateChange(pc.connectionState);
    };

    // ICE connection state handler
    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE state:', pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'failed') {
        console.warn('❌ ICE failed, attempting restart');
        pc.restartIce();
      }
    };

    // ICE gathering state handler
    pc.onicegatheringstatechange = () => {
      console.log('📡 ICE gathering:', pc.iceGatheringState);
    };

    return pc;
  }

  /**
   * Get user media (camera + microphone)
   */
  async getUserMedia(constraints?: MediaConstraints): Promise<MediaStream> {
    try {
      const finalConstraints = { ...this.defaultMediaConstraints, ...constraints };
      const stream = await navigator.mediaDevices.getUserMedia(finalConstraints);
      
      console.log('📹 User media acquired:', {
        video: stream.getVideoTracks().length,
        audio: stream.getAudioTracks().length,
        tracks: stream.getTracks().map((t) => ({ kind: t.kind, label: t.label, id: t.id })),
      });

      return stream;
    } catch (error) {
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotFoundError':
            throw new Error('No camera or microphone found');
          case 'NotAllowedError':
            throw new Error('Permission denied to access camera/microphone');
          case 'NotReadableError':
            throw new Error('Camera/microphone is already in use');
          default:
            throw new Error(`Media error: ${error.message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Get display media (screen sharing)
   */
  async getDisplayMedia(includeAudio = false): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
        } as MediaTrackConstraints,
        audio: includeAudio,
      });

      console.log('🖥️ Display media acquired:', {
        video: stream.getVideoTracks().length,
        audio: stream.getAudioTracks().length,
        tracks: stream.getTracks().map((t) => ({ kind: t.kind, label: t.label, id: t.id })),
      });

      // Handle screen share stop button
      stream.getVideoTracks()[0].onended = () => {
        console.log('🛑 Screen sharing stopped by user');
      };

      return stream;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        throw new Error('Screen sharing permission denied');
      }
      throw error;
    }
  }

  /**
   * Add tracks from stream to peer connection
   */
  addStreamToPeer(pc: RTCPeerConnection, stream: MediaStream): RTCRtpSender[] {
    const senders: RTCRtpSender[] = [];
    
    stream.getTracks().forEach((track) => {
      // Check if track already added
      const existingSender = pc.getSenders().find((s) => s.track?.id === track.id);
      
      if (!existingSender) {
        const sender = pc.addTrack(track, stream);
        senders.push(sender);
        console.log(`➕ Added ${track.kind} track to peer:`, track.label);
      } else {
        console.log(`⏭️ Track already added:`, track.label);
      }
    });

    return senders;
  }

  /**
   * Replace track in peer connection (useful for device switching)
   */
  async replaceTrack(
    pc: RTCPeerConnection,
    oldTrack: MediaStreamTrack,
    newTrack: MediaStreamTrack
  ): Promise<void> {
    const sender = pc.getSenders().find((s) => s.track?.id === oldTrack.id);
    
    if (!sender) {
      throw new Error('Sender not found for track');
    }

    await sender.replaceTrack(newTrack);
    console.log(`🔄 Replaced ${oldTrack.kind} track:`, {
      old: oldTrack.label,
      new: newTrack.label,
    });
  }

  /**
   * Remove track from peer connection
   */
  removeTrack(pc: RTCPeerConnection, track: MediaStreamTrack): void {
    const sender = pc.getSenders().find((s) => s.track?.id === track.id);
    
    if (sender) {
      pc.removeTrack(sender);
      console.log(`➖ Removed ${track.kind} track:`, track.label);
    }
  }

  /**
   * Stop all tracks in a stream
   */
  stopStream(stream: MediaStream): void {
    stream.getTracks().forEach((track) => {
      track.stop();
      console.log(`🛑 Stopped ${track.kind} track:`, track.label);
    });
  }

  /**
   * Stop specific track
   */
  stopTrack(track: MediaStreamTrack): void {
    track.stop();
    console.log(`🛑 Stopped ${track.kind} track:`, track.label);
  }

  /**
   * Create SDP offer
   */
  async createOffer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('📤 Offer created');
      return offer;
    } catch (error) {
      console.error('❌ Failed to create offer:', error);
      throw error;
    }
  }

  /**
   * Create SDP answer
   */
  async createAnswer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
    try {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('📤 Answer created');
      return answer;
    } catch (error) {
      console.error('❌ Failed to create answer:', error);
      throw error;
    }
  }

  /**
   * Set remote description
   */
  async setRemoteDescription(
    pc: RTCPeerConnection,
    description: RTCSessionDescriptionInit
  ): Promise<void> {
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(description));
      console.log('📥 Remote description set:', description.type);
    } catch (error) {
      console.error('❌ Failed to set remote description:', error);
      throw error;
    }
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(
    pc: RTCPeerConnection,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('🧊 ICE candidate added');
    } catch (error) {
      console.error('❌ Failed to add ICE candidate:', error);
      throw error;
    }
  }

  /**
   * Get connection statistics
   */
  async getConnectionStats(pc: RTCPeerConnection): Promise<ConnectionStats> {
    const stats = await pc.getStats();
    const result: ConnectionStats = {
      bytesReceived: 0,
      bytesSent: 0,
      packetsLost: 0,
      jitter: 0,
      roundTripTime: 0,
    };

    stats.forEach((report) => {
      if (report.type === 'inbound-rtp') {
        result.bytesReceived += report.bytesReceived || 0;
        result.packetsLost += report.packetsLost || 0;
        result.jitter = report.jitter || 0;
      } else if (report.type === 'outbound-rtp') {
        result.bytesSent += report.bytesSent || 0;
      } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        result.roundTripTime = report.currentRoundTripTime || 0;
      }
    });

    return result;
  }

  /**
   * Get connection quality assessment
   */
  async getConnectionQuality(pc: RTCPeerConnection): Promise<ConnectionQuality> {
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
      return 'disconnected';
    }

    try {
      const stats = await this.getConnectionStats(pc);
      
      // Calculate packet loss percentage
      const totalPackets = stats.packetsLost + 100; // Approximate
      const packetLossPercent = (stats.packetsLost / totalPackets) * 100;

      if (packetLossPercent < 1 && stats.roundTripTime < 0.1) {
        return 'excellent';
      } else if (packetLossPercent < 3 && stats.roundTripTime < 0.3) {
        return 'good';
      } else {
        return 'poor';
      }
    } catch (error) {
      console.error('Failed to get connection quality:', error);
      return 'poor';
    }
  }

  /**
   * Change audio input device
   */
  async changeAudioInput(deviceId: string): Promise<MediaStream> {
    try {
      return await this.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: false,
      });
    } catch (error) {
      console.error('Failed to change audio input:', error);
      throw error;
    }
  }

  /**
   * Change video input device
   */
  async changeVideoInput(deviceId: string): Promise<MediaStream> {
    try {
      return await this.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      });
    } catch (error) {
      console.error('Failed to change video input:', error);
      throw error;
    }
  }

  /**
   * Get available media devices
   */
  async getMediaDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log('🎤 Available devices:', {
        audio: devices.filter((d) => d.kind === 'audioinput').length,
        video: devices.filter((d) => d.kind === 'videoinput').length,
        audioOutput: devices.filter((d) => d.kind === 'audiooutput').length,
      });
      return devices;
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      throw error;
    }
  }

  /**
   * Close peer connection
   */
  closePeerConnection(pc: RTCPeerConnection): void {
    // Stop all senders
    pc.getSenders().forEach((sender) => {
      if (sender.track) {
        sender.track.stop();
      }
    });

    // Close connection
    pc.close();
    console.log('🔌 Peer connection closed');
  }

  /**
   * Check if browser supports WebRTC
   */
  isWebRTCSupported(): boolean {
    return !!(
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      window.RTCPeerConnection
    );
  }
}

// Export singleton instance
export const webRTCService = new WebRTCService();
