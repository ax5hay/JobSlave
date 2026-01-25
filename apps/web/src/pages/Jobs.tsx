import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, CheckSquare, Square, MapPin, Briefcase, Building2, ExternalLink, Sparkles, AlertCircle } from 'lucide-react';
import { automationApi, jobsApi, profileApi } from '@/lib/api';
import { useAutomationStore } from '@/stores/useAutomationStore';
import type { Job } from '@jobslave/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Jobs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isInitialized, isLoggedIn } = useAutomationStore();

  const [searchParams, setSearchParams] = useState({
    keywords: '',
    locations: '',
    experienceMin: '',
    experienceMax: '',
  });

  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [searchResults, setSearchResults] = useState<Job[]>([]);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: profileApi.get,
  });

  const { data: savedJobsData } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.list(),
  });

  const searchMutation = useMutation({
    mutationFn: async () => {
      const keywords = searchParams.keywords.split(',').map((k) => k.trim()).filter(Boolean);
      const locations = searchParams.locations.split(',').map((l) => l.trim()).filter(Boolean);

      if (keywords.length === 0) throw new Error('Please enter at least one keyword');
      if (locations.length === 0) throw new Error('Please enter at least one location');

      return automationApi.search('naukri', {
        keywords,
        locations,
        experienceMin: searchParams.experienceMin ? parseInt(searchParams.experienceMin) : undefined,
        experienceMax: searchParams.experienceMax ? parseInt(searchParams.experienceMax) : undefined,
      });
    },
    onSuccess: (data: any) => {
      setSearchResults(data.jobs);
      toast({ title: `Found ${data.jobs.length} jobs` });
    },
    onError: (error: Error) => toast({ title: 'Search failed', description: error.message, variant: 'destructive' }),
  });

  const queueMutation = useMutation({
    mutationFn: async (jobIds: string[]) => {
      const jobsToSave = searchResults.filter((j) => jobIds.includes(j.id));
      await jobsApi.save(jobsToSave);
      return jobsApi.queue(jobIds);
    },
    onSuccess: (data: any) => {
      toast({ title: `Added ${data.queued} jobs to queue` });
      setSelectedJobs(new Set());
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedJobs.size === searchResults.length) setSelectedJobs(new Set());
    else setSelectedJobs(new Set(searchResults.map((j) => j.id)));
  };

  const handleSearch = () => {
    if (!isInitialized || !isLoggedIn) {
      toast({ title: 'Not ready', description: 'Please initialize browser and login first', variant: 'destructive' });
      return;
    }
    searchMutation.mutate();
  };

  const handleQueueSelected = () => {
    if (selectedJobs.size === 0) {
      toast({ title: 'No jobs selected', variant: 'destructive' });
      return;
    }
    queueMutation.mutate(Array.from(selectedJobs));
  };

  const fillFromProfile = () => {
    if (profile) {
      setSearchParams({
        ...searchParams,
        keywords: profile.keywords?.join(', ') || '',
        locations: profile.preferredLocations?.join(', ') || '',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search Jobs</h1>
        <p className="text-muted-foreground mt-1">Find and queue jobs for auto-application</p>
      </div>

      {/* Search Form */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-primary/10">
            <Search className="w-4 h-4 text-primary" />
          </div>
          <h2 className="font-semibold">Search Naukri.com</h2>
        </div>

        {(!isInitialized || !isLoggedIn) && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mb-5">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Please go to Dashboard, start the browser, and login to Naukri first.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div className="space-y-2">
            <Label>Keywords *</Label>
            <Input
              placeholder="e.g., React, Node.js, Frontend"
              value={searchParams.keywords}
              onChange={(e) => setSearchParams({ ...searchParams, keywords: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Comma separated</p>
          </div>
          <div className="space-y-2">
            <Label>Locations *</Label>
            <Input
              placeholder="e.g., Bangalore, Mumbai, Remote"
              value={searchParams.locations}
              onChange={(e) => setSearchParams({ ...searchParams, locations: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Comma separated</p>
          </div>
          <div className="space-y-2">
            <Label>Min Experience (years)</Label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={searchParams.experienceMin}
              onChange={(e) => setSearchParams({ ...searchParams, experienceMin: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Max Experience (years)</Label>
            <Input
              type="number"
              min="0"
              placeholder="30"
              value={searchParams.experienceMax}
              onChange={(e) => setSearchParams({ ...searchParams, experienceMax: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleSearch}
            disabled={searchMutation.isPending || !isInitialized || !isLoggedIn}
            className="gap-2"
          >
            <Search className="w-4 h-4" />
            {searchMutation.isPending ? 'Searching...' : 'Search Jobs'}
          </Button>
          {profile && (
            <Button variant="outline" onClick={fillFromProfile} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Fill from Profile
            </Button>
          )}
        </div>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <h2 className="font-semibold">Search Results ({searchResults.length})</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={toggleSelectAll} className="gap-1.5">
                {selectedJobs.size === searchResults.length ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {selectedJobs.size === searchResults.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Button
                size="sm"
                onClick={handleQueueSelected}
                disabled={selectedJobs.size === 0 || queueMutation.isPending}
                className="gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add to Queue ({selectedJobs.size})
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[500px]">
            <div className="p-4 space-y-3">
              {searchResults.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  selected={selectedJobs.has(job.id)}
                  onToggle={() => toggleJobSelection(job.id)}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Saved Jobs */}
      {savedJobsData?.jobs && savedJobsData.jobs.length > 0 && searchResults.length === 0 && (
        <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <h2 className="font-semibold">Previously Found Jobs ({savedJobsData.jobs.length})</h2>
          </div>
          <ScrollArea className="h-[400px]">
            <div className="p-4 space-y-3">
              {savedJobsData.jobs.slice(0, 20).map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

function JobCard({
  job,
  selected,
  onToggle,
}: {
  job: Job;
  selected?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all hover-lift',
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border/50 hover:border-border'
      )}
    >
      <div className="flex gap-4">
        {onToggle && (
          <button onClick={onToggle} className="shrink-0 mt-1">
            {selected ? (
              <CheckSquare className="w-5 h-5 text-primary" />
            ) : (
              <Square className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{job.title}</h3>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              {job.company}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {job.location}
            </span>
            {job.experienceRange && (
              <span className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                {job.experienceRange.min}-{job.experienceRange.max} yrs
              </span>
            )}
          </div>

          {job.description && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{job.description}</p>
          )}

          {job.skills && job.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {(Array.isArray(job.skills) ? job.skills : []).slice(0, 5).map((skill: string, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <a
          href={job.jobUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="View job posting"
          className="shrink-0 text-primary hover:text-primary/80 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
