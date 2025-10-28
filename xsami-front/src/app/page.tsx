'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, Users, Monitor, MessageCircle, Shield, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { generateId } from '@/lib/utils';

export default function HomePage() {
  const router = useRouter();
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [roomCode, setRoomCode] = useState('');

  const handleCreateRoom = () => {
    const newRoomId = generateId();
    router.push(`/room/${newRoomId}`);
  };

  const handleJoinRoom = () => {
    if (roomCode.trim()) {
      router.push(`/room/${roomCode.trim()}`);
    }
  };

  const features = [
    {
      icon: <Users className="w-12 h-12" />,
      title: 'Multi-User Support',
      description: 'Connect with multiple participants in high-quality video conferences',
    },
    {
      icon: <Monitor className="w-12 h-12" />,
      title: 'Screen Sharing',
      description: 'Share your screen, presentations, and applications effortlessly',
    },
    {
      icon: <MessageCircle className="w-12 h-12" />,
      title: 'Real-time Chat',
      description: 'Stay connected with integrated text chat alongside video',
    },
    {
      icon: <Shield className="w-12 h-12" />,
      title: 'Secure & Private',
      description: 'End-to-end encrypted connections for your privacy and security',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass-dark sticky top-0 z-50 border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Video className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-bold text-text-primary">XSAMI</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-20">
          <h1 className="text-5xl md:text-6xl font-bold text-text-primary mb-6">
            Welcome to <span className="text-primary">XSAMI</span>
          </h1>
          <p className="text-xl text-text-secondary mb-4">
            Professional Video Conferencing Platform
          </p>
          <p className="text-lg text-text-muted mb-10">
            Connect with anyone, anywhere. High-quality video calls with screen sharing,
            real-time chat, and crystal-clear audio.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={handleCreateRoom}
              size="lg"
              className="gap-2"
            >
              <Video className="w-5 h-5" />
              Start Meeting
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => setIsJoinModalOpen(true)}
              variant="secondary"
              size="lg"
              className="gap-2"
            >
              <Users className="w-5 h-5" />
              Join Room
            </Button>
          </div>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="glass p-8 rounded-2xl hover:bg-background-hover transition-all duration-300 hover:scale-105"
            >
              <div className="text-primary mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-text-primary mb-3">
                {feature.title}
              </h3>
              <p className="text-text-secondary">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-6 text-center text-text-muted">
          <p>© 2025 XSAMI. Built with Next.js and WebRTC.</p>
        </div>
      </footer>

      {/* Join Room Modal */}
      <Modal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        title="Join a Room"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            Enter the room code to join an existing meeting
          </p>
          <Input
            label="Room Code"
            placeholder="Enter room code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
          />
          <Button
            onClick={handleJoinRoom}
            className="w-full"
            disabled={!roomCode.trim()}
          >
            Join Room
          </Button>
        </div>
      </Modal>
    </div>
  );
}
