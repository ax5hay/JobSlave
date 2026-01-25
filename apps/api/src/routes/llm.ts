import { Router } from 'express';
import { eq } from 'drizzle-orm';

import { getDb, schema } from '../db';
import { LMStudioClient, ScreeningAnswerService } from '@jobslave/llm-client';
import type { UserProfile } from '@jobslave/shared';

const router = Router();

let llmClient: LMStudioClient | null = null;
let screeningService: ScreeningAnswerService | null = null;

async function getLLMClient(): Promise<LMStudioClient> {
  const db = getDb();
  const settings = await db.select().from(schema.settings).limit(1);

  if (settings.length === 0) {
    throw new Error('Settings not found');
  }

  const config = {
    baseUrl: settings[0].llmBaseUrl,
    model: settings[0].llmModel || '',
    temperature: settings[0].llmTemperature,
    maxTokens: settings[0].llmMaxTokens,
  };

  if (!llmClient) {
    llmClient = new LMStudioClient(config);
  } else {
    llmClient.updateConfig(config);
  }

  return llmClient;
}

async function getScreeningService(): Promise<ScreeningAnswerService> {
  const client = await getLLMClient();

  if (!screeningService) {
    screeningService = new ScreeningAnswerService(client);
  }

  return screeningService;
}

// Test connection
router.get('/test', async (req, res) => {
  try {
    const client = await getLLMClient();
    const connected = await client.testConnection();
    res.json({ connected });
  } catch (error) {
    res.json({ connected: false, error: String(error) });
  }
});

// Get available models
router.get('/models', async (req, res) => {
  try {
    const client = await getLLMClient();
    const models = await client.getModels();
    res.json({ models });
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({ error: 'Failed to get models. Is LMStudio running?' });
  }
});

// Chat completion
router.post('/chat', async (req, res) => {
  try {
    const { messages, temperature, maxTokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }

    const client = await getLLMClient();
    const response = await client.chatCompletion(messages, {
      temperature,
      max_tokens: maxTokens,
    });

    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Answer screening question
router.post('/answer-screening', async (req, res) => {
  try {
    const { question, questionType, options, jobTitle, jobCompany, jobDescription } = req.body;

    if (!question || !jobTitle || !jobCompany) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get profile
    const db = getDb();
    const profiles = await db.select().from(schema.profiles).limit(1);

    if (profiles.length === 0) {
      return res.status(400).json({ error: 'Profile not set up' });
    }

    const profile = profiles[0];
    const parsedProfile: UserProfile = {
      ...profile,
      skills: JSON.parse(profile.skills),
      education: JSON.parse(profile.education),
      preferredTitles: JSON.parse(profile.preferredTitles),
      preferredLocations: JSON.parse(profile.preferredLocations),
      keywords: JSON.parse(profile.keywords),
    };

    const service = await getScreeningService();
    service.setProfile(parsedProfile);

    const answer = await service.answerQuestion({
      question,
      questionType: questionType || 'text',
      options,
      jobTitle,
      jobCompany,
      jobDescription,
    });

    res.json(answer);
  } catch (error) {
    console.error('Screening answer error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Generate text
router.post('/generate', async (req, res) => {
  try {
    const { prompt, systemPrompt, temperature, maxTokens } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt required' });
    }

    const client = await getLLMClient();

    let text: string;
    if (systemPrompt) {
      text = await client.generateWithSystemPrompt(systemPrompt, prompt, {
        temperature,
        max_tokens: maxTokens,
      });
    } else {
      text = await client.generateText(prompt, {
        temperature,
        max_tokens: maxTokens,
      });
    }

    res.json({ text });
  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ error: String(error) });
  }
});

export { router as llmRoutes };
