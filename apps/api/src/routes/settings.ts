import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { getDb, schema } from '../db';

const router = Router();

const settingsSchema = z.object({
  llm: z.object({
    baseUrl: z.string().url().optional(),
    selectedModel: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(8192).optional(),
  }).optional(),
  automation: z.object({
    delayBetweenApplications: z.number().min(1000).optional(),
    maxApplicationsPerSession: z.number().min(1).max(200).optional(),
    headless: z.boolean().optional(),
    retryOnFailure: z.boolean().optional(),
    maxRetries: z.number().min(0).max(10).optional(),
  }).optional(),
  notifications: z.object({
    soundEnabled: z.boolean().optional(),
    desktopNotifications: z.boolean().optional(),
  }).optional(),
});

// Get settings
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const settings = await db.select().from(schema.settings).limit(1);

    if (settings.length === 0) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    const s = settings[0];
    res.json({
      llm: {
        baseUrl: s.llmBaseUrl,
        selectedModel: s.llmModel || '',
        temperature: s.llmTemperature,
        maxTokens: s.llmMaxTokens,
      },
      automation: {
        delayBetweenApplications: s.automationDelay,
        maxApplicationsPerSession: s.automationMaxPerSession,
        headless: s.automationHeadless,
        retryOnFailure: s.automationRetry,
        maxRetries: s.automationMaxRetries,
      },
      credentials: s.credentials ? JSON.parse(s.credentials) : {},
      notifications: {
        soundEnabled: s.notificationsSound,
        desktopNotifications: s.notificationsDesktop,
      },
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update settings
router.patch('/', async (req, res) => {
  try {
    const validation = settingsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }

    const db = getDb();
    const data = validation.data;
    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (data.llm) {
      if (data.llm.baseUrl !== undefined) updates.llmBaseUrl = data.llm.baseUrl;
      if (data.llm.selectedModel !== undefined) updates.llmModel = data.llm.selectedModel;
      if (data.llm.temperature !== undefined) updates.llmTemperature = data.llm.temperature;
      if (data.llm.maxTokens !== undefined) updates.llmMaxTokens = data.llm.maxTokens;
    }

    if (data.automation) {
      if (data.automation.delayBetweenApplications !== undefined) updates.automationDelay = data.automation.delayBetweenApplications;
      if (data.automation.maxApplicationsPerSession !== undefined) updates.automationMaxPerSession = data.automation.maxApplicationsPerSession;
      if (data.automation.headless !== undefined) updates.automationHeadless = data.automation.headless;
      if (data.automation.retryOnFailure !== undefined) updates.automationRetry = data.automation.retryOnFailure;
      if (data.automation.maxRetries !== undefined) updates.automationMaxRetries = data.automation.maxRetries;
    }

    if (data.notifications) {
      if (data.notifications.soundEnabled !== undefined) updates.notificationsSound = data.notifications.soundEnabled;
      if (data.notifications.desktopNotifications !== undefined) updates.notificationsDesktop = data.notifications.desktopNotifications;
    }

    await db
      .update(schema.settings)
      .set(updates)
      .where(eq(schema.settings.id, 'default'));

    res.json({ message: 'Settings updated' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Clear session
router.delete('/session/:source', async (req, res) => {
  try {
    const { source } = req.params;
    const db = getDb();

    const settings = await db.select().from(schema.settings).limit(1);
    if (settings.length === 0) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    const credentials = settings[0].credentials
      ? JSON.parse(settings[0].credentials)
      : {};

    if (credentials[source]) {
      delete credentials[source];
      await db
        .update(schema.settings)
        .set({
          credentials: JSON.stringify(credentials),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.settings.id, 'default'));
    }

    res.json({ message: `${source} session cleared` });
  } catch (error) {
    console.error('Clear session error:', error);
    res.status(500).json({ error: 'Failed to clear session' });
  }
});

export { router as settingsRoutes };
