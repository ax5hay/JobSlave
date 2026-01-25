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
  get: () => fetchApi('/profile'),
  save: (data: any) => fetchApi('/profile', { method: 'POST', body: JSON.stringify(data) }),
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
  list: (page = 1, limit = 20) => fetchApi(`/jobs?page=${page}&limit=${limit}`),
  save: (jobs: any[]) => fetchApi('/jobs/save', { method: 'POST', body: JSON.stringify({ jobs }) }),
  queue: (jobIds: string[]) => fetchApi('/jobs/queue', { method: 'POST', body: JSON.stringify({ jobIds }) }),
  getQueue: (status?: string) => fetchApi(`/jobs/queue${status ? `?status=${status}` : ''}`),
  updateApplication: (id: string, data: any) =>
    fetchApi(`/jobs/queue/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeFromQueue: (id: string) => fetchApi(`/jobs/queue/${id}`, { method: 'DELETE' }),
  getStats: () => fetchApi('/jobs/stats'),
};

// LLM API
export const llmApi = {
  testConnection: () => fetchApi('/llm/test'),
  getModels: () => fetchApi<{ models: any[] }>('/llm/models'),
  chat: (messages: any[], temperature?: number, maxTokens?: number) =>
    fetchApi('/llm/chat', { method: 'POST', body: JSON.stringify({ messages, temperature, maxTokens }) }),
  answerScreening: (data: any) =>
    fetchApi('/llm/answer-screening', { method: 'POST', body: JSON.stringify(data) }),
};

// Automation API
export const automationApi = {
  init: (source = 'naukri') =>
    fetchApi('/automation/init', { method: 'POST', body: JSON.stringify({ source }) }),
  close: (source?: string) =>
    fetchApi('/automation/close', { method: 'POST', body: JSON.stringify({ source }) }),
  getLoginStatus: (source = 'naukri') => fetchApi(`/automation/login-status/${source}`),
  openLogin: (source = 'naukri') =>
    fetchApi('/automation/login', { method: 'POST', body: JSON.stringify({ source }) }),
  waitForLogin: (source = 'naukri', timeout = 300000) =>
    fetchApi('/automation/wait-for-login', { method: 'POST', body: JSON.stringify({ source, timeout }) }),
  search: (source: string, params: any) =>
    fetchApi('/automation/search', { method: 'POST', body: JSON.stringify({ source, ...params }) }),
  apply: (source: string, job: any) =>
    fetchApi('/automation/apply', { method: 'POST', body: JSON.stringify({ source, job }) }),
  processQueue: (source = 'naukri') =>
    fetchApi('/automation/process-queue', { method: 'POST', body: JSON.stringify({ source }) }),
  stop: () => fetchApi('/automation/stop', { method: 'POST' }),
  getStatus: () => fetchApi('/automation/status'),
};

// Settings API
export const settingsApi = {
  get: () => fetchApi('/settings'),
  update: (data: any) => fetchApi('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  clearSession: (source: string) => fetchApi(`/settings/session/${source}`, { method: 'DELETE' }),
};
