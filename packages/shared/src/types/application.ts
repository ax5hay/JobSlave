import { Job, ScreeningQuestion } from './job';

export interface JobApplication {
  id: string;
  jobId: string;
  job: Job;

  status: ApplicationStatus;

  // Application details
  appliedAt?: string;
  screeningQuestions?: ScreeningQuestion[];
  answersProvided?: Record<string, string>;

  // Tracking
  attempts: number;
  lastAttemptAt?: string;
  error?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export type ApplicationStatus =
  | 'queued'      // In queue waiting to be processed
  | 'processing'  // Currently being processed
  | 'applied'     // Successfully applied
  | 'failed'      // Failed to apply
  | 'skipped';    // Skipped (already applied, not eligible, etc.)

export interface ApplicationQueueItem {
  id: string;
  job: Job;
  status: ApplicationStatus;
  priority: number;
  addedAt: string;
}

export interface ApplicationStats {
  total: number;
  queued: number;
  processing: number;
  applied: number;
  failed: number;
  skipped: number;
  todayApplied: number;
  weekApplied: number;
}

export interface ApplicationLog {
  id: string;
  applicationId: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
}
