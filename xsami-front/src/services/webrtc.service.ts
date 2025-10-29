import { RTCConfig } from '@/types';

const DEFAULT_RTC_CONFIG: RTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

class WebRTCService {
  private config: RTCConfig;

  constructor(config?: RTCConfig) {
    this.config = config || DEFAULT_RTC_CONFIG;
  }

  /**
   * Get user media with specified constraints
   */
  async getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream> {
    const defaultConstraints: MediaStreamConstraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };

    try {
      return await navigator.mediaDevices.getUserMedia(
        constraints || defaultConstraints
      );
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw new Error('Could not access camera and microphone. Please grant permissions.');
    }
  }

  /**
   * Get display media for screen sharing
   */
  async getDisplayMedia(): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      } as any);
    } catch (error) {
      console.error('Error accessing screen share:', error);
      throw new Error('Could not access screen sharing.');
    }
  }

  /**
   * Create a new peer connection
   */
  createPeerConnection(
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    onTrack: (event: RTCTrackEvent) => void,
    onConnectionStateChange: (state: RTCPeerConnectionState) => void
  ): RTCPeerConnection {
    const pc = new RTCPeerConnection(this.config);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate generated:', event.candidate.candidate);
        onIceCandidate(event.candidate);
      } else {
        console.log('🧊 ICE candidate gathering complete');
      }
    };

    pc.ontrack = (event) => {
      console.log('🎵 Track received:', {
        kind: event.track.kind,
        id: event.track.id,
        streams: event.streams.length,
      });
      onTrack(event);
    };

    pc.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', pc.connectionState);
      onConnectionStateChange(pc.connectionState);
    };

    // Monitor ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        console.error('❌ ICE connection failed - attempting restart');
        try {
          pc.restartIce();
          console.log('🔄 ICE restart initiated');
        } catch (error) {
          console.error('❌ ICE restart failed:', error);
        }
      } else if (pc.iceConnectionState === 'disconnected') {
        console.warn('⚠️ ICE connection disconnected');
      } else if (pc.iceConnectionState === 'connected') {
        console.log('✅ ICE connection established');
      }
    };

    // Monitor ICE gathering state
    pc.onicegatheringstatechange = () => {
      console.log('🧊 ICE gathering state:', pc.iceGatheringState);
    };

    // Monitor signaling state
    pc.onsignalingstatechange = () => {
      console.log('📡 Signaling state:', pc.signalingState);
    };

    return pc;
  }

  /**
   * Add local stream tracks to peer connection
   */
  addStreamToPeer(pc: RTCPeerConnection, stream: MediaStream): void {
    console.log('➕ Adding tracks to peer connection:', {
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length,
    });
    
    stream.getTracks().forEach((track) => {
      console.log(`  📎 Adding ${track.kind} track:`, {
        id: track.id,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      });
      pc.addTrack(track, stream);
    });
  }

  /**
   * Create and return an offer
   */
  async createOffer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await pc.setLocalDescription(offer);
    return offer;
  }

  /**
   * Create and return an answer
   */
  async createAnswer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  }

  /**
   * Set remote description
   */
  async setRemoteDescription(
    pc: RTCPeerConnection,
    description: RTCSessionDescriptionInit
  ): Promise<void> {
    await pc.setRemoteDescription(new RTCSessionDescription(description));
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(pc: RTCPeerConnection, candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  /**
   * Close peer connection
   */
  closePeerConnection(pc: RTCPeerConnection): void {
    console.log('🔒 Closing peer connection');
    pc.close();
  }

  /**
   * Stop all tracks in a stream
   */
  stopStream(stream: MediaStream): void {
    console.log('🛑 Stopping media stream');
    stream.getTracks().forEach((track) => {
      console.log(`Stopping ${track.kind} track:`, track.id);
      track.stop();
    });
  }

  /**
   * Toggle track enabled state
   */
  toggleTrack(stream: MediaStream, kind: 'audio' | 'video', enabled: boolean): void {
    stream.getTracks().forEach((track) => {
      if (track.kind === kind) {
        track.enabled = enabled;
      }
    });
  }

  /**
   * Get available media devices
   */
  async getMediaDevices(): Promise<MediaDeviceInfo[]> {
    try {
      return await navigator.mediaDevices.enumerateDevices();
    } catch (error) {
      console.error('Error enumerating devices:', error);
      return [];
    }
  }

  /**
   * Change audio input device
   */
  async changeAudioInput(stream: MediaStream, deviceId: string): Promise<MediaStream> {
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.stop();
    }

    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } },
    });

    const newAudioTrack = newStream.getAudioTracks()[0];
    if (newAudioTrack) {
      stream.removeTrack(audioTrack);
      stream.addTrack(newAudioTrack);
    }

    return stream;
  }

  /**
   * Change video input device
   */
  async changeVideoInput(stream: MediaStream, deviceId: string): Promise<MediaStream> {
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.stop();
    }

    const newStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: deviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    const newVideoTrack = newStream.getVideoTracks()[0];
    if (newVideoTrack) {
      stream.removeTrack(videoTrack);
      stream.addTrack(newVideoTrack);
    }

    return stream;
  }
}

export const webRTCService = new WebRTCService();
