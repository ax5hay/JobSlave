import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RefreshCw, Trash2, CheckCircle2, XCircle, Cpu, Bot, Bell, Key } from 'lucide-react';
import { settingsApi, llmApi } from '@/lib/api';
import type { AppSettings } from '@jobslave/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });

  const { data: modelsData, refetch: refetchModels } = useQuery({
    queryKey: ['models'],
    queryFn: llmApi.getModels,
    enabled: false,
  });

  const [formData, setFormData] = useState<Partial<AppSettings>>({
    llm: {
      baseUrl: 'http://127.0.0.1:1234',
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
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: 'Settings saved' });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const clearSessionMutation = useMutation({
    mutationFn: settingsApi.clearSession,
    onSuccess: (_, source) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: `${source} session cleared` });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const testConnection = async () => {
    setTesting(true);
    try {
      const result = await llmApi.testConnection() as { connected: boolean };
      setConnectionStatus(result.connected ? 'connected' : 'disconnected');
      if (result.connected) {
        toast({ title: 'Connected to LMStudio' });
        refetchModels();
      } else {
        toast({ title: 'Connection failed', variant: 'destructive' });
      }
    } catch {
      setConnectionStatus('disconnected');
      toast({ title: 'Connection failed', variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure LLM and automation preferences</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* LLM Settings */}
        <Section icon={Cpu} title="LLM Configuration">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>LMStudio URL</Label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  className="flex-1"
                  value={formData.llm?.baseUrl}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      llm: { ...formData.llm!, baseUrl: e.target.value },
                    })
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={testConnection}
                  disabled={testing}
                  className="gap-2"
                >
                  <RefreshCw className={cn('w-4 h-4', testing && 'animate-spin')} />
                  Test
                </Button>
              </div>
              {connectionStatus !== 'unknown' && (
                <div className="flex items-center gap-2 mt-2">
                  {connectionStatus === 'connected' ? (
                    <Badge className="gap-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      Not connected
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={formData.llm?.selectedModel}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    llm: { ...formData.llm!, selectedModel: v },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {modelsData?.models?.map((model: any) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!modelsData?.models?.length && (
                <p className="text-xs text-muted-foreground">
                  Test connection to load available models
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Temperature</Label>
                  <span className="text-sm text-muted-foreground">{formData.llm?.temperature}</span>
                </div>
                <Slider
                  value={[formData.llm?.temperature || 0.7]}
                  onValueChange={([v]) =>
                    setFormData({
                      ...formData,
                      llm: { ...formData.llm!, temperature: v },
                    })
                  }
                  min={0}
                  max={2}
                  step={0.1}
                />
                <p className="text-xs text-muted-foreground">0 = deterministic, 2 = creative</p>
              </div>
              <div className="space-y-2">
                <Label>Max Tokens</Label>
                <Input
                  type="number"
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
        </Section>

        {/* Automation Settings */}
        <Section icon={Bot} title="Automation">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Delay Between Applications</Label>
                  <span className="text-sm text-muted-foreground">
                    {((formData.automation?.delayBetweenApplications || 5000) / 1000).toFixed(0)}s
                  </span>
                </div>
                <Slider
                  value={[(formData.automation?.delayBetweenApplications || 5000) / 1000]}
                  onValueChange={([v]) =>
                    setFormData({
                      ...formData,
                      automation: {
                        ...formData.automation!,
                        delayBetweenApplications: v * 1000,
                      },
                    })
                  }
                  min={1}
                  max={60}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Applications Per Session</Label>
                <Input
                  type="number"
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

            <div className="space-y-2">
              <Label>Max Retries</Label>
              <Input
                type="number"
                min="0"
                max="10"
                className="w-32"
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

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div>
                  <Label className="cursor-pointer">Show Browser Window</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Watch automation in real-time (recommended)</p>
                </div>
                <Switch
                  checked={!formData.automation?.headless}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      automation: { ...formData.automation!, headless: !checked },
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div>
                  <Label className="cursor-pointer">Retry on Failure</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Automatically retry failed applications</p>
                </div>
                <Switch
                  checked={formData.automation?.retryOnFailure}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      automation: { ...formData.automation!, retryOnFailure: checked },
                    })
                  }
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Session Management */}
        <Section icon={Key} title="Session Management">
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
            <div>
              <p className="font-medium">Naukri.com</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {settings?.credentials?.naukri?.sessionSaved
                  ? `Logged in as ${settings.credentials.naukri.email}`
                  : 'No saved session'}
              </p>
            </div>
            {settings?.credentials?.naukri?.sessionSaved && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => clearSessionMutation.mutate('naukri')}
                className="gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </Button>
            )}
          </div>
        </Section>

        {/* Notifications */}
        <Section icon={Bell} title="Notifications">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
              <Label className="cursor-pointer">Sound Notifications</Label>
              <Switch
                checked={formData.notifications?.soundEnabled}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    notifications: { ...formData.notifications!, soundEnabled: checked },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
              <Label className="cursor-pointer">Desktop Notifications</Label>
              <Switch
                checked={formData.notifications?.desktopNotifications}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    notifications: {
                      ...formData.notifications!,
                      desktopNotifications: checked,
                    },
                  })
                }
              />
            </div>
          </div>
        </Section>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={saveMutation.isPending} className="gap-2">
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}
