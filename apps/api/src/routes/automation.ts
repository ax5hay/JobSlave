import { Router } from 'express';
import { eq } from 'drizzle-orm';
import type { Server as SocketServer } from 'socket.io';

import { getDb, schema } from '../db';
import { LMStudioClient } from '@jobslave/llm-client';
import { JobScraperManager } from '@jobslave/job-scrapers';
import type { Job, UserProfile, JobSearchParams } from '@jobslave/shared';
import { generateId } from '@jobslave/shared';
import { logger, startTimer, logError } from '../utils/logger';

const router = Router();

let manager: JobScraperManager | null = null;

async function getManager(io?: SocketServer): Promise<JobScraperManager> {
  if (manager) {
    logger.automation.debug('Returning existing JobScraperManager instance');
    return manager;
  }

  logger.automation.info('Creating new JobScraperManager instance');
  const timer = startTimer('JobScraperManager initialization');

  const db = getDb();
  const settings = await db.select().from(schema.settings).limit(1);

  if (settings.length === 0) {
    logger.automation.error('Settings not found - cannot create manager');
    throw new Error('Settings not found');
  }

  const s = settings[0];
  logger.automation.debug({
    llmBaseUrl: s.llmBaseUrl,
    llmModel: s.llmModel,
    headless: s.automationHeadless,
    delay: s.automationDelay,
    maxPerSession: s.automationMaxPerSession,
  }, 'Manager configuration');

  const llmClient = new LMStudioClient({
    baseUrl: s.llmBaseUrl,
    model: s.llmModel || '',
    temperature: s.llmTemperature,
    maxTokens: s.llmMaxTokens,
  });

  manager = new JobScraperManager(
    llmClient,
    {
      headless: s.automationHeadless,
      delayBetweenApplications: s.automationDelay,
      maxApplicationsPerSession: s.automationMaxPerSession,
      timeout: 30000,
    },
    {
      onLog: (level, message) => {
        // Use our centralized logger
        const logLevel = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info';
        logger.scraper[logLevel](message);
        io?.emit('automation:log', { level, message, timestamp: new Date().toISOString() });
      },
      onJobFound: (job) => {
        logger.automation.info({ jobTitle: job.title, company: job.company }, 'Job found');
        io?.emit('automation:job-found', job);
      },
      onApplicationStart: (job) => {
        logger.automation.info({ jobTitle: job.title, company: job.company, jobId: job.id }, 'Starting application');
        io?.emit('automation:applying', job);
      },
      onApplicationComplete: (job, success) => {
        if (success) {
          logger.automation.info({ jobTitle: job.title, company: job.company, jobId: job.id }, '✅ Application completed successfully');
        } else {
          logger.automation.warn({ jobTitle: job.title, company: job.company, jobId: job.id }, '❌ Application failed');
        }
        io?.emit('automation:applied', { job, success });
      },
      onScreeningQuestion: (question, answer) => {
        logger.automation.debug({ question: question.substring(0, 100), answer: answer.substring(0, 50) }, 'Screening question answered');
        io?.emit('automation:screening', { question, answer });
      },
      onError: (error, job) => {
        logError(logger.automation, error, { job: job?.title, company: job?.company });
        io?.emit('automation:error', { error: error.message, job });
      },
      onQueueProgress: (current, total) => {
        logger.automation.debug({ current, total, percentage: Math.round((current / total) * 100) }, 'Queue progress');
        io?.emit('automation:progress', { current, total });
      },
      onSessionComplete: (applied, failed) => {
        logger.automation.info({ applied, failed, total: applied + failed }, '🏁 Session complete');
        io?.emit('automation:complete', { applied, failed });
      },
    }
  );

  // Load profile
  const profiles = await db.select().from(schema.profiles).limit(1);
  if (profiles.length > 0) {
    const profile = profiles[0];
    logger.automation.debug({ profileName: profile.name }, 'Loading user profile into manager');
    manager.setProfile({
      ...profile,
      skills: JSON.parse(profile.skills),
      education: JSON.parse(profile.education),
      preferredTitles: JSON.parse(profile.preferredTitles),
      preferredLocations: JSON.parse(profile.preferredLocations),
      keywords: JSON.parse(profile.keywords),
    } as UserProfile);
  } else {
    logger.automation.warn('No profile found - manager will operate without profile data');
  }

  timer.end();
  return manager;
}

// Initialize browser
router.post('/init', async (req, res) => {
  const timer = startTimer('Browser initialization');
  try {
    const io = req.app.get('io') as SocketServer;
    const { source = 'naukri' } = req.body;

    logger.automation.info({ source }, '🌐 Initializing browser');

    const mgr = await getManager(io);
    await mgr.initialize(source);

    timer.end();
    logger.automation.info({ source }, '✅ Browser initialized successfully');
    res.json({ message: `${source} browser initialized` });
  } catch (error) {
    timer.end();
    logError(logger.automation, error, { action: 'init' });
    res.status(500).json({ error: String(error) });
  }
});

