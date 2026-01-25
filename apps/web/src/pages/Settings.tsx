import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RefreshCw, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsApi, llmApi } from '@/lib/api';
import type { AppSettings } from '@jobslave/shared';

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });

  const { data: modelsData, refetch: refetchModels, isLoading: loadingModels } = useQuery({
    queryKey: ['models'],
    queryFn: llmApi.getModels,
    enabled: false,
  });

  const [formData, setFormData] = useState<Partial<AppSettings>>({
    llm: {
      baseUrl: 'http://localhost:1234',
      selectedModel: '',
      temperature: 0.7,
      maxTokens: 1024,
    },
    automation: {
      delayBetweenApplications: 5000,
      maxApplicationsPerSession: 50,
      headless: false,
      retryOnFailure: true,
      maxRetries: 3,
    },
    notifications: {
      soundEnabled: true,
      desktopNotifications: true,
    },
  });

  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings saved');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const clearSessionMutation = useMutation({
    mutationFn: settingsApi.clearSession,
    onSuccess: (_, source) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success(`${source} session cleared`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const testConnection = async () => {
    try {
      const result = await llmApi.testConnection() as { connected: boolean };
      setConnectionStatus(result.connected ? 'connected' : 'disconnected');
      if (result.connected) {
        toast.success('Connected to LMStudio');
        refetchModels();
      } else {
        toast.error('Cannot connect to LMStudio');
      }
    } catch {
      setConnectionStatus('disconnected');
      toast.error('Cannot connect to LMStudio');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* LLM Settings */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">LLM Configuration (LMStudio)</h2>

            <div className="space-y-4">
              <div>
                <label className="label">LMStudio URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    className="input flex-1"
                    value={formData.llm?.baseUrl}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        llm: { ...formData.llm!, baseUrl: e.target.value },
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={testConnection}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Test
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {connectionStatus === 'connected' && (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      Connected
                    </span>
                  )}
                  {connectionStatus === 'disconnected' && (
                    <span className="flex items-center gap-1 text-red-600 text-sm">
                      <XCircle className="w-4 h-4" />
                      Not connected
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="label">Model</label>
                <select
                  className="input"
                  value={formData.llm?.selectedModel}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      llm: { ...formData.llm!, selectedModel: e.target.value },
                    })
                  }
                >
                  <option value="">Select a model</option>
                  {modelsData?.models?.map((model: any) => (
                    <option key={model.id} value={model.id}>
                      {model.id}
                    </option>
                  ))}
                </select>
                {!modelsData?.models?.length && (
                  <p className="text-sm text-gray-500 mt-1">
                    Test connection to load available models
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Temperature</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.llm?.temperature}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        llm: { ...formData.llm!, temperature: parseFloat(e.target.value) },
                      })
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">0 = deterministic, 2 = creative</p>
                </div>
                <div>
                  <label className="label">Max Tokens</label>
                  <input
                    type="number"
                    className="input"
                    min="100"
                    max="8192"
                    step="100"
                    value={formData.llm?.maxTokens}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        llm: { ...formData.llm!, maxTokens: parseInt(e.target.value) },
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Automation Settings */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Automation Settings</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Delay Between Applications (ms)</label>
                  <input
                    type="number"
                    className="input"
                    min="1000"
                    max="60000"
                    step="1000"
                    value={formData.automation?.delayBetweenApplications}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        automation: {
                          ...formData.automation!,
                          delayBetweenApplications: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {(formData.automation?.delayBetweenApplications || 5000) / 1000} seconds
                  </p>
                </div>
                <div>
                  <label className="label">Max Applications Per Session</label>
                  <input
                    type="number"
                    className="input"
                    min="1"
                    max="200"
                    value={formData.automation?.maxApplicationsPerSession}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        automation: {
                          ...formData.automation!,
                          maxApplicationsPerSession: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Max Retries</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    max="10"
                    value={formData.automation?.maxRetries}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        automation: {
                          ...formData.automation!,
                          maxRetries: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!formData.automation?.headless}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        automation: { ...formData.automation!, headless: !e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Show Browser Window (recommended)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.automation?.retryOnFailure}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        automation: { ...formData.automation!, retryOnFailure: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Retry on Failure
                </label>
              </div>
            </div>
          </div>

          {/* Session Management */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Session Management</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-medium">Naukri.com Session</h3>
                  <p className="text-sm text-gray-500">
                    {settings?.credentials?.naukri?.sessionSaved
                      ? `Logged in as ${settings.credentials.naukri.email}`
                      : 'No saved session'}
                  </p>
                </div>
                {settings?.credentials?.naukri?.sessionSaved && (
                  <button
                    type="button"
                    onClick={() => clearSessionMutation.mutate('naukri')}
                    className="btn-danger flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear Session
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Notifications</h2>

            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.notifications?.soundEnabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      notifications: { ...formData.notifications!, soundEnabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Sound Notifications
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.notifications?.desktopNotifications}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      notifications: {
                        ...formData.notifications!,
                        desktopNotifications: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Desktop Notifications
              </label>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
