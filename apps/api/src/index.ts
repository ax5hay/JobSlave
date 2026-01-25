import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

import { initializeDatabase } from './db';
import { profileRoutes } from './routes/profile';
import { jobsRoutes } from './routes/jobs';
import { llmRoutes } from './routes/llm';
import { automationRoutes } from './routes/automation';
import { settingsRoutes } from './routes/settings';
import { initializeSocketHandlers } from './socket';

const PORT = process.env.PORT || 3001;

async function main() {
  // Initialize database
  await initializeDatabase();

  const app = express();
  const httpServer = createServer(app);

  // Socket.io for real-time updates
  const io = new SocketServer(httpServer, {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      methods: ['GET', 'POST'],
    },
  });

  // Middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());

  // Make io accessible to routes
  app.set('io', io);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api/profile', profileRoutes);
  app.use('/api/jobs', jobsRoutes);
  app.use('/api/llm', llmRoutes);
  app.use('/api/automation', automationRoutes);
  app.use('/api/settings', settingsRoutes);

  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  });

  // Initialize socket handlers
  initializeSocketHandlers(io);

  httpServer.listen(PORT, () => {
    console.log(`JobSlave API running on http://localhost:${PORT}`);
  });
}

main().catch(console.error);