// Close browser
router.post('/close', async (req, res) => {
  const timer = startTimer('Browser close');
  try {
    const { source } = req.body;
    logger.automation.info({ source }, '🔒 Closing browser');

    if (manager) {
      await manager.close(source);
      logger.automation.info({ source }, '✅ Browser closed');
    } else {
      logger.automation.debug('No manager instance to close');
    }

    timer.end();
    res.json({ message: 'Browser closed' });
  } catch (error) {
    timer.end();
    logError(logger.automation, error, { action: 'close' });
    res.status(500).json({ error: String(error) });
  }
});

// Check login status
router.get('/login-status/:source', async (req, res) => {
  try {
    const io = req.app.get('io') as SocketServer;
    const { source } = req.params;

    logger.automation.debug({ source }, 'Checking login status');

    const mgr = await getManager(io);
    const isLoggedIn = await mgr.checkLogin(source);

    logger.automation.info({ source, isLoggedIn }, `Login status: ${isLoggedIn ? '✅ Logged in' : '❌ Not logged in'}`);
    res.json({ isLoggedIn, source });
  } catch (error) {
    logError(logger.automation, error, { action: 'login-status' });
    res.status(500).json({ error: String(error) });
  }
});

// Open login page
router.post('/login', async (req, res) => {
  try {
    const io = req.app.get('io') as SocketServer;
    const { source = 'naukri' } = req.body;

    logger.automation.info({ source }, '🔓 Opening login page');

    const mgr = await getManager(io);
    await mgr.initiateLogin(source);

    logger.automation.info({ source }, '✅ Login page opened - awaiting manual login');
    res.json({ message: 'Login page opened. Please log in manually.' });
  } catch (error) {
    logError(logger.automation, error, { action: 'login' });
    res.status(500).json({ error: String(error) });
  }
});

// Wait for login
router.post('/wait-for-login', async (req, res) => {
  const timer = startTimer('Wait for login');
  try {
    const io = req.app.get('io') as SocketServer;
    const { source = 'naukri', timeout = 300000 } = req.body;

    logger.automation.info({ source, timeoutMs: timeout, timeoutSec: timeout / 1000 }, '⏳ Waiting for user to complete login');

    const mgr = await getManager(io);
    const success = await mgr.waitForLogin(source, timeout);

    timer.end();
    if (success) {
      logger.automation.info({ source }, '✅ Login successful');
    } else {
      logger.automation.warn({ source, timeout }, '⏰ Login timeout - user did not complete login in time');
    }

    res.json({ success, message: success ? 'Login successful' : 'Login timeout' });
  } catch (error) {
    timer.end();
    logError(logger.automation, error, { action: 'wait-for-login' });
    res.status(500).json({ error: String(error) });
  }
});

// Search jobs
router.post('/search', async (req, res) => {
  const timer = startTimer('Job search');
  try {
    const io = req.app.get('io') as SocketServer;
    const { source = 'naukri', ...params } = req.body as JobSearchParams & { source?: string };

    logger.automation.info({
      source,
      keywords: params.keywords,
      locations: params.locations,
      experienceMin: params.experienceMin,
      experienceMax: params.experienceMax,
    }, '🔍 Starting job search');

    const mgr = await getManager(io);
    const result = await mgr.searchJobs(source, params);

    logger.automation.info({
      source,
      jobsFound: result.jobs.length,
      totalCount: result.totalCount,
      page: result.page,
      hasMore: result.hasMore,
    }, `📋 Search complete - found ${result.jobs.length} jobs`);

    // Save jobs to database
    const db = getDb();
    let savedCount = 0;
    for (const job of result.jobs) {
      const existing = await db
        .select()
        .from(schema.jobs)
        .where(eq(schema.jobs.externalId, job.externalId))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(schema.jobs).values({
          id: job.id || generateId(),
          externalId: job.externalId,
          source: job.source,
          title: job.title,
          company: job.company,
          location: job.location,
          experienceMin: job.experienceRange?.min,
          experienceMax: job.experienceRange?.max,
          description: job.description || '',
          skills: job.skills ? JSON.stringify(job.skills) : null,
          jobUrl: job.jobUrl,
          scrapedAt: job.scrapedAt,
        });
        savedCount++;
      }
    }

    logger.automation.debug({ savedCount, totalJobs: result.jobs.length }, `Saved ${savedCount} new jobs to database`);
    timer.end();
    res.json(result);
  } catch (error) {
    timer.end();
    logError(logger.automation, error, { action: 'search' });
    res.status(500).json({ error: String(error) });
  }
});

