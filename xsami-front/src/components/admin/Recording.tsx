'use client';

import { useEffect, useState } from 'react';
import { Video, Square, Clock, AlertCircle, CircleDot } from 'lucide-react';
import { useRoomStore } from '@/store/room.store';
import { webSocketService } from '@/services/websocket.service';
import Button from '@/components/ui/Button';

export function Recording() {
  const {
    recordingState,
    startRecording,
    stopRecording,
    updateRecordingDuration,
  } = useRoomStore();

  const [localDuration, setLocalDuration] = useState(0);

  // Timer effect for recording duration
  useEffect(() => {
    if (!recordingState.isRecording) {
      setLocalDuration(0);
      return;
    }

    const interval = setInterval(() => {
      if (recordingState.startTime) {
        const elapsed = Math.floor((Date.now() - recordingState.startTime.getTime()) / 1000);
        setLocalDuration(elapsed);
        updateRecordingDuration(elapsed);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [recordingState.isRecording, recordingState.startTime, updateRecordingDuration]);

  const handleStartRecording = () => {
    const recordingId = `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Send start recording message to backend
    webSocketService.send({
      event: 'recording-started',
      data: { recordingId },
    });

    // Update local state
    startRecording(recordingId);

    console.log('Started recording:', recordingId);
  };

  const handleStopRecording = () => {
    if (!recordingState.recordingId) return;

    // Send stop recording message to backend
    webSocketService.send({
      event: 'recording-stopped',
      data: { recordingId: recordingState.recordingId },
    });

    // Update local state
    stopRecording();

    console.log('Stopped recording:', recordingState.recordingId);
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Recording Status Card */}
      <div
        className={`p-6 rounded-lg border-2 transition-all ${
          recordingState.isRecording
            ? 'bg-red-500/10 border-red-500/50'
            : 'bg-background-secondary border-border'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {recordingState.isRecording ? (
              <div className="relative">
                <CircleDot className="w-8 h-8 text-red-500 animate-pulse" />
              </div>
            ) : (
              <Video className="w-8 h-8 text-text-secondary" />
            )}
            <div>
              <h3 className="text-lg font-semibold text-text-primary">
                {recordingState.isRecording ? 'Recording in Progress' : 'Recording'}
              </h3>
              <p className="text-sm text-text-secondary">
                {recordingState.isRecording
                  ? 'Session is being recorded'
                  : 'Record your meeting session'}
              </p>
            </div>
          </div>

          {recordingState.isRecording && (
            <div className="flex items-center gap-3 bg-background-card px-4 py-2 rounded-lg">
              <Clock className="w-5 h-5 text-red-500" />
              <span className="text-2xl font-mono font-bold text-text-primary tabular-nums">
                {formatDuration(localDuration)}
              </span>
            </div>
          )}
        </div>

        {/* Recording Info */}
        {recordingState.isRecording && recordingState.recordingId && (
          <div className="mb-4 p-3 bg-background-card rounded border border-border">
            <p className="text-xs text-text-secondary mb-1">Recording ID:</p>
            <p className="text-sm font-mono text-text-primary break-all">
              {recordingState.recordingId}
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3">
          {!recordingState.isRecording ? (
            <Button
              onClick={handleStartRecording}
              variant="primary"
              className="gap-2 flex-1"
            >
              <Video className="w-5 h-5" />
              Start Recording
            </Button>
          ) : (
            <Button
              onClick={handleStopRecording}
              variant="danger"
              className="gap-2 flex-1"
            >
              <Square className="w-5 h-5" />
              Stop Recording
            </Button>
          )}
        </div>
      </div>

      {/* Information Sections */}
      <div className="space-y-4">
        {/* Recording Notice */}
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-text-primary mb-1">
                Recording Notice
              </p>
              <p className="text-xs text-text-secondary">
                All participants will be notified that this session is being recorded.
                Make sure you have consent from all participants before starting.
              </p>
            </div>
          </div>
        </div>

        {/* Recording Features */}
        <div className="p-4 bg-background-secondary border border-border rounded-lg">
          <h4 className="text-sm font-semibold text-text-primary mb-3">
            What gets recorded:
          </h4>
          <ul className="space-y-2 text-sm text-text-secondary">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Audio from all participants</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Video feeds from cameras</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Screen sharing content</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Chat messages and reactions</span>
            </li>
          </ul>
        </div>

        {/* Recording Tips */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <h4 className="text-sm font-semibold text-text-primary mb-3">
            Recording Tips:
          </h4>
          <ul className="space-y-2 text-xs text-text-secondary">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">→</span>
              <span>Ensure stable internet connection for best quality</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">→</span>
              <span>Recording will continue even if you leave the room</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">→</span>
              <span>Recordings are saved to the server and can be downloaded later</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">→</span>
              <span>Stop recording manually or it will stop when the room closes</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
