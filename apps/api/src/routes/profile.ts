import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

import { getDb, schema } from '../db';
import { generateId } from '@jobslave/shared';
import { LMStudioClient, ResumeParserService } from '@jobslave/llm-client';

// pdf-parse v1.x is a CJS module that exports a function directly
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

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

const profileSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(10),
  currentTitle: z.string().min(1),
  totalExperience: z.number().min(0),
  currentCompany: z.string().optional(),
  skills: z.array(z.object({
    name: z.string(),
    yearsOfExperience: z.number(),
    proficiency: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  })),
  education: z.array(z.object({
    degree: z.string(),
    institution: z.string(),
    year: z.number(),
    percentage: z.number().optional(),
  })),
  preferredTitles: z.array(z.string()),
  preferredLocations: z.array(z.string()),
  keywords: z.array(z.string()),
  currentCtc: z.number().optional(),
  expectedCtc: z.number().optional(),
  noticePeriod: z.enum(['immediate', '15_days', '30_days', '60_days', '90_days', 'more_than_90_days']),
  immediateJoiner: z.boolean(),
  willingToRelocate: z.boolean(),
  preferredWorkMode: z.enum(['remote', 'hybrid', 'onsite', 'any']),
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

// Parse resume with LLM - extracts all profile data
router.post('/parse-resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get LLM settings
    const db = getDb();
    const settings = await db.select().from(schema.settings).limit(1);
    const baseUrl = settings[0]?.llmBaseUrl || 'http://127.0.0.1:1234';
    const model = settings[0]?.llmModel || undefined;

    // Extract text from PDF
    let resumeText = '';
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(req.file.path);
      const pdfData = await pdfParse(dataBuffer);
      resumeText = pdfData.text;
    } else {
      // For DOC/DOCX, we'll just read as text (basic support)
      // In production, you'd use a proper DOCX parser
      resumeText = fs.readFileSync(req.file.path, 'utf-8');
    }

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract text from resume. Please ensure the PDF is not scanned/image-based.' });
    }

    // Parse with LLM
    const client = new LMStudioClient({ baseUrl, model });
    const parser = new ResumeParserService(client);
    const parsedProfile = await parser.parseResume(resumeText);

    // Save the resume file path
    const resumePath = req.file.path;

    // Return parsed data (don't save yet - let user review)
    res.json({
      ...parsedProfile,
      resumePath,
      message: 'Resume parsed successfully. Review and save your profile.',
    });
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
