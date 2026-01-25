import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  LogIn,
  Monitor,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { jobsApi, automationApi, profileApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAutomationStore } from '@/stores/useAutomationStore';
import clsx from 'clsx';

export default function Dashboard() {
  const queryClient = useQueryClient();
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

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: jobsApi.getStats,
    refetchInterval: 5000,
  });

  // Check if profile exists
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: profileApi.get,
  });

  // Mutations
  const initMutation = useMutation({
    mutationFn: () => automationApi.init('naukri'),
    onSuccess: () => {
      setInitialized(true);
      toast.success('Browser initialized');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const closeMutation = useMutation({
    mutationFn: () => automationApi.close('naukri'),
    onSuccess: () => {
      setInitialized(false);
      setLoggedIn(false);
      toast.success('Browser closed');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const loginMutation = useMutation({
    mutationFn: () => automationApi.openLogin('naukri'),
    onSuccess: () => {
      setWaitingForLogin(true);
      toast.success('Login page opened. Please log in manually.');
      // Start waiting for login
      automationApi.waitForLogin('naukri', 300000).then((result: any) => {
        setWaitingForLogin(false);
        if (result.success) {
          setLoggedIn(true);
          toast.success('Login successful!');
        } else {
          toast.error('Login timeout');
        }
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const processQueueMutation = useMutation({
    mutationFn: () => automationApi.processQueue('naukri'),
    onSuccess: () => {
      setRunning(true);
      toast.success('Started processing queue');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const stopMutation = useMutation({
    mutationFn: automationApi.stop,
    onSuccess: () => {
      setRunning(false);
      toast.success('Processing stopped');
    },
  });

  // Socket events
  useEffect(() => {
    const socket = getSocket();

    socket.on('automation:log', (log) => {
      addLog(log);
    });

    socket.on('automation:progress', (data) => {
      setProgress(data);
    });

    socket.on('automation:applied', ({ job, success }) => {
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      if (success) {
        toast.success(`Applied to ${job.title}`);
      }
    });

    socket.on('automation:complete', ({ applied, failed }) => {
      setRunning(false);
      setProgress(null);
      toast.success(`Completed: ${applied} applied, ${failed} failed`);
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
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

        {/* Profile Warning */}
        {!hasProfile && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800">
              Please set up your profile first to enable auto-applications.
            </p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Queued"
            value={stats?.queued || 0}
            icon={Clock}
            color="text-yellow-600"
            bgColor="bg-yellow-100"
          />
          <StatCard
            title="Applied Today"
            value={stats?.todayApplied || 0}
            icon={CheckCircle2}
            color="text-green-600"
            bgColor="bg-green-100"
          />
          <StatCard
            title="This Week"
            value={stats?.weekApplied || 0}
            icon={Zap}
            color="text-blue-600"
            bgColor="bg-blue-100"
          />
          <StatCard
            title="Failed"
            value={stats?.failed || 0}
            icon={XCircle}
            color="text-red-600"
            bgColor="bg-red-100"
          />
        </div>

        {/* Control Panel */}
        <div className="card mb-8">
          <h2 className="text-xl font-semibold mb-4">Automation Control</h2>

          <div className="flex flex-wrap gap-4">
            {!isInitialized ? (
              <button
                onClick={() => initMutation.mutate()}
                disabled={initMutation.isPending || !hasProfile}
                className="btn-primary flex items-center gap-2"
              >
                <Monitor className="w-4 h-4" />
                {initMutation.isPending ? 'Starting...' : 'Start Browser'}
              </button>
            ) : (
              <>
                {!isLoggedIn ? (
                  <button
                    onClick={() => loginMutation.mutate()}
                    disabled={loginMutation.isPending || waitingForLogin}
                    className="btn-primary flex items-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    {waitingForLogin ? 'Waiting for login...' : 'Login to Naukri'}
                  </button>
                ) : (
                  <>
                    {!isRunning ? (
                      <button
                        onClick={() => processQueueMutation.mutate()}
                        disabled={processQueueMutation.isPending || stats?.queued === 0}
                        className="btn-success flex items-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Process Queue ({stats?.queued || 0})
                      </button>
                    ) : (
                      <button
                        onClick={() => stopMutation.mutate()}
                        disabled={stopMutation.isPending}
                        className="btn-danger flex items-center gap-2"
                      >
                        <Square className="w-4 h-4" />
                        Stop
                      </button>
                    )}
                  </>
                )}

                <button
                  onClick={() => closeMutation.mutate()}
                  disabled={closeMutation.isPending || isRunning}
                  className="btn-secondary flex items-center gap-2"
                >
                  Close Browser
                </button>
              </>
            )}
          </div>

          {/* Progress */}
          {progress && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Progress</span>
                <span>
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Status Indicators */}
          <div className="flex gap-4 mt-4 text-sm">
            <StatusBadge label="Browser" active={isInitialized} />
            <StatusBadge label="Logged In" active={isLoggedIn} />
            <StatusBadge label="Running" active={isRunning} />
          </div>
        </div>

        {/* Logs */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Activity Log</h2>
            <button
              onClick={() => useAutomationStore.getState().clearLogs()}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <p className="text-gray-500">No activity yet...</p>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={clsx('mb-1', {
                    'text-gray-300': log.level === 'info',
                    'text-yellow-400': log.level === 'warn',
                    'text-red-400': log.level === 'error',
                  })}
                >
                  <span className="text-gray-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>{' '}
                  {log.message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  bgColor,
}: {
  title: string;
  value: number;
  icon: any;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-4">
        <div className={clsx('p-3 rounded-lg', bgColor)}>
          <Icon className={clsx('w-6 h-6', color)} />
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={clsx('flex items-center gap-1.5', {
        'text-green-600': active,
        'text-gray-400': !active,
      })}
    >
      <span
        className={clsx('w-2 h-2 rounded-full', {
          'bg-green-500': active,
          'bg-gray-300': !active,
        })}
      />
      {label}
    </span>
  );
}
