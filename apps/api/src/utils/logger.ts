import pino from 'pino';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log levels: trace(10) < debug(20) < info(30) < warn(40) < error(50) < fatal(60)
const LOG_LEVEL = process.env.LOG_LEVEL || 'debug';

// Create base logger with pino-pretty for development
const isDev = process.env.NODE_ENV !== 'production';

const baseLogger = pino({
  level: LOG_LEVEL,
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
          ignore: 'pid,hostname',
          messageFormat: '{msg}',
          singleLine: false,
        },
      }
    : undefined,
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

// Create child loggers for different modules
export const logger = {
  // Main application logger
  app: baseLogger.child({ module: 'APP' }),

  // API routes
  api: baseLogger.child({ module: 'API' }),

  // Database operations
  db: baseLogger.child({ module: 'DB' }),

  // Authentication & sessions
  auth: baseLogger.child({ module: 'AUTH' }),

  // Profile operations
  profile: baseLogger.child({ module: 'PROFILE' }),

  // Jobs operations
  jobs: baseLogger.child({ module: 'JOBS' }),

  // LLM operations
  llm: baseLogger.child({ module: 'LLM' }),

  // OCR operations
  ocr: baseLogger.child({ module: 'OCR' }),

  // Automation/Scraper operations
  automation: baseLogger.child({ module: 'AUTOMATION' }),

  // Scraper-specific
  scraper: baseLogger.child({ module: 'SCRAPER' }),

  // Socket.io
  socket: baseLogger.child({ module: 'SOCKET' }),

  // Settings
  settings: baseLogger.child({ module: 'SETTINGS' }),

  // Performance metrics
  perf: baseLogger.child({ module: 'PERF' }),
};

// Utility function to log with request context
export function createRequestLogger(req: any) {
  const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
  return baseLogger.child({
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection?.remoteAddress,
  });
}

// Performance timer utility
export function startTimer(label: string) {
  const start = performance.now();
  return {
    end: () => {
      const duration = performance.now() - start;
      logger.perf.debug({ label, duration: `${duration.toFixed(2)}ms` }, `⏱️  ${label}`);
      return duration;
    },
  };
}

// Log levels helper
export const LogLevel = {
  TRACE: 'trace',
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal',
} as const;

// Structured error logging
export function logError(logger: pino.Logger, error: unknown, context?: Record<string, any>) {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error(
    {
      err: {
        message: err.message,
        name: err.name,
        stack: err.stack,
      },
      ...context,
    },
    `❌ ${err.message}`
  );
}

// Export the base logger for custom child loggers
export { baseLogger };

export default logger;
