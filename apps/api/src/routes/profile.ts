import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import { getDb, schema } from '../db';
import { generateId } from '@jobslave/shared';
import { LMStudioClient, ResumeParserService } from '@jobslave/llm-client';
import { getOCRService, type OCRProgress } from '../services/ocr';
import { logger, startTimer, logError } from '../utils/logger';

const router = Router();

// Configure multer for resume uploads
const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.app.info({ uploadsDir }, 'Created uploads directory');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `resume-${Date.now()}${ext}`;
    logger.api.debug({ originalName: file.originalname, newName: filename }, 'Processing file upload');
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      logger.api.debug({ ext, originalName: file.originalname }, 'File type accepted');
      cb(null, true);
    } else {
      logger.api.warn({ ext, originalName: file.originalname }, 'File type rejected');
      cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// All fields are optional to allow partial profile saves
const profileSchema = z.object({
  name: z.string().optional().default(''),
  email: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  currentTitle: z.string().optional().default(''),
  totalExperience: z.number().min(0).optional().default(0),
  currentCompany: z.string().optional(),
  skills: z.array(z.object({
    name: z.string(),
    yearsOfExperience: z.number(),
    proficiency: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  })).optional().default([]),
  education: z.array(z.object({
    degree: z.string(),
    institution: z.string(),
    year: z.number(),
    percentage: z.number().optional(),
  })).optional().default([]),
  preferredTitles: z.array(z.string()).optional().default([]),
  preferredLocations: z.array(z.string()).optional().default([]),
  keywords: z.array(z.string()).optional().default([]),
  currentCtc: z.number().optional(),
  expectedCtc: z.number().optional(),
  noticePeriod: z.enum(['immediate', '15_days', '30_days', '60_days', '90_days', 'more_than_90_days']).optional().default('immediate'),
  immediateJoiner: z.boolean().optional().default(false),
  willingToRelocate: z.boolean().optional().default(false),
  preferredWorkMode: z.enum(['remote', 'hybrid', 'onsite', 'any']).optional().default('any'),
});

// Get profile
router.get('/', async (req, res) => {
  const timer = startTimer('Get profile');
  try {
    logger.api.debug('Fetching user profile');
    const db = getDb();
    const profiles = await db.select().from(schema.profiles).limit(1);

    if (profiles.length === 0) {
      timer.end();
      logger.api.debug('No profile found');
      return res.json(null);
    }

    const profile = profiles[0];
    timer.end();
    logger.api.info({ profileId: profile.id, name: profile.name }, 'Profile retrieved');

    res.json({
      ...profile,
      skills: JSON.parse(profile.skills),
      education: JSON.parse(profile.education),
      preferredTitles: JSON.parse(profile.preferredTitles),
      preferredLocations: JSON.parse(profile.preferredLocations),
      keywords: JSON.parse(profile.keywords),
    });
  } catch (error) {
    timer.end();
    logError(logger.api, error, { action: 'get-profile' });
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Create or update profile
router.post('/', async (req, res) => {
  const timer = startTimer('Save profile');
  try {
    logger.api.debug({ bodyKeys: Object.keys(req.body) }, 'Processing profile save request');

    const validation = profileSchema.safeParse(req.body);
    if (!validation.success) {
      timer.end();
      logger.api.warn({ errors: validation.error.errors }, 'Profile validation failed');
      return res.status(400).json({ error: validation.error.errors });
    }

    const db = getDb();
    const data = validation.data;
    const now = new Date().toISOString();

    // Check if profile exists
    const existing = await db.select().from(schema.profiles).limit(1);

    if (existing.length > 0) {
      // Update
      logger.api.info({ profileId: existing[0].id, name: data.name }, 'Updating existing profile');
      await db
        .update(schema.profiles)
        .set({
          ...data,
          skills: JSON.stringify(data.skills),
          education: JSON.stringify(data.education),
          preferredTitles: JSON.stringify(data.preferredTitles),
          preferredLocations: JSON.stringify(data.preferredLocations),
          keywords: JSON.stringify(data.keywords),
          currentCtc: data.currentCtc || null,
          expectedCtc: data.expectedCtc || null,
          currentCompany: data.currentCompany || null,
          updatedAt: now,
        })
        .where(eq(schema.profiles.id, existing[0].id));

      timer.end();
      logger.api.info({ profileId: existing[0].id }, '✅ Profile updated successfully');
      res.json({ id: existing[0].id, message: 'Profile updated' });
    } else {
      // Create
      const id = generateId();
      logger.api.info({ profileId: id, name: data.name }, 'Creating new profile');

      await db.insert(schema.profiles).values({
        id,
        ...data,
        skills: JSON.stringify(data.skills),
        education: JSON.stringify(data.education),
        preferredTitles: JSON.stringify(data.preferredTitles),
        preferredLocations: JSON.stringify(data.preferredLocations),
        keywords: JSON.stringify(data.keywords),
        currentCtc: data.currentCtc || null,
        expectedCtc: data.expectedCtc || null,
        currentCompany: data.currentCompany || null,
        createdAt: now,
        updatedAt: now,
      });

      timer.end();
      logger.api.info({ profileId: id }, '✅ Profile created successfully');
      res.status(201).json({ id, message: 'Profile created' });
    }
  } catch (error) {
    timer.end();
    logError(logger.api, error, { action: 'save-profile' });
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// Upload resume
router.post('/resume', upload.single('resume'), async (req, res) => {
  const timer = startTimer('Resume upload');
  try {
    if (!req.file) {
      timer.end();
      logger.api.warn('Resume upload attempted without file');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    logger.api.info({
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    }, 'Processing resume upload');

    const db = getDb();
    const profiles = await db.select().from(schema.profiles).limit(1);

    if (profiles.length === 0) {
      timer.end();
      logger.api.warn('Resume upload attempted without existing profile');
      return res.status(400).json({ error: 'Create profile first' });
    }

    const resumePath = req.file.path;

    await db
      .update(schema.profiles)
      .set({
        resumePath,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.profiles.id, profiles[0].id));

    timer.end();
    logger.api.info({ resumePath, profileId: profiles[0].id }, '✅ Resume uploaded successfully');
    res.json({ resumePath, message: 'Resume uploaded' });
  } catch (error) {
    timer.end();
    logError(logger.api, error, { action: 'upload-resume' });
    res.status(500).json({ error: 'Failed to upload resume' });
  }
});

// Delete resume
router.delete('/resume', async (req, res) => {
  const timer = startTimer('Delete resume');
  try {
    logger.api.info('Processing resume delete request');

    const db = getDb();
    const profiles = await db.select().from(schema.profiles).limit(1);

    if (profiles.length === 0 || !profiles[0].resumePath) {
      timer.end();
      logger.api.warn('Resume delete attempted - no resume found');
      return res.status(404).json({ error: 'No resume found' });
    }

    // Delete file
    if (fs.existsSync(profiles[0].resumePath)) {
      fs.unlinkSync(profiles[0].resumePath);
      logger.api.debug({ path: profiles[0].resumePath }, 'Deleted resume file from disk');
    }

    await db
      .update(schema.profiles)
      .set({
        resumePath: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.profiles.id, profiles[0].id));

    timer.end();
    logger.api.info({ profileId: profiles[0].id }, '✅ Resume deleted successfully');
    res.json({ message: 'Resume deleted' });
  } catch (error) {
    timer.end();
    logError(logger.api, error, { action: 'delete-resume' });
    res.status(500).json({ error: 'Failed to delete resume' });
  }
});

// Parse resume with OCR + LLM - extracts all profile data with progress streaming
router.post('/parse-resume', upload.single('resume'), async (req, res) => {
  const timer = startTimer('Parse resume');
  try {
    if (!req.file) {
      timer.end();
      logger.api.warn('Parse resume attempted without file');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    logger.api.info({
      filename: req.file.filename,
      size: req.file.size,
      path: req.file.path
    }, '📄 Starting resume parsing');

    // Check if client wants SSE
    const useSSE = req.headers.accept === 'text/event-stream';
    logger.api.debug({ useSSE }, 'Response mode determined');

    if (useSSE) {
      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      logger.api.debug('SSE headers set');

      const sendProgress = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        logger.api.trace({ stage: data.stage, progress: data.progress }, 'SSE progress sent');
      };

      try {
        // Get LLM settings
        const db = getDb();
        const settings = await db.select().from(schema.settings).limit(1);
        const baseUrl = settings[0]?.llmBaseUrl || 'http://127.0.0.1:1234';
        const model = settings[0]?.llmModel || undefined;

        logger.llm.debug({ baseUrl, model }, 'LLM configuration loaded for parsing');

        // Extract text using OCR service with progress
        sendProgress({ type: 'progress', stage: 'ocr', progress: 0, message: 'Starting text extraction...' });
        logger.ocr.info('Starting OCR text extraction');

        const ocrService = getOCRService();
        const resumeText = await ocrService.extractText(req.file!.path, (progress: OCRProgress) => {
          logger.ocr.debug({
            stage: progress.stage,
            progress: progress.progress,
            currentPage: progress.currentPage,
            totalPages: progress.totalPages
          }, progress.message);

          sendProgress({
            type: 'progress',
            stage: 'ocr',
            progress: Math.round(progress.progress * 0.6), // OCR is 60% of total
            message: progress.message,
            currentPage: progress.currentPage,
            totalPages: progress.totalPages,
          });
        });

        if (!resumeText || resumeText.trim().length < 50) {
          timer.end();
          logger.ocr.error({ textLength: resumeText?.length || 0 }, 'Insufficient text extracted from resume');
          sendProgress({ type: 'error', message: 'Could not extract text from resume. Please ensure the PDF is readable.' });
          res.end();
          return;
        }

        logger.ocr.info({ textLength: resumeText.length }, '✅ OCR complete - text extracted');

        // Parse with LLM
        sendProgress({ type: 'progress', stage: 'llm', progress: 65, message: 'Analyzing resume with AI...' });
        logger.llm.info('Starting LLM resume analysis');

        const client = new LMStudioClient({ baseUrl, model });
        const parser = new ResumeParserService(client);

        sendProgress({ type: 'progress', stage: 'llm', progress: 75, message: 'Extracting structured data...' });

        logger.llm.debug({ baseUrl, model, textPreview: resumeText.substring(0, 200) }, 'Sending text to LLM for parsing');
        const parsedProfile = await parser.parseResume(resumeText);

        logger.llm.info({
          name: parsedProfile.name,
          email: parsedProfile.email,
          skillsCount: parsedProfile.skills?.length,
          educationCount: parsedProfile.education?.length
        }, '✅ LLM parsing complete');

        sendProgress({ type: 'progress', stage: 'complete', progress: 100, message: 'Resume parsed successfully!' });

        // Send final result
        sendProgress({
          type: 'result',
          data: {
            ...parsedProfile,
            resumePath: req.file!.path,
            rawText: resumeText.substring(0, 500) + '...', // Preview of extracted text
          },
        });

        timer.end();
        logger.api.info({ name: parsedProfile.name }, '✅ Resume parsing complete via SSE');
        res.end();
      } catch (error: any) {
        timer.end();
        logError(logger.api, error, { action: 'parse-resume-sse' });
        sendProgress({ type: 'error', message: error.message || 'Failed to parse resume' });
        res.end();
      }
    } else {
      // Non-SSE fallback (regular JSON response)
      logger.api.debug('Using non-SSE mode for resume parsing');

      const db = getDb();
      const settings = await db.select().from(schema.settings).limit(1);
      const baseUrl = settings[0]?.llmBaseUrl || 'http://127.0.0.1:1234';
      const model = settings[0]?.llmModel || undefined;

      logger.ocr.info('Starting OCR text extraction (non-SSE mode)');
      const ocrService = getOCRService();
      const resumeText = await ocrService.extractText(req.file.path);

      if (!resumeText || resumeText.trim().length < 50) {
        timer.end();
        logger.ocr.error({ textLength: resumeText?.length || 0 }, 'Insufficient text extracted from resume');
        return res.status(400).json({ error: 'Could not extract text from resume.' });
      }

      logger.ocr.info({ textLength: resumeText.length }, '✅ OCR complete');
      logger.llm.info('Starting LLM resume analysis');

      const client = new LMStudioClient({ baseUrl, model });
      const parser = new ResumeParserService(client);
      const parsedProfile = await parser.parseResume(resumeText);

      timer.end();
      logger.api.info({ name: parsedProfile.name }, '✅ Resume parsing complete');

      res.json({
        ...parsedProfile,
        resumePath: req.file.path,
        message: 'Resume parsed successfully. Review and save your profile.',
      });
    }
  } catch (error: any) {
    timer.end();
    logError(logger.api, error, { action: 'parse-resume' });
    res.status(500).json({ error: error.message || 'Failed to parse resume' });
  }
});

// Get job title suggestions based on profile
router.post('/suggest-titles', async (req, res) => {
  const timer = startTimer('Suggest job titles');
  try {
    const { currentTitle, totalExperience, skills } = req.body;

    if (!currentTitle) {
      timer.end();
      logger.api.warn('Title suggestion attempted without current title');
      return res.status(400).json({ error: 'Current title is required' });
    }

    logger.llm.info({
      currentTitle,
      totalExperience,
      skillsCount: skills?.length
    }, 'Generating job title suggestions');

    const db = getDb();
    const settings = await db.select().from(schema.settings).limit(1);
    const baseUrl = settings[0]?.llmBaseUrl || 'http://127.0.0.1:1234';
    const model = settings[0]?.llmModel || undefined;

    const client = new LMStudioClient({ baseUrl, model });
    const parser = new ResumeParserService(client);

    const titles = await parser.suggestJobTitles({
      currentTitle,
      totalExperience: totalExperience || 0,
      skills: skills || [],
    });

    timer.end();
    logger.llm.info({ suggestedCount: titles.length }, '✅ Job titles suggested');
    res.json({ titles });
  } catch (error: any) {
    timer.end();
    logError(logger.llm, error, { action: 'suggest-titles' });
    res.status(500).json({ error: error.message || 'Failed to suggest titles' });
  }
});

export { router as profileRoutes };
