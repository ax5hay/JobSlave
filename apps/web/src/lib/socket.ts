import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      socket?.emit('join:automation');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
  }

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.emit('leave:automation');
    socket.disconnect();
    socket = null;
  }
}
