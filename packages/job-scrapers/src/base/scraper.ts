import { Browser, BrowserContext, Page, chromium } from 'playwright';
import type { Job, JobSearchParams, JobSearchResult, UserProfile, ScreeningQuestion } from '@jobslave/shared';
import { delay } from '@jobslave/shared';
import type { ScraperConfig, ScraperEvents, ScraperState, ApplyResult } from './types';

export abstract class BaseScraper {
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;
  protected page: Page | null = null;
  protected config: ScraperConfig;
  protected events: ScraperEvents;
  protected profile: UserProfile | null = null;
  protected state: ScraperState = {
    isLoggedIn: false,
    isRunning: false,
    currentJob: null,
    appliedCount: 0,
    failedCount: 0,
  };

  abstract readonly source: string;
  abstract readonly baseUrl: string;
  abstract readonly loginUrl: string;

  constructor(config: Partial<ScraperConfig> = {}, events: ScraperEvents = {}) {
    this.config = {
      headless: false, // Visible by default
      slowMo: 100,
      userDataDir: './data/browser',
      timeout: 30000,
      ...config,
    };
    this.events = events;
  }

  setProfile(profile: UserProfile): void {
    this.profile = profile;
  }

  getState(): ScraperState {
    return { ...this.state };
  }

  protected log(level: 'info' | 'warn' | 'error', message: string): void {
    this.events.onLog?.(level, `[${this.source}] ${message}`);
    console[level](`[${this.source}] ${message}`);
  }

  async initialize(): Promise<void> {
    this.log('info', 'Initializing browser...');

    this.browser = await chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo,
    });

    this.context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });

    // Try to restore session cookies
    await this.loadSession();

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.config.timeout);

    // Navigate to the base URL on initialization
    await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded' });

    this.log('info', 'Browser initialized');
  }

  async close(): Promise<void> {
    this.log('info', 'Closing browser...');
    await this.saveSession();

    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();

    this.page = null;
    this.context = null;
    this.browser = null;
    this.state.isRunning = false;

    this.log('info', 'Browser closed');
  }

  protected async loadSession(): Promise<void> {
    // Will be implemented to load cookies from storage
    // This enables "login once" functionality
  }

  protected async saveSession(): Promise<void> {
    // Will be implemented to save cookies to storage
  }

  // Abstract methods to be implemented by each job site scraper
  abstract checkLoginStatus(): Promise<boolean>;
  abstract openLoginPage(): Promise<void>;
  abstract waitForManualLogin(timeoutMs?: number): Promise<boolean>;
  abstract searchJobs(params: JobSearchParams): Promise<JobSearchResult>;
  abstract getJobDetails(jobId: string): Promise<Job | null>;
  abstract applyToJob(job: Job): Promise<ApplyResult>;
  abstract getScreeningQuestions(): Promise<ScreeningQuestion[]>;
  abstract fillScreeningAnswer(questionId: string, answer: string): Promise<void>;
  abstract submitApplication(): Promise<boolean>;

  // Utility methods
  protected async waitAndClick(selector: string, options?: { timeout?: number }): Promise<void> {
    await this.page!.waitForSelector(selector, { timeout: options?.timeout || this.config.timeout });
    await this.page!.click(selector);
  }

  protected async waitAndFill(selector: string, value: string): Promise<void> {
    await this.page!.waitForSelector(selector);
    await this.page!.fill(selector, value);
  }

  protected async safeClick(selector: string): Promise<boolean> {
    try {
      const element = await this.page!.$(selector);
      if (element) {
        await element.click();
        return true;
      }
    } catch {
      // Element not found or not clickable
    }
    return false;
  }

  protected async getText(selector: string): Promise<string | null> {
    try {
      const element = await this.page!.$(selector);
      if (element) {
        return await element.textContent();
      }
    } catch {
      // Element not found
    }
    return null;
  }

  protected async scrollToBottom(): Promise<void> {
    await this.page!.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await delay(500);
  }

  protected async scrollIntoView(selector: string): Promise<void> {
    await this.page!.evaluate((sel) => {
      const element = document.querySelector(sel);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, selector);
    await delay(300);
  }
}
