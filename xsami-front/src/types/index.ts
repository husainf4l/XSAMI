// WebRTC Types
export interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  username: string;
  stream?: MediaStream; // Legacy: merged stream for backward compatibility
  cameraStream?: MediaStream; // Separate camera stream
  screenStream?: MediaStream; // Separate screen stream
}

export interface RTCConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize?: number;
}

// WebSocket Message Types
export type WebSocketEvent =
  | 'join'
  | 'ping'
  | 'peers'
  | 'peer-joined'
  | 'peer-left'
  | 'offer'
  | 'answer'
  | 'candidate'
  | 'host-status'
  | 'screen-share-started'
  | 'screen-share-stopped'
  | 'room-locked'
  | 'room-unlocked'
  | 'kicked'
  | 'chat-message'
  | 'chat-enabled'
  | 'chat-disabled'
  | 'reaction'
  | 'raise-hand'
  | 'lower-hand'
  | 'add-cohost'
  | 'remove-cohost'
  | 'cohost-promoted'
  | 'cohost-added'
  | 'cohost-demoted'
  | 'cohost-removed'
  | 'annotation-draw'
  | 'annotation-clear'
  | 'poll-created'
  | 'poll-vote'
  | 'question-asked'
  | 'question-upvoted'
  | 'waiting-participant-joined'
  | 'admit-participant'
  | 'deny-participant'
  | 'recording-started'
  | 'recording-stopped';

export interface WebSocketMessage {
  event: WebSocketEvent;
  data?: any;
}

export interface PeersMessage {
  yourId: string;
  peers: Array<{ peerId: string; username: string }> | string[]; // Support both formats for backwards compatibility
  isHost: boolean;
  hostId: string;
  roomLocked?: boolean;
}

export interface PeerJoinedMessage {
  peerId: string;
  username: string;
}

export interface PeerLeftMessage {
  peerId: string;
}

export interface OfferMessage {
  peerId: string;
  username: string;
  targetPeerId: string;
  sdp: string;
}

export interface AnswerMessage {
  peerId: string;
  targetPeerId: string;
  sdp: string;
}

export interface CandidateMessage {
  peerId: string;
  targetPeerId: string;
  candidate: string;
}

// Chat Types
export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'system' | 'file';
  fileData?: FileData;
}

export interface FileData {
  name: string;
  size: number;
  type: string;
  url: string;
}

// Interactive Features Types
export type ReactionType = '👍' | '❤️' | '😂' | '🎉' | '👏' | '🤔';

export interface Reaction {
  emoji: ReactionType;
  timestamp: number;
}

export interface RaisedHand {
  peerId: string;
  username: string;
  timestamp: Date;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  timestamp: Date;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Question {
  id: string;
  text: string;
  author: string;
  timestamp: Date;
  upvotes: number;
  answered: boolean;
}

// Waiting Room Types
export interface WaitingParticipant {
  peerId: string;
  username: string;
  timestamp: Date;
}

// Recording Types
export interface RecordingState {
  isRecording: boolean;
  startTime: Date | null;
  duration: number; // in seconds
  recordingId: string | null;
}

// Room Types
export interface RoomState {
  roomId: string;
  myPeerId: string | null;
  myUsername: string;
  isHost: boolean;
  hostId: string | null;
  isRoomLocked: boolean;
  participants: Map<string, string>; // peerId -> username
  raisedHands: Map<string, RaisedHand>;
  activePoll: Poll | null;
  questions: Question[];
  waitingParticipants: Map<string, WaitingParticipant>;
  recordingState: RecordingState;
}

// Media Types
export interface MediaDevices {
  audioInput: MediaDeviceInfo[];
  audioOutput: MediaDeviceInfo[];
  videoInput: MediaDeviceInfo[];
}

export interface MediaSettings {
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  selectedAudioInput: string;
  selectedAudioOutput: string;
  selectedVideoInput: string;
}

// Annotation Types
export type AnnotationTool = 'pen' | 'eraser' | 'line' | 'rectangle' | 'circle' | 'text';

export interface AnnotationSettings {
  tool: AnnotationTool;
  color: string;
  size: number;
}

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface AnnotationData {
  type: AnnotationTool;
  points: AnnotationPoint[];
  color: string;
  size: number;
  timestamp: number;
}

// Stream Types
export interface StreamInfo {
  streamId: string;
  viewers: number;
}
