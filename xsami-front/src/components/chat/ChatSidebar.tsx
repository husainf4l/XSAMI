'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '@/types';
import { formatTime } from '@/lib/utils';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface ChatSidebarProps {
  messages: ChatMessageType[];
  onSendMessage: (message: string) => void;
  onClose: () => void;
  isChatEnabled: boolean;
  currentUsername: string;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  messages,
  onSendMessage,
  onClose,
  isChatEnabled,
  currentUsername,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (inputValue.trim() && isChatEnabled) {
      onSendMessage(inputValue);
      setInputValue('');
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-80 glass-dark border-l border-border flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-lg font-semibold text-text-primary">Chat</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-background-hover rounded-lg transition-colors"
          aria-label="Close chat"
        >
          <X className="w-5 h-5 text-text-secondary" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-text-muted py-8">
            <p>No messages yet</p>
            <p className="text-sm mt-2">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'rounded-lg p-3 break-words',
                message.type === 'system'
                  ? 'bg-info/10 text-info text-center text-sm italic'
                  : message.username === currentUsername
                  ? 'bg-primary/20 ml-8'
                  : 'bg-background-card mr-8'
              )}
            >
              {message.type !== 'system' && (
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-semibold text-sm text-text-primary">
                    {message.username}
                  </span>
                  <span className="text-xs text-text-muted">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              )}
              <p className="text-sm text-text-primary whitespace-pre-wrap">
                {message.message}
              </p>
              {message.fileData && (
                <div className="mt-2 p-2 bg-background-hover rounded border border-border">
                  <a
                    href={message.fileData.url}
                    download={message.fileData.name}
                    className="text-primary hover:underline text-sm"
                  >
                    📎 {message.fileData.name}
                  </a>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        {!isChatEnabled ? (
          <div className="text-center text-text-muted text-sm py-2">
            Chat has been disabled by the host
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              disabled={!isChatEnabled}
              className="flex-1 px-4 py-2 bg-background-card border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || !isChatEnabled}
              variant="primary"
              size="md"
              className="shrink-0"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
