export interface Job {
  id: string;
  externalId: string; // ID from the job site
  source: JobSource;

  // Basic info
  title: string;
  company: string;
  location: string;
  workMode?: 'remote' | 'hybrid' | 'onsite';

  // Experience & compensation
  experienceRange?: {
    min: number;
    max: number;
  };
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
  };

  // Description
  description: string;
  requirements?: string[];
  skills?: string[];

  // URLs
  jobUrl: string;
  applyUrl?: string;

  // Metadata
  postedDate?: string;
  scrapedAt: string;

  // Matching
  matchScore?: number; // 0-100 based on profile match
  matchedKeywords?: string[];
}

export type JobSource = 'naukri' | 'indeed' | 'linkedin' | 'other';

export interface JobSearchParams {
  keywords: string[];
  locations: string[];
  experienceMin?: number;
  experienceMax?: number;
  salaryMin?: number;
  workMode?: 'remote' | 'hybrid' | 'onsite' | 'any';
  postedWithin?: '1d' | '3d' | '7d' | '15d' | '30d';
  sortBy?: 'relevance' | 'date';
  page?: number;
  limit?: number;
}

export interface JobSearchResult {
  jobs: Job[];
  totalCount: number;
  page: number;
  hasMore: boolean;
}

export interface ScreeningQuestion {
  id: string;
  question: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'radio' | 'checkbox';
  options?: string[];
  required: boolean;
  answer?: string;
}
