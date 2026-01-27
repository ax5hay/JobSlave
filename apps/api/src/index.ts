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
import { logger, startTimer, logError } from './utils/logger';

const PORT = process.env.PORT || 3001;

async function main() {
  logger.app.info('═══════════════════════════════════════════════════════════');
  logger.app.info('🚀 JobSlave API Server Starting...');
  logger.app.info('═══════════════════════════════════════════════════════════');
  logger.app.info({ nodeVersion: process.version, platform: process.platform }, '📊 Environment');

  // Initialize database
  const dbTimer = startTimer('Database initialization');
  try {
    await initializeDatabase();
    dbTimer.end();
    logger.db.info('✅ Database initialized successfully');
  } catch (error) {
    logError(logger.db, error, { phase: 'initialization' });
    process.exit(1);
  }

  const app = express();
  const httpServer = createServer(app);

  // Socket.io for real-time updates
  logger.socket.debug('Configuring Socket.io server...');
  const io = new SocketServer(httpServer, {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'],
      methods: ['GET', 'POST'],
    },
  });
  logger.socket.info('✅ Socket.io configured');

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.headers['x-request-id'] = requestId;

    logger.api.debug(
      {
        requestId,
        method: req.method,
        url: req.url,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        userAgent: req.get('user-agent')?.substring(0, 50),
      },
      `➡️  ${req.method} ${req.url}`
    );

    res.on('finish', () => {
      const duration = Date.now() - start;
      const logLevel = res.statusCode >= 400 ? 'warn' : 'debug';
      logger.api[logLevel](
        {
          requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
        },
        `⬅️  ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`
      );
    });

    next();
  });

  // Middleware
  logger.app.debug('Configuring middleware...');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());
  logger.app.debug('✅ Middleware configured: helmet, cors, json parser');

  // Make io accessible to routes
  app.set('io', io);

  // Health check
  app.get('/health', (req, res) => {
    logger.app.trace('Health check requested');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  app.get('/api/health', (req, res) => {
    logger.app.trace('API Health check requested');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  logger.app.debug('Mounting API routes...');
  app.use('/api/profile', profileRoutes);
  logger.app.debug('  ├─ /api/profile');
  app.use('/api/jobs', jobsRoutes);
  logger.app.debug('  ├─ /api/jobs');
  app.use('/api/llm', llmRoutes);
  logger.app.debug('  ├─ /api/llm');
  app.use('/api/automation', automationRoutes);
  logger.app.debug('  ├─ /api/automation');
  app.use('/api/settings', settingsRoutes);
  logger.app.debug('  └─ /api/settings');
  logger.app.info('✅ All API routes mounted');

  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const requestId = req.headers['x-request-id'];
    logError(logger.api, err, { requestId, method: req.method, url: req.url });
    res.status(500).json({ error: err.message });
  });

  // Initialize socket handlers
  initializeSocketHandlers(io);
  logger.socket.info('✅ Socket handlers initialized');

  httpServer.listen(PORT, () => {
    logger.app.info('═══════════════════════════════════════════════════════════');
    logger.app.info(`🌐 JobSlave API running on http://localhost:${PORT}`);
    logger.app.info('═══════════════════════════════════════════════════════════');
    logger.app.info('📋 Available endpoints:');
    logger.app.info('   GET  /health              - Health check');
    logger.app.info('   GET  /api/profile         - Get user profile');
    logger.app.info('   POST /api/profile         - Save user profile');
    logger.app.info('   POST /api/profile/parse-resume - Parse resume with AI');
    logger.app.info('   GET  /api/jobs            - List jobs');
    logger.app.info('   GET  /api/jobs/stats      - Get job statistics');
    logger.app.info('   GET  /api/llm/test        - Test LLM connection');
    logger.app.info('   POST /api/automation/init - Initialize browser');
    logger.app.info('   GET  /api/settings        - Get settings');
    logger.app.info('═══════════════════════════════════════════════════════════');
  });
}

main().catch((error) => {
  logError(logger.app, error, { phase: 'startup' });
  process.exit(1);
});
