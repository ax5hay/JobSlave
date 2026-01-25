import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  LogIn,
  Monitor,
  Activity,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { jobsApi, automationApi, profileApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAutomationStore } from '@/stores/useAutomationStore';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    isInitialized,
    isRunning,
    isLoggedIn,
    logs,
    progress,
    setInitialized,
    setRunning,
    setLoggedIn,
    addLog,
    setProgress,
  } = useAutomationStore();

  const [waitingForLogin, setWaitingForLogin] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: jobsApi.getStats,
    refetchInterval: 5000,
  });

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: profileApi.get,
  });

  const initMutation = useMutation({
    mutationFn: () => automationApi.init('naukri'),
    onSuccess: () => {
      setInitialized(true);
      toast({ title: 'Browser initialized', description: 'Naukri.com is ready' });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const closeMutation = useMutation({
    mutationFn: () => automationApi.close('naukri'),
    onSuccess: () => {
      setInitialized(false);
      setLoggedIn(false);
      toast({ title: 'Browser closed' });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const loginMutation = useMutation({
    mutationFn: () => automationApi.openLogin('naukri'),
    onSuccess: () => {
      setWaitingForLogin(true);
      toast({ title: 'Login page opened', description: 'Please log in manually in the browser' });
      automationApi.waitForLogin('naukri', 300000).then((result: any) => {
        setWaitingForLogin(false);
        if (result.success) {
          setLoggedIn(true);
          toast({ title: 'Login successful!' });
        } else {
          toast({ title: 'Login timeout', variant: 'destructive' });
        }
      });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const processQueueMutation = useMutation({
    mutationFn: () => automationApi.processQueue('naukri'),
    onSuccess: () => {
      setRunning(true);
      toast({ title: 'Started processing queue' });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const stopMutation = useMutation({
    mutationFn: automationApi.stop,
    onSuccess: () => {
      setRunning(false);
      toast({ title: 'Processing stopped' });
    },
  });

  useEffect(() => {
    const socket = getSocket();

    socket.on('automation:log', (log) => addLog(log));
    socket.on('automation:progress', (data) => setProgress(data));
    socket.on('automation:applied', ({ job, success }) => {
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      if (success) {
        toast({ title: `Applied to ${job.title}` });
      }
    });
    socket.on('automation:complete', ({ applied, failed }) => {
      setRunning(false);
      setProgress(null);
      toast({ title: 'Queue processed', description: `${applied} applied, ${failed} failed` });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    });

    return () => {
      socket.off('automation:log');
      socket.off('automation:progress');
      socket.off('automation:applied');
      socket.off('automation:complete');
    };
  }, []);

  const hasProfile = !!profile;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Monitor and control your job applications</p>
      </div>

      {/* Profile Warning */}
      {!hasProfile && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Please set up your profile first to enable auto-applications.
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="In Queue"
          value={stats?.queued || 0}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="Applied Today"
          value={stats?.todayApplied || 0}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          title="This Week"
          value={stats?.weekApplied || 0}
          icon={Zap}
          variant="primary"
        />
        <StatCard
          title="Failed"
          value={stats?.failed || 0}
          icon={XCircle}
          variant="destructive"
        />
      </div>

      {/* Control Panel */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Automation Control</h2>
            <p className="text-sm text-muted-foreground">Manage browser and application queue</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill label="Browser" active={isInitialized} />
            <StatusPill label="Logged In" active={isLoggedIn} />
            <StatusPill label="Running" active={isRunning} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {!isInitialized ? (
            <Button
              onClick={() => initMutation.mutate()}
              disabled={initMutation.isPending || !hasProfile}
              className="gap-2"
            >
              <Monitor className="w-4 h-4" />
              {initMutation.isPending ? 'Starting...' : 'Start Browser'}
            </Button>
          ) : (
            <>
              {!isLoggedIn ? (
                <Button
                  onClick={() => loginMutation.mutate()}
                  disabled={loginMutation.isPending || waitingForLogin}
                  className="gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  {waitingForLogin ? 'Waiting for login...' : 'Login to Naukri'}
                </Button>
              ) : (
                <>
                  {!isRunning ? (
                    <Button
                      onClick={() => processQueueMutation.mutate()}
                      disabled={processQueueMutation.isPending || stats?.queued === 0}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Play className="w-4 h-4" />
                      Process Queue ({stats?.queued || 0})
                    </Button>
                  ) : (
                    <Button
                      onClick={() => stopMutation.mutate()}
                      disabled={stopMutation.isPending}
                      variant="destructive"
                      className="gap-2"
                    >
                      <Square className="w-4 h-4" />
                      Stop
                    </Button>
                  )}
                </>
              )}

              <Button
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending || isRunning}
                variant="outline"
                className="gap-2"
              >
                Close Browser
              </Button>
            </>
          )}
        </div>

        {/* Progress */}
        {progress && (
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress.current} / {progress.total}</span>
            </div>
            <Progress value={(progress.current / progress.total) * 100} className="h-2" />
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold">Activity Log</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => useAutomationStore.getState().clearLogs()}
            className="text-muted-foreground hover:text-foreground gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </Button>
        </div>

        <ScrollArea className="h-64">
          <div className="p-4 font-mono text-sm bg-slate-950 dark:bg-black/50">
            {logs.length === 0 ? (
              <p className="text-slate-500">No activity yet...</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex gap-3',
                      log.level === 'info' && 'text-slate-300',
                      log.level === 'warn' && 'text-amber-400',
                      log.level === 'error' && 'text-red-400'
                    )}
                  >
                    <span className="text-slate-600 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  variant,
}: {
  title: string;
  value: number;
  icon: any;
  variant: 'primary' | 'success' | 'warning' | 'destructive';
}) {
  const variants = {
    primary: 'from-blue-500/10 to-blue-600/5 border-blue-200/50 dark:border-blue-800/50',
    success: 'from-emerald-500/10 to-emerald-600/5 border-emerald-200/50 dark:border-emerald-800/50',
    warning: 'from-amber-500/10 to-amber-600/5 border-amber-200/50 dark:border-amber-800/50',
    destructive: 'from-red-500/10 to-red-600/5 border-red-200/50 dark:border-red-800/50',
  };

  const iconColors = {
    primary: 'text-blue-600 dark:text-blue-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    destructive: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className={cn(
      'rounded-xl border bg-gradient-to-br p-4 hover-lift',
      variants[variant]
    )}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <div className={cn('p-2.5 rounded-lg bg-white/50 dark:bg-white/10', iconColors[variant])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <Badge
      variant={active ? 'default' : 'secondary'}
      className={cn(
        'gap-1.5 font-normal',
        active && 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400'
      )}
    >
      <span className={cn(
        'w-1.5 h-1.5 rounded-full',
        active ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/50'
      )} />
      {label}
    </Badge>
  );
}
