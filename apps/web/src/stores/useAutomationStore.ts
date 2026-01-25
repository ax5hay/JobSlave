import { create } from 'zustand';
import type { Job } from '@jobslave/shared';

interface AutomationLog {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

interface AutomationState {
  isInitialized: boolean;
  isRunning: boolean;
  isLoggedIn: boolean;
  currentJob: Job | null;
  logs: AutomationLog[];
  progress: { current: number; total: number } | null;

  // Actions
  setInitialized: (value: boolean) => void;
  setRunning: (value: boolean) => void;
  setLoggedIn: (value: boolean) => void;
  setCurrentJob: (job: Job | null) => void;
  addLog: (log: AutomationLog) => void;
  clearLogs: () => void;
  setProgress: (progress: { current: number; total: number } | null) => void;
}

export const useAutomationStore = create<AutomationState>((set) => ({
  isInitialized: false,
  isRunning: false,
  isLoggedIn: false,
  currentJob: null,
  logs: [],
  progress: null,

  setInitialized: (value) => set({ isInitialized: value }),
  setRunning: (value) => set({ isRunning: value }),
  setLoggedIn: (value) => set({ isLoggedIn: value }),
  setCurrentJob: (job) => set({ currentJob: job }),
  addLog: (log) => set((state) => ({ logs: [...state.logs.slice(-99), log] })),
  clearLogs: () => set({ logs: [] }),
  setProgress: (progress) => set({ progress }),
}));
