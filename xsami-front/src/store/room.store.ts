import { create } from 'zustand';
import {
  RoomState,
  PeerConnection,
  ChatMessage,
  MediaSettings,
  Poll,
  Question,
  RaisedHand,
  WaitingParticipant,
  RecordingState,
} from '@/types';

interface RoomStore extends RoomState {
  // Peer connections
  peerConnections: Map<string, PeerConnection>;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  
  // Media settings
  mediaSettings: MediaSettings;
  
  // Chat
  chatMessages: ChatMessage[];
  unreadCount: number;
  isChatOpen: boolean;
  
  // Admin features
  isChatEnabled: boolean;
  canParticipantsShare: boolean;
  activeSharingPeerId: string | null;
  
  // Actions - Room
  setRoomId: (roomId: string) => void;
  setMyPeerId: (peerId: string) => void;
  setMyUsername: (username: string) => void;
  setIsHost: (isHost: boolean) => void;
  setHostId: (hostId: string) => void;
  setRoomLocked: (locked: boolean) => void;
  
  // Actions - Peers
  addPeerConnection: (peerId: string, connection: PeerConnection) => void;
  removePeerConnection: (peerId: string) => void;
  updatePeerStream: (peerId: string, stream: MediaStream) => void;
  updatePeerCameraStream: (peerId: string, stream: MediaStream | null) => void;
  updatePeerScreenStream: (peerId: string, stream: MediaStream | null) => void;
  addParticipant: (peerId: string, username: string) => void;
  removeParticipant: (peerId: string) => void;
  
  // Actions - Media
  setLocalStream: (stream: MediaStream | null) => void;
  setScreenStream: (stream: MediaStream | null) => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  setMediaDevice: (type: 'audioInput' | 'audioOutput' | 'videoInput', deviceId: string) => void;
  
  // Actions - Chat
  addChatMessage: (message: ChatMessage) => void;
  clearUnreadCount: () => void;
  toggleChat: () => void;
  setChatEnabled: (enabled: boolean) => void;
  
  // Actions - Interactive features
  toggleRaiseHand: () => void;
  addRaisedHand: (peerId: string, username: string) => void;
  removeRaisedHand: (peerId: string) => void;
  clearRaisedHands: () => void;
  
  setActivePoll: (poll: Poll | null) => void;
  addQuestion: (question: Question) => void;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  
  // Actions - Waiting Room
  addWaitingParticipant: (participant: WaitingParticipant) => void;
  removeWaitingParticipant: (peerId: string) => void;
  
  // Actions - Recording
  startRecording: (recordingId: string) => void;
  stopRecording: () => void;
  updateRecordingDuration: (duration: number) => void;
  
  // Actions - Admin
  setCanParticipantsShare: (can: boolean) => void;
  setActiveSharingPeer: (peerId: string | null) => void;
  
  // Actions - Reset
  reset: () => void;
}

const initialMediaSettings: MediaSettings = {
  audioEnabled: true,
  videoEnabled: true,
  screenSharing: false,
  selectedAudioInput: 'default',
  selectedAudioOutput: 'default',
  selectedVideoInput: 'default',
};

