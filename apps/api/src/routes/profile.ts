import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import { getDb, schema } from '../db';
import { generateId } from '@jobslave/shared';

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

export { router as profileRoutes };
