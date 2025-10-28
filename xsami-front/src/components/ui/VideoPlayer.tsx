'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';
import RaisedHandIndicator from './RaisedHandIndicator';
import FloatingReaction from './FloatingReaction';
import { ReactionType } from '@/types';

interface VideoPlayerProps {
  stream: MediaStream | null;
  username: string;
  peerId?: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoEnabled?: boolean;
  isHandRaised?: boolean;
  reactions?: ReactionType[];
  className?: string;
  onVideoClick?: () => void;
}

interface ActiveReaction {
  id: string;
  emoji: ReactionType;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  stream,
  username,
  peerId,
  isLocal = false,
  isMuted = false,
  isVideoEnabled = true,
  isHandRaised = false,
  reactions: externalReactions = [],
  className,
  onVideoClick,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reactions, setReactions] = useState<ActiveReaction[]>([]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      
      // Log audio tracks
      const audioTracks = stream.getAudioTracks();
      console.log(`${isLocal ? 'Local' : 'Remote'} stream for ${username}:`, {
        audioTracks: audioTracks.length,
        audioEnabled: audioTracks[0]?.enabled,
        videoTracks: stream.getVideoTracks().length,
      });
      
      // For remote peers, ensure audio plays
      if (!isLocal && videoRef.current) {
        videoRef.current.muted = false;
        videoRef.current.volume = 1.0;
        
        // Try to play (handle autoplay policy)
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.log('Autoplay prevented, user interaction required:', error);
            // Video will play once user interacts with the page
          });
        }
      }
    }
  }, [stream, isLocal, username]);

  // Handle external reactions prop
  useEffect(() => {
    externalReactions.forEach((emoji) => {
      const id = `${Date.now()}-${Math.random()}`;
      setReactions((prev) => [...prev, { id, emoji }]);
    });
  }, [externalReactions]);

  const removeReaction = (id: string) => {
    setReactions((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div
      className={cn(
        'relative group overflow-hidden rounded-xl bg-background-darker',
        'aspect-video',
        onVideoClick && 'cursor-pointer',
        className
      )}
      onClick={onVideoClick}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={cn(
          'w-full h-full object-cover',
          (!isVideoEnabled || !stream) && 'hidden'
        )}
      />

      {/* Avatar placeholder when video is off OR no stream */}
      {(!isVideoEnabled || !stream) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background-card">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-semibold">
            {(username || 'U').charAt(0).toUpperCase()}
          </div>
          {!stream && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-text-secondary bg-black/50 px-2 py-1 rounded">
              Connecting...
            </div>
          )}
        </div>
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Raised Hand Indicator */}
      <RaisedHandIndicator isVisible={isHandRaised} />

      {/* Floating Reactions */}
      {reactions.map((reaction) => (
        <FloatingReaction
          key={reaction.id}
          emoji={reaction.emoji}
          onComplete={() => removeReaction(reaction.id)}
        />
      ))}

      {/* Username label */}
      <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-lg">
        <span className="text-sm font-medium text-white">{username}</span>
      </div>

      {/* Status icons */}
      <div className="absolute bottom-3 right-3 flex gap-2">
        {!isMuted ? (
          <div className="p-1.5 bg-black/60 backdrop-blur-sm rounded-lg">
            <Mic className="w-4 h-4 text-white" />
          </div>
        ) : (
          <div className="p-1.5 bg-danger/80 backdrop-blur-sm rounded-lg">
            <MicOff className="w-4 h-4 text-white" />
          </div>
        )}

        {!isVideoEnabled && (
          <div className="p-1.5 bg-danger/80 backdrop-blur-sm rounded-lg">
            <VideoOff className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;
