import { Router } from 'express';
import { eq } from 'drizzle-orm';
import type { Server as SocketServer } from 'socket.io';

import { getDb, schema } from '../db';
import { LMStudioClient } from '@jobslave/llm-client';
import { JobScraperManager } from '@jobslave/job-scrapers';
import type { Job, UserProfile, JobSearchParams } from '@jobslave/shared';
import { generateId } from '@jobslave/shared';

const router = Router();

let manager: JobScraperManager | null = null;

async function getManager(io?: SocketServer): Promise<JobScraperManager> {
  if (manager) return manager;

  const db = getDb();
  const settings = await db.select().from(schema.settings).limit(1);

  if (settings.length === 0) {
    throw new Error('Settings not found');
  }

  const s = settings[0];

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
        console.log(`[${level}] ${message}`);
        io?.emit('automation:log', { level, message, timestamp: new Date().toISOString() });
      },
      onJobFound: (job) => {
        io?.emit('automation:job-found', job);
      },
      onApplicationStart: (job) => {
        io?.emit('automation:applying', job);
      },
      onApplicationComplete: (job, success) => {
        io?.emit('automation:applied', { job, success });
      },
      onScreeningQuestion: (question, answer) => {
        io?.emit('automation:screening', { question, answer });
      },
      onError: (error, job) => {
        io?.emit('automation:error', { error: error.message, job });
      },
      onQueueProgress: (current, total) => {
        io?.emit('automation:progress', { current, total });
      },
      onSessionComplete: (applied, failed) => {
        io?.emit('automation:complete', { applied, failed });
      },
    }
  );

  // Load profile
  const profiles = await db.select().from(schema.profiles).limit(1);
  if (profiles.length > 0) {
    const profile = profiles[0];
    manager.setProfile({
      ...profile,
      skills: JSON.parse(profile.skills),
      education: JSON.parse(profile.education),
      preferredTitles: JSON.parse(profile.preferredTitles),
      preferredLocations: JSON.parse(profile.preferredLocations),
      keywords: JSON.parse(profile.keywords),
    } as UserProfile);
  }

  return manager;
}

// Initialize browser
router.post('/init', async (req, res) => {
  try {
    const io = req.app.get('io') as SocketServer;
    const { source = 'naukri' } = req.body;
    const mgr = await getManager(io);

    await mgr.initialize(source);
    res.json({ message: `${source} browser initialized` });
  } catch (error) {
    console.error('Init error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Close browser
router.post('/close', async (req, res) => {
  try {
    const { source } = req.body;

    if (manager) {
      await manager.close(source);
    }

    res.json({ message: 'Browser closed' });
  } catch (error) {
    console.error('Close error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Check login status
router.get('/login-status/:source', async (req, res) => {
  try {
    const io = req.app.get('io') as SocketServer;
    const { source } = req.params;
    const mgr = await getManager(io);

    const isLoggedIn = await mgr.checkLogin(source);
    res.json({ isLoggedIn, source });
  } catch (error) {
    console.error('Login status error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Open login page
router.post('/login', async (req, res) => {
  try {
    const io = req.app.get('io') as SocketServer;
    const { source = 'naukri' } = req.body;
    const mgr = await getManager(io);

    await mgr.initiateLogin(source);
    res.json({ message: 'Login page opened. Please log in manually.' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Wait for login
router.post('/wait-for-login', async (req, res) => {
  try {
    const io = req.app.get('io') as SocketServer;
    const { source = 'naukri', timeout = 300000 } = req.body;
    const mgr = await getManager(io);

    const success = await mgr.waitForLogin(source, timeout);
    res.json({ success, message: success ? 'Login successful' : 'Login timeout' });
  } catch (error) {
    console.error('Wait for login error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Search jobs
router.post('/search', async (req, res) => {
  try {
    const io = req.app.get('io') as SocketServer;
    const { source = 'naukri', ...params } = req.body as JobSearchParams & { source?: string };
    const mgr = await getManager(io);

    const result = await mgr.searchJobs(source, params);

    // Save jobs to database
    const db = getDb();
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
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Apply to single job
router.post('/apply', async (req, res) => {
  try {
    const io = req.app.get('io') as SocketServer;
    const { source = 'naukri', job } = req.body;
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
      await db
        .update(schema.applications)
        .set({
          status: result.success ? 'applied' : (result.alreadyApplied ? 'skipped' : 'failed'),
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
    }

    res.json(result);
  } catch (error) {
    console.error('Apply error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Process queue
router.post('/process-queue', async (req, res) => {
  try {
    const io = req.app.get('io') as SocketServer;
    const { source = 'naukri' } = req.body;
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

    if (jobs.length === 0) {
      return res.json({ message: 'No jobs in queue', applied: 0, failed: 0, skipped: 0 });
    }

    // Process in background
    res.json({ message: `Processing ${jobs.length} jobs`, started: true });

    // Process queue (async)
    mgr.processJobQueue(source, jobs, async (job, index, result) => {
      // Update database
      const apps = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.jobId, job.id))
        .limit(1);

      if (apps.length > 0) {
        await db
          .update(schema.applications)
          .set({
            status: result.success ? 'applied' : (result.alreadyApplied ? 'skipped' : 'failed'),
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
    console.error('Process queue error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Stop processing
router.post('/stop', async (req, res) => {
  try {
    if (manager) {
      manager.stop();
    }
    res.json({ message: 'Processing stopped' });
  } catch (error) {
    console.error('Stop error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Get status
router.get('/status', async (req, res) => {
  try {
    if (!manager) {
      return res.json({ initialized: false });
    }

    const status = manager.getStatus();
    res.json({ initialized: true, ...status });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: String(error) });
  }
});

export { router as automationRoutes };
