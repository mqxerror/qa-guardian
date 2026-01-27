import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  joinRun: (runId: string) => void;
  leaveRun: (runId: string) => void;
  joinOrg: (orgId: string) => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,

  connect: () => {
    const { socket } = get();
    if (socket?.connected) return;

    const newSocket = io('https://qa.pixelcraftedmedia.com', {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('[Socket.IO] Connected:', newSocket.id);
      set({ isConnected: true });
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket.IO] Disconnected');
      set({ isConnected: false });
    });

    newSocket.on('connect_error', (error) => {
      console.error('[Socket.IO] Connection error:', error);
    });

    set({ socket: newSocket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  joinRun: (runId: string) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('join-run', runId);
      console.log('[Socket.IO] Joining run:', runId);
    }
  },

  leaveRun: (runId: string) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('leave-run', runId);
      console.log('[Socket.IO] Leaving run:', runId);
    }
  },

  joinOrg: (orgId: string) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('join-org', orgId);
      console.log('[Socket.IO] Joining org:', orgId);
    }
  },
}));
