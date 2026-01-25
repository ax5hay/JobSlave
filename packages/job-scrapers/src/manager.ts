import type { Job, JobSearchParams, JobSearchResult, UserProfile, ScreeningQuestion } from '@jobslave/shared';
import { delay } from '@jobslave/shared';
import { ScreeningAnswerService, LMStudioClient } from '@jobslave/llm-client';
import { BaseScraper } from './base/scraper';
import { NaukriScraper } from './naukri/scraper';
import type { ScraperConfig, ScraperEvents, ApplyResult } from './base/types';

export interface JobScraperManagerConfig extends Partial<ScraperConfig> {
  delayBetweenApplications: number;
  maxApplicationsPerSession: number;
}

export interface JobScraperManagerEvents extends ScraperEvents {
  onQueueProgress?: (current: number, total: number) => void;
  onSessionComplete?: (applied: number, failed: number) => void;
}

export class JobScraperManager {
  private scrapers: Map<string, BaseScraper> = new Map();
  private llmClient: LMStudioClient;
  private screeningService: ScreeningAnswerService;
  private config: JobScraperManagerConfig;
  private events: JobScraperManagerEvents;
  private profile: UserProfile | null = null;
  private isRunning = false;
  private shouldStop = false;

  constructor(
    llmClient: LMStudioClient,
    config?: Partial<JobScraperManagerConfig>,
    events?: JobScraperManagerEvents
  ) {
    this.llmClient = llmClient;
    this.screeningService = new ScreeningAnswerService(llmClient);
    this.config = {
      headless: false,
      delayBetweenApplications: 5000,
      maxApplicationsPerSession: 50,
      timeout: 30000,
      userDataDir: './data/browser',
      ...config,
    };
    this.events = events || {};

    // Initialize scrapers
    this.initializeScrapers();
  }

  private initializeScrapers(): void {
    const naukriScraper = new NaukriScraper(this.config, this.events);
    this.scrapers.set('naukri', naukriScraper);

    // Add more scrapers here as needed
    // this.scrapers.set('indeed', new IndeedScraper(this.config, this.events));
  }

  setProfile(profile: UserProfile): void {
    this.profile = profile;
    this.screeningService.setProfile(profile);
    this.scrapers.forEach(scraper => scraper.setProfile(profile));
  }

  getScraper(source: string): BaseScraper | undefined {
    return this.scrapers.get(source);
  }

  async initialize(source: string = 'naukri'): Promise<void> {
    const scraper = this.scrapers.get(source);
    if (!scraper) {
      throw new Error(`Unknown source: ${source}`);
    }
    await scraper.initialize();
  }

  async close(source?: string): Promise<void> {
    if (source) {
      const scraper = this.scrapers.get(source);
      if (scraper) await scraper.close();
    } else {
      for (const scraper of this.scrapers.values()) {
        await scraper.close();
      }
    }
  }

  async checkLogin(source: string = 'naukri'): Promise<boolean> {
    const scraper = this.scrapers.get(source);
    if (!scraper) throw new Error(`Unknown source: ${source}`);
    return scraper.checkLoginStatus();
  }

  async initiateLogin(source: string = 'naukri'): Promise<void> {
    const scraper = this.scrapers.get(source);
    if (!scraper) throw new Error(`Unknown source: ${source}`);
    await scraper.openLoginPage();
  }

  async waitForLogin(source: string = 'naukri', timeoutMs?: number): Promise<boolean> {
    const scraper = this.scrapers.get(source);
    if (!scraper) throw new Error(`Unknown source: ${source}`);
    return scraper.waitForManualLogin(timeoutMs);
  }

  async searchJobs(source: string, params: JobSearchParams): Promise<JobSearchResult> {
    const scraper = this.scrapers.get(source);
    if (!scraper) throw new Error(`Unknown source: ${source}`);
    return scraper.searchJobs(params);
  }

  async applyToJob(source: string, job: Job): Promise<ApplyResult> {
    if (!this.profile) {
      throw new Error('Profile not set. Call setProfile() first.');
    }

    const scraper = this.scrapers.get(source);
    if (!scraper) throw new Error(`Unknown source: ${source}`);

    // First attempt to apply
    let result = await scraper.applyToJob(job);

    // Handle screening questions if present
    if (!result.success && result.screeningQuestions && result.screeningQuestions.length > 0) {
      this.events.onLog?.('info', `Answering ${result.screeningQuestions.length} screening questions...`);

      for (const question of result.screeningQuestions) {
        try {
          const answerResponse = await this.screeningService.answerQuestion({
            question: question.question,
            questionType: question.type,
            options: question.options,
            jobTitle: job.title,
            jobCompany: job.company,
            jobDescription: job.description,
          });

          this.events.onLog?.('info', `Q: ${question.question}`);
          this.events.onLog?.('info', `A: ${answerResponse.answer}`);

          await scraper.fillScreeningAnswer(question.id, answerResponse.answer);
          question.answer = answerResponse.answer;
        } catch (error) {
          this.events.onLog?.('error', `Failed to answer question: ${error}`);
        }
      }

      // Submit after answering questions
      const submitSuccess = await scraper.submitApplication();
      result = {
        success: submitSuccess,
        screeningQuestions: result.screeningQuestions,
      };
    }

    return result;
  }

  async processJobQueue(
    source: string,
    jobs: Job[],
    onProgress?: (job: Job, index: number, result: ApplyResult) => void
  ): Promise<{ applied: number; failed: number; skipped: number }> {
    this.isRunning = true;
    this.shouldStop = false;

    let applied = 0;
    let failed = 0;
    let skipped = 0;

    const maxApplications = Math.min(jobs.length, this.config.maxApplicationsPerSession);

    for (let i = 0; i < maxApplications && !this.shouldStop; i++) {
      const job = jobs[i];
      this.events.onQueueProgress?.(i + 1, maxApplications);

      try {
        const result = await this.applyToJob(source, job);

        if (result.success) {
          applied++;
        } else if (result.alreadyApplied) {
          skipped++;
        } else {
          failed++;
        }

        onProgress?.(job, i, result);
      } catch (error) {
        failed++;
        this.events.onError?.(error as Error, job);
      }

      // Delay between applications
      if (i < maxApplications - 1 && !this.shouldStop) {
        await delay(this.config.delayBetweenApplications);
      }
    }

    this.isRunning = false;
    this.events.onSessionComplete?.(applied, failed);

    return { applied, failed, skipped };
  }

  stop(): void {
    this.shouldStop = true;
    this.events.onLog?.('info', 'Stopping job queue...');
  }

  getStatus(): { isRunning: boolean; scraperStates: Record<string, any> } {
    const scraperStates: Record<string, any> = {};
    this.scrapers.forEach((scraper, source) => {
      scraperStates[source] = scraper.getState();
    });

    return {
      isRunning: this.isRunning,
      scraperStates,
    };
  }
}
