import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, CheckSquare, Square, MapPin, Briefcase, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { automationApi, jobsApi, profileApi } from '@/lib/api';
import { useAutomationStore } from '@/stores/useAutomationStore';
import type { Job } from '@jobslave/shared';
import clsx from 'clsx';

export default function Jobs() {
  const queryClient = useQueryClient();
  const { isInitialized, isLoggedIn } = useAutomationStore();

  const [searchParams, setSearchParams] = useState({
    keywords: '',
    locations: '',
    experienceMin: '',
    experienceMax: '',
  });

  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [searchResults, setSearchResults] = useState<Job[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch profile for default values
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: profileApi.get,
  });

  // Fetch saved jobs
  const { data: savedJobsData } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.list(),
  });

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: async () => {
      const keywords = searchParams.keywords.split(',').map((k) => k.trim()).filter(Boolean);
      const locations = searchParams.locations.split(',').map((l) => l.trim()).filter(Boolean);

      if (keywords.length === 0) {
        throw new Error('Please enter at least one keyword');
      }
      if (locations.length === 0) {
        throw new Error('Please enter at least one location');
      }

      const params = {
        keywords,
        locations,
        experienceMin: searchParams.experienceMin ? parseInt(searchParams.experienceMin) : undefined,
        experienceMax: searchParams.experienceMax ? parseInt(searchParams.experienceMax) : undefined,
      };

      return automationApi.search('naukri', params);
    },
    onSuccess: (data: any) => {
      setSearchResults(data.jobs);
      toast.success(`Found ${data.jobs.length} jobs`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Add to queue mutation
  const queueMutation = useMutation({
    mutationFn: async (jobIds: string[]) => {
      // First save jobs to database
      const jobsToSave = searchResults.filter((j) => jobIds.includes(j.id));
      await jobsApi.save(jobsToSave);
      // Then queue them
      return jobsApi.queue(jobIds);
    },
    onSuccess: (data: any) => {
      toast.success(`Added ${data.queued} jobs to queue`);
      setSelectedJobs(new Set());
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedJobs.size === searchResults.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(searchResults.map((j) => j.id)));
    }
  };

  const handleSearch = () => {
    if (!isInitialized || !isLoggedIn) {
      toast.error('Please initialize browser and login first');
      return;
    }
    searchMutation.mutate();
  };

  const handleQueueSelected = () => {
    if (selectedJobs.size === 0) {
      toast.error('No jobs selected');
      return;
    }
    queueMutation.mutate(Array.from(selectedJobs));
  };

  // Pre-fill from profile
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
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Search Jobs</h1>

        {/* Search Form */}
        <div className="card mb-8">
          <h2 className="text-xl font-semibold mb-4">Search Naukri.com</h2>

          {!isInitialized || !isLoggedIn ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-yellow-800">
                Please go to Dashboard, start the browser, and login to Naukri first.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Keywords *</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., React, Node.js, Frontend"
                value={searchParams.keywords}
                onChange={(e) => setSearchParams({ ...searchParams, keywords: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">Comma separated</p>
            </div>
            <div>
              <label className="label">Locations *</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., Bangalore, Mumbai, Remote"
                value={searchParams.locations}
                onChange={(e) => setSearchParams({ ...searchParams, locations: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">Comma separated</p>
            </div>
            <div>
              <label className="label">Min Experience (years)</label>
              <input
                type="number"
                className="input"
                min="0"
                placeholder="0"
                value={searchParams.experienceMin}
                onChange={(e) => setSearchParams({ ...searchParams, experienceMin: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Max Experience (years)</label>
              <input
                type="number"
                className="input"
                min="0"
                placeholder="30"
                value={searchParams.experienceMax}
                onChange={(e) => setSearchParams({ ...searchParams, experienceMax: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleSearch}
              disabled={searchMutation.isPending || !isInitialized || !isLoggedIn}
              className="btn-primary flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              {searchMutation.isPending ? 'Searching...' : 'Search Jobs'}
            </button>

            {profile && (
              <button onClick={fillFromProfile} className="btn-secondary">
                Fill from Profile
              </button>
            )}
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                Search Results ({searchResults.length})
              </h2>
              <div className="flex gap-2">
                <button onClick={toggleSelectAll} className="btn-secondary flex items-center gap-2">
                  {selectedJobs.size === searchResults.length ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  {selectedJobs.size === searchResults.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={handleQueueSelected}
                  disabled={selectedJobs.size === 0 || queueMutation.isPending}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add to Queue ({selectedJobs.size})
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {searchResults.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  selected={selectedJobs.has(job.id)}
                  onToggle={() => toggleJobSelection(job.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Saved Jobs */}
        {savedJobsData && savedJobsData.jobs && savedJobsData.jobs.length > 0 && searchResults.length === 0 && (
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">
              Previously Found Jobs ({savedJobsData.jobs.length})
            </h2>
            <div className="space-y-3">
              {savedJobsData.jobs.slice(0, 20).map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          </div>
        )}
      </div>
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
      className={clsx(
        'border rounded-lg p-4 transition-colors',
        selected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
      )}
    >
      <div className="flex gap-4">
        {onToggle && (
          <button onClick={onToggle} className="flex-shrink-0 mt-1">
            {selected ? (
              <CheckSquare className="w-5 h-5 text-primary-600" />
            ) : (
              <Square className="w-5 h-5 text-gray-400" />
            )}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{job.title}</h3>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              {job.company}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {job.location}
            </span>
            {job.experienceRange && (
              <span className="flex items-center gap-1">
                <Briefcase className="w-4 h-4" />
                {job.experienceRange.min}-{job.experienceRange.max} yrs
              </span>
            )}
          </div>

          {job.description && (
            <p className="mt-2 text-sm text-gray-500 line-clamp-2">{job.description}</p>
          )}

          {job.skills && job.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {job.skills.slice(0, 5).map((skill, i) => (
                <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>

        <a
          href={job.jobUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 text-primary-600 hover:text-primary-700 text-sm"
        >
          View
        </a>
      </div>
    </div>
  );
}
