import { Router } from 'express';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { getDb, schema } from '../db';
import { generateId } from '@jobslave/shared';
import type { Job, ApplicationStatus } from '@jobslave/shared';
import { logger, startTimer, logError } from '../utils/logger';

const router = Router();

const searchParamsSchema = z.object({
  keywords: z.array(z.string()).min(1),
  locations: z.array(z.string()).min(1),
  experienceMin: z.number().optional(),
  experienceMax: z.number().optional(),
  salaryMin: z.number().optional(),
  workMode: z.enum(['remote', 'hybrid', 'onsite', 'any']).optional(),
  postedWithin: z.enum(['1d', '3d', '7d', '15d', '30d']).optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
});

// Get saved jobs
router.get('/', async (req, res) => {
  const timer = startTimer('Get jobs list');
  try {
    const db = getDb();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    logger.db.debug({ page, limit, offset }, 'Fetching saved jobs');

    const savedJobs = await db
      .select()
      .from(schema.jobs)
      .orderBy(desc(schema.jobs.scrapedAt))
      .limit(limit)
      .offset(offset);

    const jobs = savedJobs.map(job => ({
      ...job,
      experienceRange: job.experienceMin && job.experienceMax
        ? { min: job.experienceMin, max: job.experienceMax }
        : undefined,
      salaryRange: job.salaryMin && job.salaryMax
        ? { min: job.salaryMin, max: job.salaryMax, currency: job.salaryCurrency || 'INR' }
        : undefined,
      requirements: job.requirements ? JSON.parse(job.requirements) : undefined,
      skills: job.skills ? JSON.parse(job.skills) : undefined,
      matchedKeywords: job.matchedKeywords ? JSON.parse(job.matchedKeywords) : undefined,
    }));

    timer.end();
    logger.db.info({ count: jobs.length, page, limit }, `Retrieved ${jobs.length} jobs`);
    res.json({ jobs, page, limit });
  } catch (error) {
    timer.end();
    logError(logger.db, error, { action: 'get-jobs' });
    res.status(500).json({ error: 'Failed to get jobs' });
  }
});

// Save jobs from search
router.post('/save', async (req, res) => {
  const timer = startTimer('Save jobs');
  try {
    const db = getDb();
    const jobs: Job[] = req.body.jobs;

    if (!Array.isArray(jobs) || jobs.length === 0) {
      timer.end();
      logger.api.warn('Save jobs attempted with empty array');
      return res.status(400).json({ error: 'No jobs provided' });
    }

    logger.db.info({ jobCount: jobs.length }, 'Saving jobs to database');

    let savedCount = 0;
    for (const job of jobs) {
      // Check if job already exists
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
          workMode: job.workMode,
          experienceMin: job.experienceRange?.min,
          experienceMax: job.experienceRange?.max,
          salaryMin: job.salaryRange?.min,
          salaryMax: job.salaryRange?.max,
          salaryCurrency: job.salaryRange?.currency,
          description: job.description,
          requirements: job.requirements ? JSON.stringify(job.requirements) : null,
          skills: job.skills ? JSON.stringify(job.skills) : null,
          jobUrl: job.jobUrl,
          applyUrl: job.applyUrl,
          postedDate: job.postedDate,
          scrapedAt: job.scrapedAt,
          matchScore: job.matchScore,
          matchedKeywords: job.matchedKeywords ? JSON.stringify(job.matchedKeywords) : null,
        });
        savedCount++;
        logger.db.debug({ jobTitle: job.title, company: job.company, externalId: job.externalId }, 'Job saved');
      } else {
        logger.db.trace({ externalId: job.externalId }, 'Job already exists, skipping');
      }
    }

    timer.end();
    logger.db.info({ savedCount, totalProvided: jobs.length }, `✅ Saved ${savedCount} new jobs`);
    res.json({ saved: savedCount, total: jobs.length });
  } catch (error) {
    timer.end();
    logError(logger.db, error, { action: 'save-jobs' });
    res.status(500).json({ error: 'Failed to save jobs' });
  }
});

// Add jobs to queue
router.post('/queue', async (req, res) => {
  const timer = startTimer('Queue jobs');
  try {
    const db = getDb();
    const { jobIds } = req.body;

    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      timer.end();
      logger.api.warn('Queue jobs attempted with empty array');
      return res.status(400).json({ error: 'No job IDs provided' });
    }

    logger.db.info({ jobIdCount: jobIds.length }, 'Adding jobs to queue');

    const now = new Date().toISOString();
    let queuedCount = 0;

    for (const jobId of jobIds) {
      // Check if application already exists
      const existing = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.jobId, jobId))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(schema.applications).values({
          id: generateId(),
          jobId,
          status: 'queued',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
        });
        queuedCount++;
        logger.db.debug({ jobId }, 'Job added to queue');
      } else {
        logger.db.trace({ jobId, existingStatus: existing[0].status }, 'Job already in queue');
      }
    }

    timer.end();
    logger.db.info({ queuedCount, totalProvided: jobIds.length }, `✅ Queued ${queuedCount} jobs`);
    res.json({ queued: queuedCount, total: jobIds.length });
  } catch (error) {
    timer.end();
    logError(logger.db, error, { action: 'queue-jobs' });
    res.status(500).json({ error: 'Failed to queue jobs' });
  }
});

