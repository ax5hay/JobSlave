import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  SkipForward,
  Building2,
  MapPin,
  ExternalLink,
  History,
} from 'lucide-react';
import { jobsApi } from '@/lib/api';
import { formatDateTime } from '@jobslave/shared';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  queued: { icon: Clock, variant: 'warning' as const, label: 'Queued' },
  processing: { icon: AlertCircle, variant: 'primary' as const, label: 'Processing' },
  applied: { icon: CheckCircle2, variant: 'success' as const, label: 'Applied' },
  failed: { icon: XCircle, variant: 'destructive' as const, label: 'Failed' },
  skipped: { icon: SkipForward, variant: 'secondary' as const, label: 'Skipped' },
};

export default function ApplicationHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ['queue'],
    queryFn: () => jobsApi.getQueue(),
    refetchInterval: 5000,
  });

  const applications = data?.applications || [];

  const grouped = {
    processing: applications.filter((a: any) => a.status === 'processing'),
    queued: applications.filter((a: any) => a.status === 'queued'),
    applied: applications.filter((a: any) => a.status === 'applied'),
    failed: applications.filter((a: any) => a.status === 'failed'),
    skipped: applications.filter((a: any) => a.status === 'skipped'),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Application History</h1>
        <p className="text-muted-foreground mt-1">Track all your job applications</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const count = grouped[status as keyof typeof grouped]?.length || 0;
          return (
            <StatCard key={status} config={config} count={count} />
          );
        })}
      </div>

      {/* Applications List */}
      <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border/50">
          <div className="p-2 rounded-lg bg-primary/10">
            <History className="w-4 h-4 text-primary" />
          </div>
          <h2 className="font-semibold">All Applications</h2>
          <Badge variant="secondary" className="ml-auto">{applications.length}</Badge>
        </div>

        {applications.length > 0 ? (
          <ScrollArea className="h-[500px]">
            <div className="p-4 space-y-3">
              {/* Currently Processing */}
              {grouped.processing.map((app: any) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
              {/* Queued */}
              {grouped.queued.map((app: any) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
              {/* Applied */}
              {grouped.applied.map((app: any) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
              {/* Failed */}
              {grouped.failed.map((app: any) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
              {/* Skipped */}
              {grouped.skipped.map((app: any) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="p-12 text-center">
            <p className="text-muted-foreground">No applications yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Search for jobs and add them to the queue to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ config, count }: { config: typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]; count: number }) {
  const variants = {
    warning: 'from-amber-500/10 to-amber-600/5 border-amber-200/50 dark:border-amber-800/50 text-amber-600 dark:text-amber-400',
    primary: 'from-blue-500/10 to-blue-600/5 border-blue-200/50 dark:border-blue-800/50 text-blue-600 dark:text-blue-400',
    success: 'from-emerald-500/10 to-emerald-600/5 border-emerald-200/50 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400',
    destructive: 'from-red-500/10 to-red-600/5 border-red-200/50 dark:border-red-800/50 text-red-600 dark:text-red-400',
    secondary: 'from-slate-500/10 to-slate-600/5 border-slate-200/50 dark:border-slate-800/50 text-slate-600 dark:text-slate-400',
  };

  return (
    <div className={cn(
      'rounded-xl border bg-gradient-to-br p-4 text-center hover-lift',
      variants[config.variant]
    )}>
      <div className="inline-flex p-2 rounded-lg bg-white/50 dark:bg-white/10 mb-2">
        <config.icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-foreground">{count}</p>
      <p className="text-xs text-muted-foreground">{config.label}</p>
    </div>
  );
}

function ApplicationCard({ application }: { application: any }) {
  const config = STATUS_CONFIG[application.status as keyof typeof STATUS_CONFIG];
  const job = application.job;

  const badgeVariants = {
    warning: 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
    primary: 'bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    success: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
    destructive: 'bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-slate-900/30 dark:text-slate-400',
  };

  return (
    <div className="rounded-xl border border-border/50 p-4 hover:border-border transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Badge className={cn('gap-1.5', badgeVariants[config.variant])}>
            <config.icon className="w-3 h-3" />
            {config.label}
          </Badge>

          {job ? (
            <>
              <h3 className="font-semibold mt-2 truncate">{job.title}</h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {job.company}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {job.location}
                </span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground mt-2">Job details not available</p>
          )}

          <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
            {application.appliedAt && (
              <p>Applied: {formatDateTime(application.appliedAt)}</p>
            )}
            {application.lastAttemptAt && application.status !== 'applied' && (
              <p>Last attempt: {formatDateTime(application.lastAttemptAt)}</p>
            )}
            {application.attempts > 1 && (
              <p>Attempts: {application.attempts}</p>
            )}
          </div>

          {application.error && (
            <p className="mt-2 text-sm text-destructive bg-destructive/10 px-3 py-1.5 rounded-lg">
              {application.error}
            </p>
          )}

          {application.screeningQuestions?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Screening Questions:</p>
              <div className="space-y-1">
                {application.screeningQuestions.slice(0, 3).map((q: any, i: number) => (
                  <div key={i} className="text-xs bg-secondary/50 px-2 py-1.5 rounded-lg">
                    <span className="text-muted-foreground">Q: {q.question}</span>
                    {q.answer && (
                      <span className="text-emerald-600 dark:text-emerald-400 ml-2">A: {q.answer}</span>
                    )}
                  </div>
                ))}
                {application.screeningQuestions.length > 3 && (
                  <p className="text-xs text-muted-foreground/60">
                    +{application.screeningQuestions.length - 3} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {job?.jobUrl && (
          <a
            href={job.jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="View job posting"
            className="shrink-0 p-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}