export const useRoomStore = create<RoomStore>((set, get) => ({
  // Initial state
  roomId: '',
  myPeerId: null,
  myUsername: '',
  isHost: false,
  hostId: null,
  isRoomLocked: false,
  participants: new Map(),
  raisedHands: new Map(),
  activePoll: null,
  questions: [],
  waitingParticipants: new Map(),
  recordingState: {
    isRecording: false,
    startTime: null,
    duration: 0,
    recordingId: null,
  },
  
  peerConnections: new Map(),
  localStream: null,
  screenStream: null,
  mediaSettings: initialMediaSettings,
  
  chatMessages: [],
  unreadCount: 0,
  isChatOpen: false,
  isChatEnabled: true,
  canParticipantsShare: false,
  activeSharingPeerId: null,
  
  // Room actions
  setRoomId: (roomId) => set({ roomId }),
  setMyPeerId: (peerId) => set({ myPeerId: peerId }),
  setMyUsername: (username) => set({ myUsername: username }),
  setIsHost: (isHost) => set({ isHost }),
  setHostId: (hostId) => set({ hostId }),
  setRoomLocked: (locked) => set({ isRoomLocked: locked }),
  
  // Peer actions
  addPeerConnection: (peerId, connection) => {
    const peerConnections = new Map(get().peerConnections);
    peerConnections.set(peerId, connection);
    set({ peerConnections });
  },
  
  removePeerConnection: (peerId) => {
    const peerConnections = new Map(get().peerConnections);
    peerConnections.delete(peerId);
    set({ peerConnections });
  },
  
  updatePeerStream: (peerId, stream) => {
    const peerConnections = new Map(get().peerConnections);
    const peer = peerConnections.get(peerId);
    if (peer) {
      peer.stream = stream;
      peerConnections.set(peerId, peer);
      set({ peerConnections });
    }
  },
  
  updatePeerCameraStream: (peerId, stream) => {
    const peerConnections = new Map(get().peerConnections);
    const peer = peerConnections.get(peerId);
    if (peer) {
      peer.cameraStream = stream || undefined;
      peerConnections.set(peerId, peer);
      set({ peerConnections });
    }
  },
  
  updatePeerScreenStream: (peerId, stream) => {
    const peerConnections = new Map(get().peerConnections);
    const peer = peerConnections.get(peerId);
    if (peer) {
      peer.screenStream = stream || undefined;
      peerConnections.set(peerId, peer);
      set({ peerConnections });
    }
  },
  
  addParticipant: (peerId, username) => {
    const participants = new Map(get().participants);
    participants.set(peerId, username);
    set({ participants });
  },
  
  removeParticipant: (peerId) => {
    const participants = new Map(get().participants);
    participants.delete(peerId);
    set({ participants });
  },
  
  // Media actions
  setLocalStream: (stream) => set({ localStream: stream }),
  setScreenStream: (stream) => set({ screenStream: stream }),
  
  toggleAudio: () => {
    const { localStream, mediaSettings } = get();
    const newState = !mediaSettings.audioEnabled;
    
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = newState;
      });
    }
    
    set({
      mediaSettings: { ...mediaSettings, audioEnabled: newState }
    });
  },
  
  toggleVideo: () => {
    const { localStream, mediaSettings } = get();
    const newState = !mediaSettings.videoEnabled;
    
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = newState;
      });
    }
    
    set({
      mediaSettings: { ...mediaSettings, videoEnabled: newState }
    });
  },
  
  toggleScreenShare: () => {
    set((state) => ({
      mediaSettings: {
        ...state.mediaSettings,
        screenSharing: !state.mediaSettings.screenSharing,
      },
    }));
  },
  
  setMediaDevice: (type, deviceId) => {
    set((state) => ({
      mediaSettings: {
        ...state.mediaSettings,
        [`selected${type.charAt(0).toUpperCase() + type.slice(1)}`]: deviceId,
      },
    }));
  },
  
  // Chat actions
  addChatMessage: (message) => {
    const { isChatOpen } = get();
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
      unreadCount: isChatOpen ? state.unreadCount : state.unreadCount + 1,
    }));
  },
  
  clearUnreadCount: () => set({ unreadCount: 0 }),
  
  toggleChat: () => {
    set((state) => {
      const newState = !state.isChatOpen;
      return {
        isChatOpen: newState,
        unreadCount: newState ? 0 : state.unreadCount,
      };
    });
  },
  
  setChatEnabled: (enabled) => set({ isChatEnabled: enabled }),
  
  // Interactive features actions
  toggleRaiseHand: () => {
    const { myPeerId, myUsername, raisedHands } = get();
    if (!myPeerId) return;
    
    const newRaisedHands = new Map(raisedHands);
    
    if (newRaisedHands.has(myPeerId)) {
      newRaisedHands.delete(myPeerId);
    } else {
      newRaisedHands.set(myPeerId, {
        peerId: myPeerId,
        username: myUsername,
        timestamp: new Date(),
      });
    }
    
    set({ raisedHands: newRaisedHands });
  },
  
  addRaisedHand: (peerId, username) => {
    const raisedHands = new Map(get().raisedHands);
    raisedHands.set(peerId, {
      peerId,
      username,
      timestamp: new Date(),
    });
    set({ raisedHands });
  },
  
  removeRaisedHand: (peerId) => {
    const raisedHands = new Map(get().raisedHands);
    raisedHands.delete(peerId);
    set({ raisedHands });
  },
  
  clearRaisedHands: () => set({ raisedHands: new Map() }),
  
  setActivePoll: (poll) => set({ activePoll: poll }),
  
  addQuestion: (question) => {
    set((state) => ({
      questions: [...state.questions, question],
    }));
  },
  
  updateQuestion: (id, updates) => {
    set((state) => ({
      questions: state.questions.map((q) =>
        q.id === id ? { ...q, ...updates } : q
      ),
    }));
  },
  
  // Admin actions
  setCanParticipantsShare: (can) => set({ canParticipantsShare: can }),
  setActiveSharingPeer: (peerId) => set({ activeSharingPeerId: peerId }),
  
  // Waiting Room actions
  addWaitingParticipant: (participant) => {
    const waitingParticipants = new Map(get().waitingParticipants);
    waitingParticipants.set(participant.peerId, participant);
    set({ waitingParticipants });
  },
  
  removeWaitingParticipant: (peerId) => {
    const waitingParticipants = new Map(get().waitingParticipants);
    waitingParticipants.delete(peerId);
    set({ waitingParticipants });
  },
  
  // Recording actions
  startRecording: (recordingId) => {
    set({
      recordingState: {
        isRecording: true,
        startTime: new Date(),
        duration: 0,
        recordingId,
      },
    });
  },
  
  stopRecording: () => {
    set({
      recordingState: {
        isRecording: false,
        startTime: null,
        duration: 0,
        recordingId: null,
      },
    });
  },
  
  updateRecordingDuration: (duration) => {
    set((state) => ({
      recordingState: {
        ...state.recordingState,
        duration,
      },
    }));
  },
  
  // Reset
  reset: () =>
    set({
      roomId: '',
      myPeerId: null,
      myUsername: '',
      isHost: false,
      hostId: null,
      isRoomLocked: false,
      participants: new Map(),
      raisedHands: new Map(),
      activePoll: null,
      questions: [],
      waitingParticipants: new Map(),
      recordingState: {
        isRecording: false,
        startTime: null,
        duration: 0,
        recordingId: null,
      },
      peerConnections: new Map(),
      localStream: null,
      mediaSettings: initialMediaSettings,
      chatMessages: [],
      unreadCount: 0,
      isChatOpen: false,
      isChatEnabled: true,
      canParticipantsShare: false,
      activeSharingPeerId: null,
    }),
}));
