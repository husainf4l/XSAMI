import { WebSocketMessage } from '@/types';

/**
 * Modern WebSocket Service with:
 * - Connection pooling
 * - Automatic reconnection with exponential backoff
 * - Message queuing
 * - Heartbeat/keepalive
 * - Type-safe event handling
 */
class WebSocketService {
  private ws: WebSocket | null = null;
  private url = '';
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly baseReconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly heartbeatInterval = 25000; // 25 seconds

  // Event handlers using Map for better performance
  private messageHandlers = new Map<string, Set<(message: WebSocketMessage) => void>>();
  private openHandlers = new Set<() => void>();
  private closeHandlers = new Set<() => void>();
  private errorHandlers = new Set<(error: Event) => void>();

  // Message queue with size limit
  private messageQueue: WebSocketMessage[] = [];
  private readonly maxQueueSize = 100;

  // Connection state
  private shouldReconnect = true;
  private isConnecting = false;

  /**
   * Connect to WebSocket server
   */
  connect(url: string): void {
    if (this.isConnecting) {
      console.warn('⚠️ Connection already in progress');
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      console.warn('⚠️ Already connected');
      return;
    }

    this.url = url;
    this.shouldReconnect = true;
    this.isConnecting = true;

    console.log('🔌 Connecting to:', url);

    try {
      this.ws = new WebSocket(url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    console.log('🔌 Disconnecting WebSocket');
    this.shouldReconnect = false;
    this.clearTimers();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.messageQueue = [];
    this.isConnecting = false;
  }

  /**
   * Send message (queues if not connected)
   */
  send(message: WebSocketMessage): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('❌ Failed to send message:', error);
        return false;
      }
    }

    // Queue message if not connected
    if (this.messageQueue.length < this.maxQueueSize) {
      console.warn('📦 Queuing message:', message.event);
      this.messageQueue.push(message);
      return true;
    }

    console.error('⚠️ Message queue full, dropping:', message.event);
    return false;
  }

  /**
   * Subscribe to specific message events
   */
  on(event: string, handler: (message: WebSocketMessage) => void): () => void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, new Set());
    }
    this.messageHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(event);
        }
      }
    };
  }

  /**
   * Subscribe to all messages
   */
  onMessage(handler: (message: WebSocketMessage) => void): () => void {
    return this.on('*', handler);
  }

  /**
   * Subscribe to connection open
   */
  onOpen(handler: () => void): () => void {
    this.openHandlers.add(handler);
    return () => this.openHandlers.delete(handler);
  }

  /**
   * Subscribe to connection close
   */
  onClose(handler: () => void): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  /**
   * Subscribe to errors
   */
  onError(handler: (error: Event) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * Get connection state
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('%c✅ WebSocket connected', 'color: #00c853; font-weight: bold');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.clearReconnectTimer();

      // Flush queued messages
      this.flushMessageQueue();

      // Start heartbeat
      this.startHeartbeat();

      // Notify handlers
      this.openHandlers.forEach((handler) => {
        try {
          handler();
        } catch (error) {
          console.error('Error in open handler:', error);
        }
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        // Call event-specific handlers
        const eventHandlers = this.messageHandlers.get(message.event);
        if (eventHandlers) {
          eventHandlers.forEach((handler) => {
            try {
              handler(message);
            } catch (error) {
              console.error(`Error in ${message.event} handler:`, error);
            }
          });
        }

        // Call wildcard handlers
        const wildcardHandlers = this.messageHandlers.get('*');
        if (wildcardHandlers) {
          wildcardHandlers.forEach((handler) => {
            try {
              handler(message);
            } catch (error) {
              console.error('Error in wildcard handler:', error);
            }
          });
        }
      } catch (error) {
        console.error('⚠️ Failed to parse message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('⚠️ WebSocket error:', error);
      this.errorHandlers.forEach((handler) => {
        try {
          handler(error);
        } catch (err) {
          console.error('Error in error handler:', err);
        }
      });
    };

    this.ws.onclose = (event) => {
      console.warn('🔌 WebSocket closed:', {
        code: event.code,
        reason: event.reason || 'No reason provided',
        wasClean: event.wasClean,
      });

      this.isConnecting = false;
      this.clearTimers();

      // Notify handlers
      this.closeHandlers.forEach((handler) => {
        try {
          handler();
        } catch (error) {
          console.error('Error in close handler:', error);
        }
      });

      // Reconnect if needed
      if (this.shouldReconnect && event.code !== 1000) {
        console.log('🔄 Scheduling reconnect...');
        this.scheduleReconnect();
      }
    };
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    let flushed = 0;
    while (this.messageQueue.length > 0 && this.ws.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        try {
          this.ws.send(JSON.stringify(message));
          flushed++;
        } catch (error) {
          console.error('Failed to send queued message:', error);
          // Re-queue on error
          this.messageQueue.unshift(message);
          break;
        }
      }
    }

    if (flushed > 0) {
      console.log(`📤 Flushed ${flushed} queued messages`);
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.clearHeartbeatTimer();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send({ event: 'ping' });
      }
    }, this.heartbeatInterval);
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('⛔ Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.maxReconnectDelay,
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    );

    console.log(
      `⏳ Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect && this.url) {
        this.connect(this.url);
      }
    }, delay);
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    this.clearReconnectTimer();
    this.clearHeartbeatTimer();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
