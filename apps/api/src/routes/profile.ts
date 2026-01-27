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

const router = Router();

// Configure multer for resume uploads
const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `resume-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
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
  try {
    const db = getDb();
    const profiles = await db.select().from(schema.profiles).limit(1);

    if (profiles.length === 0) {
      return res.json(null);
    }

    const profile = profiles[0];
    res.json({
      ...profile,
      skills: JSON.parse(profile.skills),
      education: JSON.parse(profile.education),
      preferredTitles: JSON.parse(profile.preferredTitles),
      preferredLocations: JSON.parse(profile.preferredLocations),
      keywords: JSON.parse(profile.keywords),
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Create or update profile
router.post('/', async (req, res) => {
  try {
    const validation = profileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }

    const db = getDb();
    const data = validation.data;
    const now = new Date().toISOString();

    // Check if profile exists
    const existing = await db.select().from(schema.profiles).limit(1);

    if (existing.length > 0) {
      // Update
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

      res.json({ id: existing[0].id, message: 'Profile updated' });
    } else {
      // Create
      const id = generateId();
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

      res.status(201).json({ id, message: 'Profile created' });
    }
  } catch (error) {
    console.error('Save profile error:', error);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// Upload resume
router.post('/resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const db = getDb();
    const profiles = await db.select().from(schema.profiles).limit(1);

    if (profiles.length === 0) {
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

    res.json({ resumePath, message: 'Resume uploaded' });
  } catch (error) {
    console.error('Upload resume error:', error);
    res.status(500).json({ error: 'Failed to upload resume' });
  }
});

// Delete resume
router.delete('/resume', async (req, res) => {
  try {
    const db = getDb();
    const profiles = await db.select().from(schema.profiles).limit(1);

    if (profiles.length === 0 || !profiles[0].resumePath) {
      return res.status(404).json({ error: 'No resume found' });
    }

    // Delete file
    if (fs.existsSync(profiles[0].resumePath)) {
      fs.unlinkSync(profiles[0].resumePath);
    }

    await db
      .update(schema.profiles)
      .set({
        resumePath: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.profiles.id, profiles[0].id));

    res.json({ message: 'Resume deleted' });
  } catch (error) {
    console.error('Delete resume error:', error);
    res.status(500).json({ error: 'Failed to delete resume' });
  }
});

// Parse resume with OCR + LLM - extracts all profile data with progress streaming
router.post('/parse-resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check if client wants SSE
    const useSSE = req.headers.accept === 'text/event-stream';

    if (useSSE) {
      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const sendProgress = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      try {
        // Get LLM settings
        const db = getDb();
        const settings = await db.select().from(schema.settings).limit(1);
        const baseUrl = settings[0]?.llmBaseUrl || 'http://127.0.0.1:1234';
        const model = settings[0]?.llmModel || undefined;

        // Extract text using OCR service with progress
        sendProgress({ type: 'progress', stage: 'ocr', progress: 0, message: 'Starting text extraction...' });

        const ocrService = getOCRService();
        const resumeText = await ocrService.extractText(req.file!.path, (progress: OCRProgress) => {
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
          sendProgress({ type: 'error', message: 'Could not extract text from resume. Please ensure the PDF is readable.' });
          res.end();
          return;
        }

        // Parse with LLM
        sendProgress({ type: 'progress', stage: 'llm', progress: 65, message: 'Analyzing resume with AI...' });

        const client = new LMStudioClient({ baseUrl, model });
        const parser = new ResumeParserService(client);

        sendProgress({ type: 'progress', stage: 'llm', progress: 75, message: 'Extracting structured data...' });

        console.log('[Resume Parse] Starting LLM parse with baseUrl:', baseUrl, 'model:', model);
        const parsedProfile = await parser.parseResume(resumeText);
        console.log('[Resume Parse] LLM result:', JSON.stringify(parsedProfile, null, 2));

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

        res.end();
      } catch (error: any) {
        sendProgress({ type: 'error', message: error.message || 'Failed to parse resume' });
        res.end();
      }
    } else {
      // Non-SSE fallback (regular JSON response)
      const db = getDb();
      const settings = await db.select().from(schema.settings).limit(1);
      const baseUrl = settings[0]?.llmBaseUrl || 'http://127.0.0.1:1234';
      const model = settings[0]?.llmModel || undefined;

      const ocrService = getOCRService();
      const resumeText = await ocrService.extractText(req.file.path);

      if (!resumeText || resumeText.trim().length < 50) {
        return res.status(400).json({ error: 'Could not extract text from resume.' });
      }

      const client = new LMStudioClient({ baseUrl, model });
      const parser = new ResumeParserService(client);
      const parsedProfile = await parser.parseResume(resumeText);

      res.json({
        ...parsedProfile,
        resumePath: req.file.path,
        message: 'Resume parsed successfully. Review and save your profile.',
      });
    }
  } catch (error: any) {
    console.error('Parse resume error:', error);
    res.status(500).json({ error: error.message || 'Failed to parse resume' });
  }
});

// Get job title suggestions based on profile
router.post('/suggest-titles', async (req, res) => {
  try {
    const { currentTitle, totalExperience, skills } = req.body;

    if (!currentTitle) {
      return res.status(400).json({ error: 'Current title is required' });
    }

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

    res.json({ titles });
  } catch (error: any) {
    console.error('Suggest titles error:', error);
    res.status(500).json({ error: error.message || 'Failed to suggest titles' });
  }
});

export { router as profileRoutes };
