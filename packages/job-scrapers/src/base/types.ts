import type { Job, JobSearchParams, ScreeningQuestion, UserProfile } from '@jobslave/shared';

export interface ScraperConfig {
  headless: boolean;
  slowMo?: number;
  userDataDir: string;
  timeout: number;
}

export interface ScraperEvents {
  onJobFound?: (job: Job) => void;
  onApplicationStart?: (job: Job) => void;
  onApplicationComplete?: (job: Job, success: boolean) => void;
  onScreeningQuestion?: (question: ScreeningQuestion, answer: string) => void;
  onError?: (error: Error, job?: Job) => void;
  onLog?: (level: 'info' | 'warn' | 'error', message: string) => void;
}

export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface ScraperState {
  isLoggedIn: boolean;
  isRunning: boolean;
  currentJob: Job | null;
  appliedCount: number;
  failedCount: number;
}

export interface ApplyResult {
  success: boolean;
  alreadyApplied?: boolean;
  error?: string;
  screeningQuestions?: ScreeningQuestion[];
}
