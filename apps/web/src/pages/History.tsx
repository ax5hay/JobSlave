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
} from 'lucide-react';
import { jobsApi } from '@/lib/api';
import { formatDateTime } from '@jobslave/shared';
import clsx from 'clsx';

const STATUS_CONFIG = {
  queued: { icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Queued' },
  processing: { icon: AlertCircle, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Processing' },
  applied: { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Applied' },
  failed: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Failed' },
  skipped: { icon: SkipForward, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Skipped' },
};

export default function ApplicationHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ['queue'],
    queryFn: () => jobsApi.getQueue(),
    refetchInterval: 5000,
  });

  const applications = data?.applications || [];

  // Group by status
  const grouped = {
    processing: applications.filter((a: any) => a.status === 'processing'),
    queued: applications.filter((a: any) => a.status === 'queued'),
    applied: applications.filter((a: any) => a.status === 'applied'),
    failed: applications.filter((a: any) => a.status === 'failed'),
    skipped: applications.filter((a: any) => a.status === 'skipped'),
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
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Application History</h1>

        {/* Summary Stats */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          {Object.entries(STATUS_CONFIG).map(([status, config]) => {
            const count = grouped[status as keyof typeof grouped]?.length || 0;
            return (
              <div key={status} className="card text-center">
                <div className={clsx('inline-flex p-2 rounded-lg mb-2', config.bgColor)}>
                  <config.icon className={clsx('w-5 h-5', config.color)} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-sm text-gray-500">{config.label}</p>
              </div>
            );
          })}
        </div>

        {/* Currently Processing */}
        {grouped.processing.length > 0 && (
          <Section title="Currently Processing" applications={grouped.processing} />
        )}

        {/* Queued */}
        {grouped.queued.length > 0 && (
          <Section title="In Queue" applications={grouped.queued} />
        )}

        {/* Recently Applied */}
        {grouped.applied.length > 0 && (
          <Section title="Successfully Applied" applications={grouped.applied} />
        )}

        {/* Failed */}
        {grouped.failed.length > 0 && (
          <Section title="Failed" applications={grouped.failed} />
        )}

        {/* Skipped */}
        {grouped.skipped.length > 0 && (
          <Section title="Skipped" applications={grouped.skipped} />
        )}

        {applications.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-gray-500">No applications yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Search for jobs and add them to the queue to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, applications }: { title: string; applications: any[] }) {
  return (
    <div className="card mb-6">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="space-y-3">
        {applications.map((app) => (
          <ApplicationCard key={app.id} application={app} />
        ))}
      </div>
    </div>
  );
}

function ApplicationCard({ application }: { application: any }) {
  const config = STATUS_CONFIG[application.status as keyof typeof STATUS_CONFIG];
  const job = application.job;

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', config.bgColor, config.color)}>
              <config.icon className="w-3 h-3" />
              {config.label}
            </span>
          </div>

          {job ? (
            <>
              <h3 className="font-semibold text-gray-900 mt-2 truncate">{job.title}</h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  {job.company}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {job.location}
                </span>
              </div>
            </>
          ) : (
            <p className="text-gray-500 mt-2">Job details not available</p>
          )}

          {/* Timestamps */}
          <div className="mt-2 text-xs text-gray-500 space-y-0.5">
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

          {/* Error message */}
          {application.error && (
            <p className="mt-2 text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
              {application.error}
            </p>
          )}

          {/* Screening questions */}
          {application.screeningQuestions?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Screening Questions:</p>
              <div className="space-y-1">
                {application.screeningQuestions.slice(0, 3).map((q: any, i: number) => (
                  <div key={i} className="text-xs bg-gray-50 px-2 py-1 rounded">
                    <span className="text-gray-600">Q: {q.question}</span>
                    {q.answer && (
                      <span className="text-green-600 ml-2">A: {q.answer}</span>
                    )}
                  </div>
                ))}
                {application.screeningQuestions.length > 3 && (
                  <p className="text-xs text-gray-400">
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
            className="flex-shrink-0 p-2 text-gray-400 hover:text-primary-600"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}
