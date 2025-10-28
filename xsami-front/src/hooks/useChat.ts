'use client';

import { useEffect, useCallback } from 'react';
import { useRoomStore } from '@/store/room.store';
import { webSocketService } from '@/services/websocket.service';
import { ChatMessage } from '@/types';
import { getWebSocketUrl } from '@/lib/utils';

export const useChat = (roomId: string) => {
  const {
    myUsername,
    chatMessages,
    isChatEnabled,
    addChatMessage,
  } = useRoomStore();

  /**
   * Send a chat message
   */
  const sendMessage = useCallback(
    (message: string) => {
      if (!message.trim() || !isChatEnabled) return;

      const chatMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        username: myUsername,
        message: message.trim(),
        timestamp: new Date(),
        type: 'text',
      };

      // Send via WebSocket
      webSocketService.send({
        event: 'chat-message',
        data: chatMessage,
      });

      // Add to local store
      addChatMessage(chatMessage);
    },
    [myUsername, isChatEnabled, addChatMessage]
  );

  /**
   * Handle incoming chat messages
   */
  const handleChatMessage = useCallback(
    (data: any) => {
      const message: ChatMessage = {
        id: data.id || `msg_${Date.now()}`,
        username: data.username,
        message: data.message,
        timestamp: new Date(data.timestamp),
        type: data.type || 'text',
        fileData: data.fileData,
      };

      addChatMessage(message);
    },
    [addChatMessage]
  );

  /**
   * Handle system messages
   */
  const addSystemMessage = useCallback(
    (message: string) => {
      const systemMessage: ChatMessage = {
        id: `sys_${Date.now()}`,
        username: 'System',
        message,
        timestamp: new Date(),
        type: 'system',
      };

      addChatMessage(systemMessage);
    },
    [addChatMessage]
  );

  /**
   * Setup chat WebSocket connection
   */
  useEffect(() => {
    if (!roomId) return;

    // Subscribe to chat messages
    const unsubscribe = webSocketService.onMessage((message) => {
      if (message.event === 'chat-message') {
        handleChatMessage(message.data);
      } else if (message.event === 'chat-enabled') {
        addSystemMessage('Chat has been enabled by the host');
      } else if (message.event === 'chat-disabled') {
        addSystemMessage('Chat has been disabled by the host');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [roomId, handleChatMessage, addSystemMessage]);

  return {
    sendMessage,
    messages: chatMessages,
    isChatEnabled,
  };
};
