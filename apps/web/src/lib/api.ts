import type { UserProfile, Job, JobApplication, ApplicationStats, AppSettings } from '@jobslave/shared';

const API_BASE = '/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Parsed resume type - matches backend ResumeParserService output
export interface ParsedResume {
  name?: string;
  email?: string;
  phone?: string;
  currentTitle?: string;
  totalExperience?: number;
  currentCompany?: string;
  skills?: Array<{ name: string; yearsOfExperience: number; proficiency: string }>;
  education?: Array<{ degree: string; institution: string; year: number; percentage?: number }>;
  preferredTitles?: string[];
  preferredLocations?: string[];
  keywords?: string[];
  currentCtc?: number;
  expectedCtc?: number;
  noticePeriod?: string;
  immediateJoiner?: boolean;
  willingToRelocate?: boolean;
  preferredWorkMode?: string;
  summary?: string;
  resumePath?: string;
  rawText?: string;
  message?: string;
}

// Progress event types for SSE
export interface ParseProgress {
  type: 'progress' | 'result' | 'error';
  stage?: 'ocr' | 'llm' | 'complete';
  progress?: number;
  message?: string;
  currentPage?: number;
  totalPages?: number;
  data?: ParsedResume;
}

// Profile API
export const profileApi = {
  get: () => fetchApi<UserProfile | null>('/profile'),
  save: (data: Partial<UserProfile>) => fetchApi<{ id: string; message: string }>('/profile', { method: 'POST', body: JSON.stringify(data) }),
  uploadResume: async (file: File) => {
    const formData = new FormData();
    formData.append('resume', file);
    const response = await fetch(`${API_BASE}/profile/resume`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  },
  deleteResume: () => fetchApi('/profile/resume', { method: 'DELETE' }),
  // Parse resume with progress callback (uses SSE)
  parseResumeWithProgress: (
    file: File,
    onProgress: (event: ParseProgress) => void
  ): Promise<ParsedResume> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('resume', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/profile/parse-resume`);
      xhr.setRequestHeader('Accept', 'text/event-stream');

      let buffer = '';

      xhr.onprogress = () => {
        const newData = xhr.responseText.substring(buffer.length);
        buffer = xhr.responseText;

        // Parse SSE events
        const lines = newData.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: ParseProgress = JSON.parse(line.substring(6));
              onProgress(event);

              if (event.type === 'result' && event.data) {
                resolve(event.data);
              } else if (event.type === 'error') {
                reject(new Error(event.message || 'Parse failed'));
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.onabort = () => reject(new Error('Request aborted'));

      xhr.onloadend = () => {
        if (xhr.status >= 400) {
          reject(new Error('Parse failed'));
        }
      };

      xhr.send(formData);
    });
  },

  // Simple parse without progress (fallback)
  parseResume: async (file: File): Promise<ParsedResume> => {
    const formData = new FormData();
    formData.append('resume', file);
    const response = await fetch(`${API_BASE}/profile/parse-resume`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Parse failed' }));
      throw new Error(error.error || 'Parse failed');
    }
    return response.json();
  },
  suggestTitles: (data: { currentTitle: string; totalExperience?: number; skills?: string[] }) =>
    fetchApi<{ titles: string[] }>('/profile/suggest-titles', { method: 'POST', body: JSON.stringify(data) }),
};

// Jobs API
export const jobsApi = {
  list: (page = 1, limit = 20) => fetchApi<{ jobs: Job[]; page: number; limit: number }>(`/jobs?page=${page}&limit=${limit}`),
  save: (jobs: Job[]) => fetchApi<{ saved: number; total: number }>('/jobs/save', { method: 'POST', body: JSON.stringify({ jobs }) }),
  queue: (jobIds: string[]) => fetchApi<{ queued: number; total: number }>('/jobs/queue', { method: 'POST', body: JSON.stringify({ jobIds }) }),
  getQueue: (status?: string) => fetchApi<{ applications: JobApplication[] }>(`/jobs/queue${status ? `?status=${status}` : ''}`),
  updateApplication: (id: string, data: Partial<JobApplication>) =>
    fetchApi(`/jobs/queue/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeFromQueue: (id: string) => fetchApi(`/jobs/queue/${id}`, { method: 'DELETE' }),
  getStats: () => fetchApi<ApplicationStats>('/jobs/stats'),
};

// LLM API
export const llmApi = {
  testConnection: () => fetchApi<{ connected: boolean }>('/llm/test'),
  getModels: () => fetchApi<{ models: { id: string; object: string }[] }>('/llm/models'),
  chat: (messages: { role: string; content: string }[], temperature?: number, maxTokens?: number) =>
    fetchApi('/llm/chat', { method: 'POST', body: JSON.stringify({ messages, temperature, maxTokens }) }),
  answerScreening: (data: {
    question: string;
    questionType: string;
    options?: string[];
    jobTitle: string;
    jobCompany: string;
    jobDescription?: string;
  }) => fetchApi('/llm/answer-screening', { method: 'POST', body: JSON.stringify(data) }),
};

// Automation API
export const automationApi = {
  init: (source = 'naukri') =>
    fetchApi<{ message: string }>('/automation/init', { method: 'POST', body: JSON.stringify({ source }) }),
  close: (source?: string) =>
    fetchApi<{ message: string }>('/automation/close', { method: 'POST', body: JSON.stringify({ source }) }),
  getLoginStatus: (source = 'naukri') => fetchApi<{ isLoggedIn: boolean; source: string }>(`/automation/login-status/${source}`),
  openLogin: (source = 'naukri') =>
    fetchApi<{ message: string }>('/automation/login', { method: 'POST', body: JSON.stringify({ source }) }),
  waitForLogin: (source = 'naukri', timeout = 300000) =>
    fetchApi<{ success: boolean; message: string }>('/automation/wait-for-login', { method: 'POST', body: JSON.stringify({ source, timeout }) }),
  search: (source: string, params: { keywords: string[]; locations: string[]; experienceMin?: number; experienceMax?: number }) =>
    fetchApi<{ jobs: Job[]; totalCount: number; page: number; hasMore: boolean }>('/automation/search', { method: 'POST', body: JSON.stringify({ source, ...params }) }),
  apply: (source: string, job: Job) =>
    fetchApi<{ success: boolean; alreadyApplied?: boolean; error?: string }>('/automation/apply', { method: 'POST', body: JSON.stringify({ source, job }) }),
  processQueue: (source = 'naukri') =>
    fetchApi<{ message: string; started?: boolean }>('/automation/process-queue', { method: 'POST', body: JSON.stringify({ source }) }),
  stop: () => fetchApi<{ message: string }>('/automation/stop', { method: 'POST' }),
  getStatus: () => fetchApi<{ initialized: boolean; isRunning?: boolean }>('/automation/status'),
};

// Settings API
export const settingsApi = {
  get: () => fetchApi<AppSettings>('/settings'),
  update: (data: Partial<AppSettings>) => fetchApi<{ message: string }>('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  clearSession: (source: string) => fetchApi<{ message: string }>(`/settings/session/${source}`, { method: 'DELETE' }),
};
