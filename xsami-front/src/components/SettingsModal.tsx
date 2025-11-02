'use client';

import { useState, useEffect } from 'react';
import { X, Video, Mic, Volume2, Monitor } from 'lucide-react';
import Button from './ui/Button';
import { webRTCService } from '@/services/webrtc.service';
import { useRoomStore } from '@/store/room.store';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { localStream, setLocalStream } = useRoomStore();
  
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(false);

  // Load available devices
  useEffect(() => {
    if (isOpen) {
      loadDevices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadDevices = async () => {
    try {
      const devices = await webRTCService.getMediaDevices();
      
      const audioIns = devices.filter(d => d.kind === 'audioinput');
      const videoIns = devices.filter(d => d.kind === 'videoinput');
      const audioOuts = devices.filter(d => d.kind === 'audiooutput');
      
      setAudioInputs(audioIns);
      setVideoInputs(videoIns);
      setAudioOutputs(audioOuts);
      
      // Set current devices
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        const videoTrack = localStream.getVideoTracks()[0];
        
        if (audioTrack) {
          const settings = audioTrack.getSettings();
          setSelectedAudioInput(settings.deviceId || '');
        }
        
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          setSelectedVideoInput(settings.deviceId || '');
        }
      }
      
      // Get current audio output (if supported)
      const audioElement = document.querySelector('audio');
      if (audioElement && 'sinkId' in audioElement) {
        setSelectedAudioOutput((audioElement as any).sinkId || '');
      }
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  const handleAudioInputChange = async (deviceId: string) => {
    if (!localStream) return;
    
    setIsLoading(true);
    try {
      // Stop old audio tracks
      localStream.getAudioTracks().forEach(track => track.stop());
      
      // Get new stream with selected device
      const newStream = await webRTCService.changeAudioInput(deviceId);
      
      // Replace audio tracks in local stream
      const newAudioTrack = newStream.getAudioTracks()[0];
      if (newAudioTrack) {
        // Keep video tracks, replace audio
        const videoTracks = localStream.getVideoTracks();
        const combinedStream = new MediaStream([...videoTracks, newAudioTrack]);
        setLocalStream(combinedStream);
      }
      
      setSelectedAudioInput(deviceId);
    } catch (error) {
      console.error('Error changing audio input:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVideoInputChange = async (deviceId: string) => {
    if (!localStream) return;
    
    setIsLoading(true);
    try {
      // Stop old video tracks
      localStream.getVideoTracks().forEach(track => track.stop());
      
      // Get new stream with selected device
      const newStream = await webRTCService.changeVideoInput(deviceId);
      
      // Replace video tracks in local stream
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack) {
        // Keep audio tracks, replace video
        const audioTracks = localStream.getAudioTracks();
        const combinedStream = new MediaStream([...audioTracks, newVideoTrack]);
        setLocalStream(combinedStream);
      }
      
      setSelectedVideoInput(deviceId);
    } catch (error) {
      console.error('Error changing video input:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudioOutputChange = async (deviceId: string) => {
    try {
      // Change audio output for all audio elements
      const audioElements = document.querySelectorAll('audio');
      const videoElements = document.querySelectorAll('video');
      
      const promises: Promise<void>[] = [];
      
      audioElements.forEach((audio) => {
        if ('setSinkId' in audio) {
          promises.push((audio as any).setSinkId(deviceId));
        }
      });
      
      videoElements.forEach((video) => {
        if ('setSinkId' in video) {
          promises.push((video as any).setSinkId(deviceId));
        }
      });
      
      await Promise.all(promises);
      setSelectedAudioOutput(deviceId);
    } catch (error) {
      console.error('Error changing audio output:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close settings"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Camera Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <Video size={18} />
              Camera
            </label>
            <select
              value={selectedVideoInput}
              onChange={(e) => handleVideoInputChange(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50
                       disabled:cursor-not-allowed"
            >
              {videoInputs.length === 0 ? (
                <option>No cameras found</option>
              ) : (
                videoInputs.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.substring(0, 5)}`}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Microphone Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <Mic size={18} />
              Microphone
            </label>
            <select
              value={selectedAudioInput}
              onChange={(e) => handleAudioInputChange(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50
                       disabled:cursor-not-allowed"
            >
              {audioInputs.length === 0 ? (
                <option>No microphones found</option>
              ) : (
                audioInputs.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.substring(0, 5)}`}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Speaker Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <Volume2 size={18} />
              Speaker
            </label>
            <select
              value={selectedAudioOutput}
              onChange={(e) => handleAudioOutputChange(e.target.value)}
              disabled={audioOutputs.length === 0}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50
                       disabled:cursor-not-allowed"
            >
              {audioOutputs.length === 0 ? (
                <option>Speaker selection not supported</option>
              ) : (
                audioOutputs.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Speaker ${device.deviceId.substring(0, 5)}`}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Info Section */}
          <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Monitor size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-300">
                <p className="font-medium mb-1">Device Settings</p>
                <p className="text-gray-400 text-xs">
                  Changes to camera and microphone will be applied immediately. 
                  Make sure to grant permissions when prompted.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
          <Button
            onClick={onClose}
            variant="secondary"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
