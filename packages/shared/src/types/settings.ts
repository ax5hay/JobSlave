export interface AppSettings {
  // LLM Configuration
  llm: {
    baseUrl: string;
    selectedModel: string;
    temperature: number;
    maxTokens: number;
  };

  // Automation settings
  automation: {
    delayBetweenApplications: number; // in milliseconds
    maxApplicationsPerSession: number;
    headless: boolean;
    retryOnFailure: boolean;
    maxRetries: number;
  };

  // Job site credentials (encrypted)
  credentials: {
    naukri?: {
      email: string;
      sessionSaved: boolean;
    };
    indeed?: {
      email: string;
      sessionSaved: boolean;
    };
  };

  // Notifications
  notifications: {
    soundEnabled: boolean;
    desktopNotifications: boolean;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  llm: {
    baseUrl: 'http://127.0.0.1:1234',
    selectedModel: '',
    temperature: 0.7,
    maxTokens: 1024,
  },
  automation: {
    delayBetweenApplications: 5000,
    maxApplicationsPerSession: 50,
    headless: false, // Visible by default
    retryOnFailure: true,
    maxRetries: 3,
  },
  credentials: {},
  notifications: {
    soundEnabled: true,
    desktopNotifications: true,
  },
};