// Apply to single job
router.post('/apply', async (req, res) => {
  const timer = startTimer('Single job application');
  try {
    const io = req.app.get('io') as SocketServer;
    const { source = 'naukri', job } = req.body;

    logger.automation.info({
      source,
      jobTitle: job.title,
      company: job.company,
      jobId: job.id,
    }, '📝 Starting single job application');

    const mgr = await getManager(io);
    const result = await mgr.applyToJob(source, job);

    // Update application status
    const db = getDb();
    const applications = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.jobId, job.id))
      .limit(1);

    if (applications.length > 0) {
      const newStatus = result.success ? 'applied' : (result.alreadyApplied ? 'skipped' : 'failed');
      await db
        .update(schema.applications)
        .set({
          status: newStatus,
          appliedAt: result.success ? new Date().toISOString() : null,
          error: result.error,
          screeningQuestions: result.screeningQuestions
            ? JSON.stringify(result.screeningQuestions)
            : null,
          attempts: applications[0].attempts + 1,
          lastAttemptAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.applications.id, applications[0].id));

      logger.automation.debug({
        applicationId: applications[0].id,
        newStatus,
        attempts: applications[0].attempts + 1,
      }, 'Updated application status in database');
    }

    timer.end();
    if (result.success) {
      logger.automation.info({ jobTitle: job.title, company: job.company }, '✅ Application submitted successfully');
    } else if (result.alreadyApplied) {
      logger.automation.info({ jobTitle: job.title, company: job.company }, '⏭️ Already applied to this job');
    } else {
      logger.automation.warn({ jobTitle: job.title, company: job.company, error: result.error }, '❌ Application failed');
    }

    res.json(result);
  } catch (error) {
    timer.end();
    logError(logger.automation, error, { action: 'apply' });
    res.status(500).json({ error: String(error) });
  }
});

// Process queue
router.post('/process-queue', async (req, res) => {
  const timer = startTimer('Queue processing start');
  try {
    const io = req.app.get('io') as SocketServer;
    const { source = 'naukri' } = req.body;

    logger.automation.info({ source }, '🚀 Starting queue processing');

    const mgr = await getManager(io);

    // Get queued jobs
    const db = getDb();
    const queuedApps = await db
      .select({
        application: schema.applications,
        job: schema.jobs,
      })
      .from(schema.applications)
      .leftJoin(schema.jobs, eq(schema.applications.jobId, schema.jobs.id))
      .where(eq(schema.applications.status, 'queued'));

    const jobs: Job[] = queuedApps
      .filter(a => a.job)
      .map(a => ({
        ...a.job!,
        experienceRange: a.job!.experienceMin && a.job!.experienceMax
          ? { min: a.job!.experienceMin, max: a.job!.experienceMax }
          : undefined,
      }));

    logger.automation.info({ queueSize: jobs.length, source }, `📋 Found ${jobs.length} jobs in queue`);

    if (jobs.length === 0) {
      timer.end();
      logger.automation.info('No jobs in queue - nothing to process');
      return res.json({ message: 'No jobs in queue', applied: 0, failed: 0, skipped: 0 });
    }

    // Process in background
    timer.end();
    res.json({ message: `Processing ${jobs.length} jobs`, started: true });

    // Process queue (async)
    logger.automation.info({ jobCount: jobs.length }, '⏳ Starting async queue processing');
    mgr.processJobQueue(source, jobs, async (job, index, result) => {
      logger.automation.debug({
        index: index + 1,
        total: jobs.length,
        jobTitle: job.title,
        success: result.success,
        alreadyApplied: result.alreadyApplied,
      }, `Processing job ${index + 1}/${jobs.length}`);

      // Update database
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.jobId, job.id))
        .limit(1);

      if (apps.length > 0) {
        const newStatus = result.success ? 'applied' : (result.alreadyApplied ? 'skipped' : 'failed');
        await db
          .update(schema.applications)
          .set({
            status: newStatus,
            appliedAt: result.success ? new Date().toISOString() : null,
            error: result.error,
            attempts: apps[0].attempts + 1,
            lastAttemptAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.applications.id, apps[0].id));
      }
    });
  } catch (error) {
    timer.end();
    logError(logger.automation, error, { action: 'process-queue' });
    res.status(500).json({ error: String(error) });
  }
});

// Stop processing
router.post('/stop', async (req, res) => {
  try {
    logger.automation.info('🛑 Stop requested');

    if (manager) {
      manager.stop();
      logger.automation.info('✅ Processing stopped');
    } else {
      logger.automation.debug('No manager instance - nothing to stop');
    }

    res.json({ message: 'Processing stopped' });
  } catch (error) {
    logError(logger.automation, error, { action: 'stop' });
    res.status(500).json({ error: String(error) });
  }
});

// Get status
router.get('/status', async (req, res) => {
  try {
    if (!manager) {
      logger.automation.debug('Status check: manager not initialized');
      return res.json({ initialized: false });
    }

    const status = manager.getStatus();
    logger.automation.trace({ status }, 'Status check');
    res.json({ initialized: true, ...status });
  } catch (error) {
    logError(logger.automation, error, { action: 'status' });
    res.status(500).json({ error: String(error) });
  }
});

export { router as automationRoutes };
