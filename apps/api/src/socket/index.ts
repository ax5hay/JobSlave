import type { Server as SocketServer, Socket } from 'socket.io';

export function initializeSocketHandlers(io: SocketServer) {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    // Join automation room for real-time updates
    socket.on('join:automation', () => {
      socket.join('automation');
      console.log('Client joined automation room:', socket.id);
    });

    // Leave automation room
    socket.on('leave:automation', () => {
      socket.leave('automation');
      console.log('Client left automation room:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Helper to emit to automation room
  io.emitAutomation = (event: string, data: any) => {
    io.to('automation').emit(event, data);
  };

  return io;
}

declare module 'socket.io' {
  interface Server {
    emitAutomation: (event: string, data: any) => void;
  }
}
