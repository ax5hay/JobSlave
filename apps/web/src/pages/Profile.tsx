import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Save, Upload, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { profileApi } from '@/lib/api';
import type { UserProfile, Skill, Education, NoticePeriod, WorkMode } from '@jobslave/shared';

const NOTICE_PERIODS: { value: NoticePeriod; label: string }[] = [
  { value: 'immediate', label: 'Immediate' },
  { value: '15_days', label: '15 Days' },
  { value: '30_days', label: '30 Days (1 Month)' },
  { value: '60_days', label: '60 Days (2 Months)' },
  { value: '90_days', label: '90 Days (3 Months)' },
  { value: 'more_than_90_days', label: 'More than 90 Days' },
];

const WORK_MODES: { value: WorkMode; label: string }[] = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
  { value: 'any', label: 'Any' },
];

const PROFICIENCY_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const;

export default function Profile() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: profileApi.get,
  });

  const [formData, setFormData] = useState<Partial<UserProfile>>({
    name: '',
    email: '',
    phone: '',
    currentTitle: '',
    totalExperience: 0,
    currentCompany: '',
    skills: [],
    education: [],
    preferredTitles: [],
    preferredLocations: [],
    keywords: [],
    currentCtc: undefined,
    expectedCtc: undefined,
    noticePeriod: 'immediate',
    immediateJoiner: false,
    willingToRelocate: false,
    preferredWorkMode: 'any',
  });

  useEffect(() => {
    if (profile) {
      setFormData(profile);
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: profileApi.save,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile saved');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadResumeMutation = useMutation({
    mutationFn: profileApi.uploadResume,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Resume uploaded');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteResumeMutation = useMutation({
    mutationFn: profileApi.deleteResume,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Resume deleted');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadResumeMutation.mutate(file);
    }
  };

  // Skill management
  const addSkill = () => {
    setFormData((prev) => ({
      ...prev,
      skills: [...(prev.skills || []), { name: '', yearsOfExperience: 0, proficiency: 'intermediate' }],
    }));
  };

  const removeSkill = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills?.filter((_, i) => i !== index),
    }));
  };

  const updateSkill = (index: number, field: keyof Skill, value: any) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills?.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));
  };

  // Education management
  const addEducation = () => {
    setFormData((prev) => ({
      ...prev,
      education: [...(prev.education || []), { degree: '', institution: '', year: new Date().getFullYear() }],
    }));
  };

  const removeEducation = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      education: prev.education?.filter((_, i) => i !== index),
    }));
  };

  const updateEducation = (index: number, field: keyof Education, value: any) => {
    setFormData((prev) => ({
      ...prev,
      education: prev.education?.map((e, i) => (i === index ? { ...e, [field]: value } : e)),
    }));
  };

  // Tags management
  const addTag = (field: 'preferredTitles' | 'preferredLocations' | 'keywords', value: string) => {
    if (value.trim() && !formData[field]?.includes(value.trim())) {
      setFormData((prev) => ({
        ...prev,
        [field]: [...(prev[field] || []), value.trim()],
      }));
    }
  };

  const removeTag = (field: 'preferredTitles' | 'preferredLocations' | 'keywords', index: number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field]?.filter((_, i) => i !== index),
    }));
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Profile</h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  className="input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Phone *</label>
                <input
                  type="tel"
                  className="input"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Current Title *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.currentTitle}
                  onChange={(e) => setFormData({ ...formData, currentTitle: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Current Company</label>
                <input
                  type="text"
                  className="input"
                  value={formData.currentCompany || ''}
                  onChange={(e) => setFormData({ ...formData, currentCompany: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Total Experience (years) *</label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  step="0.5"
                  value={formData.totalExperience}
                  onChange={(e) => setFormData({ ...formData, totalExperience: parseFloat(e.target.value) })}
                  required
                />
              </div>
            </div>
          </div>

          {/* Resume */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Resume</h2>
            {profile?.resumePath ? (
              <div className="flex items-center gap-4">
                <span className="text-gray-600">Resume uploaded</span>
                <button
                  type="button"
                  onClick={() => deleteResumeMutation.mutate()}
                  className="btn-danger flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            ) : (
              <div>
                <label className="btn-secondary cursor-pointer inline-flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload Resume
                  <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleResumeUpload} />
                </label>
                <p className="text-sm text-gray-500 mt-2">PDF, DOC, or DOCX (max 5MB)</p>
              </div>
            )}
          </div>

          {/* Skills */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Skills & Technologies</h2>
              <button type="button" onClick={addSkill} className="btn-secondary flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Skill
              </button>
            </div>
            <div className="space-y-3">
              {formData.skills?.map((skill, index) => (
                <div key={index} className="flex gap-3 items-center">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="Skill name"
                    value={skill.name}
                    onChange={(e) => updateSkill(index, 'name', e.target.value)}
                  />
                  <input
                    type="number"
                    className="input w-24"
                    placeholder="Years"
                    min="0"
                    step="0.5"
                    value={skill.yearsOfExperience}
                    onChange={(e) => updateSkill(index, 'yearsOfExperience', parseFloat(e.target.value))}
                  />
                  <select
                    className="input w-36"
                    value={skill.proficiency}
                    onChange={(e) => updateSkill(index, 'proficiency', e.target.value)}
                  >
                    {PROFICIENCY_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => removeSkill(index)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {!formData.skills?.length && <p className="text-gray-500 text-sm">No skills added yet</p>}
            </div>
          </div>

          {/* Education */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Education</h2>
              <button type="button" onClick={addEducation} className="btn-secondary flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Education
              </button>
            </div>
            <div className="space-y-3">
              {formData.education?.map((edu, index) => (
                <div key={index} className="flex gap-3 items-center">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="Degree"
                    value={edu.degree}
                    onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                  />
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="Institution"
                    value={edu.institution}
                    onChange={(e) => updateEducation(index, 'institution', e.target.value)}
                  />
                  <input
                    type="number"
                    className="input w-24"
                    placeholder="Year"
                    value={edu.year}
                    onChange={(e) => updateEducation(index, 'year', parseInt(e.target.value))}
                  />
                  <button type="button" onClick={() => removeEducation(index)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {!formData.education?.length && <p className="text-gray-500 text-sm">No education added yet</p>}
            </div>
          </div>

          {/* Job Preferences */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Job Preferences</h2>

            <div className="space-y-4">
              <TagInput
                label="Preferred Job Titles"
                tags={formData.preferredTitles || []}
                onAdd={(v) => addTag('preferredTitles', v)}
                onRemove={(i) => removeTag('preferredTitles', i)}
                placeholder="e.g., Senior Software Engineer"
              />

              <TagInput
                label="Preferred Locations"
                tags={formData.preferredLocations || []}
                onAdd={(v) => addTag('preferredLocations', v)}
                onRemove={(i) => removeTag('preferredLocations', i)}
                placeholder="e.g., Bangalore, Remote"
              />

              <TagInput
                label="Keywords"
                tags={formData.keywords || []}
                onAdd={(v) => addTag('keywords', v)}
                onRemove={(i) => removeTag('keywords', i)}
                placeholder="e.g., React, Node.js"
              />
            </div>
          </div>

          {/* Compensation */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Compensation & Availability</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Current CTC (LPA)</label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  step="0.1"
                  value={formData.currentCtc || ''}
                  onChange={(e) => setFormData({ ...formData, currentCtc: parseFloat(e.target.value) || undefined })}
                />
              </div>
              <div>
                <label className="label">Expected CTC (LPA)</label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  step="0.1"
                  value={formData.expectedCtc || ''}
                  onChange={(e) => setFormData({ ...formData, expectedCtc: parseFloat(e.target.value) || undefined })}
                />
              </div>
              <div>
                <label className="label">Notice Period *</label>
                <select
                  className="input"
                  value={formData.noticePeriod}
                  onChange={(e) => setFormData({ ...formData, noticePeriod: e.target.value as NoticePeriod })}
                >
                  {NOTICE_PERIODS.map((np) => (
                    <option key={np.value} value={np.value}>
                      {np.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Preferred Work Mode</label>
                <select
                  className="input"
                  value={formData.preferredWorkMode}
                  onChange={(e) => setFormData({ ...formData, preferredWorkMode: e.target.value as WorkMode })}
                >
                  {WORK_MODES.map((wm) => (
                    <option key={wm.value} value={wm.value}>
                      {wm.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-6 md:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.immediateJoiner}
                    onChange={(e) => setFormData({ ...formData, immediateJoiner: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Immediate Joiner
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.willingToRelocate}
                    onChange={(e) => setFormData({ ...formData, willingToRelocate: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Willing to Relocate
                </label>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button type="submit" disabled={saveMutation.isPending} className="btn-primary flex items-center gap-2">
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TagInput({
  label,
  tags,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string;
  tags: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
}) {
  const [value, setValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (value.trim()) {
        onAdd(value);
        setValue('');
      }
    }
  };

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, index) => (
          <span key={index} className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm">
            {tag}
            <button type="button" onClick={() => onRemove(index)} className="hover:text-primary-900">
              <X className="w-4 h-4" />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <p className="text-xs text-gray-500 mt-1">Press Enter to add</p>
    </div>
  );
}
