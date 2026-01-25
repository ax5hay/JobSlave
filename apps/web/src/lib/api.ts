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