// Get application queue
router.get('/queue', async (req, res) => {
  const timer = startTimer('Get queue');
  try {
    const db = getDb();
    const status = req.query.status as ApplicationStatus | undefined;

    logger.db.debug({ statusFilter: status }, 'Fetching application queue');

    let query = db
      .select({
        application: schema.applications,
        job: schema.jobs,
      })
      .from(schema.applications)
      .leftJoin(schema.jobs, eq(schema.applications.jobId, schema.jobs.id))
      .orderBy(desc(schema.applications.createdAt));

    const results = await query;

    const applications = results
      .filter(r => !status || r.application.status === status)
      .map(r => ({
        ...r.application,
        job: r.job ? {
          ...r.job,
          experienceRange: r.job.experienceMin && r.job.experienceMax
            ? { min: r.job.experienceMin, max: r.job.experienceMax }
            : undefined,
        } : null,
        screeningQuestions: r.application.screeningQuestions
          ? JSON.parse(r.application.screeningQuestions)
          : undefined,
        answersProvided: r.application.answersProvided
          ? JSON.parse(r.application.answersProvided)
          : undefined,
      }));

    timer.end();
    logger.db.info({ count: applications.length, statusFilter: status }, `Retrieved ${applications.length} applications`);
    res.json({ applications });
  } catch (error) {
    timer.end();
    logError(logger.db, error, { action: 'get-queue' });
    res.status(500).json({ error: 'Failed to get queue' });
  }
});

// Update application status
router.patch('/queue/:id', async (req, res) => {
  const timer = startTimer('Update application');
  try {
    const db = getDb();
    const { id } = req.params;
    const updates = req.body;

    logger.db.info({ applicationId: id, updates: Object.keys(updates) }, 'Updating application');

    await db
      .update(schema.applications)
      .set({
        ...updates,
        screeningQuestions: updates.screeningQuestions
          ? JSON.stringify(updates.screeningQuestions)
          : undefined,
        answersProvided: updates.answersProvided
          ? JSON.stringify(updates.answersProvided)
          : undefined,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.applications.id, id));

    timer.end();
    logger.db.info({ applicationId: id }, '✅ Application updated');
    res.json({ message: 'Application updated' });
  } catch (error) {
    timer.end();
    logError(logger.db, error, { action: 'update-application', applicationId: req.params.id });
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// Remove from queue
router.delete('/queue/:id', async (req, res) => {
  const timer = startTimer('Remove from queue');
  try {
    const db = getDb();
    const { id } = req.params;

    logger.db.info({ applicationId: id }, 'Removing application from queue');

    await db.delete(schema.applications).where(eq(schema.applications.id, id));

    timer.end();
    logger.db.info({ applicationId: id }, '✅ Application removed from queue');
    res.json({ message: 'Application removed from queue' });
  } catch (error) {
    timer.end();
    logError(logger.db, error, { action: 'remove-from-queue', applicationId: req.params.id });
    res.status(500).json({ error: 'Failed to remove from queue' });
  }
});

// Get application stats
router.get('/stats', async (req, res) => {
  const timer = startTimer('Get stats');
  try {
    const db = getDb();

    logger.db.debug('Calculating application statistics');

    const allApplications = await db.select().from(schema.applications);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const stats = {
      total: allApplications.length,
      queued: allApplications.filter(a => a.status === 'queued').length,
      processing: allApplications.filter(a => a.status === 'processing').length,
      applied: allApplications.filter(a => a.status === 'applied').length,
      failed: allApplications.filter(a => a.status === 'failed').length,
      skipped: allApplications.filter(a => a.status === 'skipped').length,
      todayApplied: allApplications.filter(a =>
        a.status === 'applied' &&
        a.appliedAt &&
        new Date(a.appliedAt) >= today
      ).length,
      weekApplied: allApplications.filter(a =>
        a.status === 'applied' &&
        a.appliedAt &&
        new Date(a.appliedAt) >= weekAgo
      ).length,
    };

    timer.end();
    logger.db.info({
      total: stats.total,
      queued: stats.queued,
      applied: stats.applied,
      failed: stats.failed,
      todayApplied: stats.todayApplied
    }, '📊 Stats calculated');

    res.json(stats);
  } catch (error) {
    timer.end();
    logError(logger.db, error, { action: 'get-stats' });
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export { router as jobsRoutes };
