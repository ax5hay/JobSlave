import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  X,
  Save,
  Upload,
  Trash2,
  User,
  Briefcase,
  GraduationCap,
  Target,
  DollarSign,
  Sparkles,
  FileText,
  Wand2,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { profileApi, type ParsedResume } from '@/lib/api';
import type { UserProfile, Skill, Education, NoticePeriod, WorkMode } from '@jobslave/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const NOTICE_PERIODS: { value: NoticePeriod; label: string }[] = [
  { value: 'immediate', label: 'Immediate' },
  { value: '15_days', label: '15 Days' },
  { value: '30_days', label: '30 Days' },
  { value: '60_days', label: '60 Days' },
  { value: '90_days', label: '90 Days' },
  { value: 'more_than_90_days', label: '90+ Days' },
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
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

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

  const [parsedData, setParsedData] = useState<ParsedResume | null>(null);
  const [showParsedPreview, setShowParsedPreview] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData(profile);
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: profileApi.save,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({ title: 'Profile saved', description: 'Your changes have been saved successfully' });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const uploadResumeMutation = useMutation({
    mutationFn: profileApi.uploadResume,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({ title: 'Resume uploaded' });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const deleteResumeMutation = useMutation({
    mutationFn: profileApi.deleteResume,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({ title: 'Resume deleted' });
    },
    onError: (error: Error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const parseResumeMutation = useMutation({
    mutationFn: profileApi.parseResume,
    onSuccess: (data) => {
      setParsedData(data);
      setShowParsedPreview(true);
      toast({ title: 'Resume parsed!', description: 'Review the extracted data and apply it to your profile' });
    },
    onError: (error: Error) => toast({ title: 'Parse failed', description: error.message, variant: 'destructive' }),
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

  const handleAIParseResume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseResumeMutation.mutate(file);
    }
  };

  const applyParsedData = () => {
    if (!parsedData) return;

    const skills: Skill[] = (parsedData.skills || []).map((name) => ({
      name,
      yearsOfExperience: parsedData.totalExperience || 0,
      proficiency: 'intermediate' as const,
    }));

    const education: Education[] = (parsedData.education || []).map((edu) => ({
      degree: edu.degree,
      institution: edu.institution,
      year: edu.year || new Date().getFullYear(),
    }));

    setFormData((prev) => ({
      ...prev,
      name: parsedData.name || prev.name,
      email: parsedData.email || prev.email,
      phone: parsedData.phone || prev.phone,
      currentTitle: parsedData.currentTitle || prev.currentTitle,
      totalExperience: parsedData.totalExperience || prev.totalExperience,
      skills: skills.length > 0 ? skills : prev.skills,
      education: education.length > 0 ? education : prev.education,
      preferredTitles: parsedData.preferredTitles || prev.preferredTitles,
      preferredLocations: parsedData.preferredLocations || prev.preferredLocations,
      keywords: parsedData.skills || prev.keywords,
      resumePath: parsedData.resumePath || prev.resumePath,
    }));

    setShowParsedPreview(false);
    toast({ title: 'Data applied!', description: 'Review and save your profile' });
  };

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
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-primary/20 rounded-full" />
          <div className="absolute inset-0 w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Your Profile</h1>
          <p className="text-muted-foreground mt-2">This information will be used to auto-fill job applications</p>
        </div>
      </div>

      {/* AI Parse Card - Hero Feature */}
      <div className="relative overflow-hidden glass-card p-6 feature-ring-parent">
        <div className="feature-ring" />
        <div className="relative">
          <div className="flex items-start gap-6">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-2xl blur-xl opacity-40" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <Wand2 className="w-7 h-7 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <span className="text-gradient">One-Click AI Parse</span>
                <Badge className="bg-gradient-to-r from-primary/20 to-accent/20 text-primary border-0">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Powered by LLM
                </Badge>
              </h2>
              <p className="text-muted-foreground mt-1">
                Upload your resume and let AI automatically fill your profile. Supports PDF files.
              </p>
              <div className="flex items-center gap-3 mt-4">
                <Button
                  type="button"
                  onClick={() => aiFileInputRef.current?.click()}
                  disabled={parseResumeMutation.isPending}
                  className="gap-2 glass-button"
                >
                  {parseResumeMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Parsing with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Parse Resume with AI
                    </>
                  )}
                </Button>
                <input
                  ref={aiFileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleAIParseResume}
                  aria-label="Upload resume for AI parsing"
                />
                <span className="text-xs text-muted-foreground">or drag & drop</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Parsed Data Preview */}
      {showParsedPreview && parsedData && (
        <div className="glass-card p-6 border-2 border-primary/30 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold">Resume Parsed Successfully!</h3>
                <p className="text-sm text-muted-foreground">Review the extracted data below</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowParsedPreview(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={applyParsedData} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                Apply to Profile
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {parsedData.name && (
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium truncate">{parsedData.name}</p>
              </div>
            )}
            {parsedData.email && (
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium truncate">{parsedData.email}</p>
              </div>
            )}
            {parsedData.phone && (
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{parsedData.phone}</p>
              </div>
            )}
            {parsedData.currentTitle && (
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground">Current Title</p>
                <p className="font-medium truncate">{parsedData.currentTitle}</p>
              </div>
            )}
            {parsedData.totalExperience !== undefined && (
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground">Experience</p>
                <p className="font-medium">{parsedData.totalExperience} years</p>
              </div>
            )}
            {parsedData.skills && parsedData.skills.length > 0 && (
              <div className="p-3 rounded-lg bg-secondary/50 col-span-2 md:col-span-1">
                <p className="text-xs text-muted-foreground mb-1">Skills ({parsedData.skills.length})</p>
                <div className="flex flex-wrap gap-1">
                  {parsedData.skills.slice(0, 5).map((skill, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{skill}</Badge>
                  ))}
                  {parsedData.skills.length > 5 && (
                    <Badge variant="secondary" className="text-xs">+{parsedData.skills.length - 5}</Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Section icon={User} title="Basic Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="glass-input"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="glass-input"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="glass-input"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Current Title *</Label>
              <Input
                value={formData.currentTitle}
                onChange={(e) => setFormData({ ...formData, currentTitle: e.target.value })}
                className="glass-input"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Current Company</Label>
              <Input
                value={formData.currentCompany || ''}
                onChange={(e) => setFormData({ ...formData, currentCompany: e.target.value })}
                className="glass-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Total Experience (years) *</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={formData.totalExperience}
                onChange={(e) => setFormData({ ...formData, totalExperience: parseFloat(e.target.value) })}
                className="glass-input"
                required
              />
            </div>
          </div>

          <Separator className="my-5" />

          {/* Resume Upload */}
          <div>
            <Label className="mb-3 block">Resume (for manual upload)</Label>
            {profile?.resumePath ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/30">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Resume uploaded</p>
                  <p className="text-xs text-muted-foreground">Ready for applications</p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteResumeMutation.mutate()}
                  className="gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleResumeUpload}
                  aria-label="Upload resume file"
                />
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Drop your resume here or click to upload</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOC, or DOCX (max 5MB)</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose File
                </Button>
              </div>
            )}
          </div>
        </Section>

        {/* Skills */}
        <Section icon={Briefcase} title="Skills & Technologies" action={
          <Button type="button" variant="outline" size="sm" onClick={addSkill} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Add Skill
          </Button>
        }>
          <div className="space-y-3">
            {formData.skills?.map((skill, index) => (
              <div key={index} className="flex gap-3 items-center p-4 rounded-xl glass-card">
                <Input
                  className="flex-1"
                  placeholder="Skill name"
                  value={skill.name}
                  onChange={(e) => updateSkill(index, 'name', e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-20"
                    placeholder="Years"
                    min="0"
                    step="0.5"
                    value={skill.yearsOfExperience}
                    onChange={(e) => updateSkill(index, 'yearsOfExperience', parseFloat(e.target.value))}
                  />
                  <span className="text-xs text-muted-foreground">yrs</span>
                </div>
                <Select
                  value={skill.proficiency}
                  onValueChange={(v) => updateSkill(index, 'proficiency', v)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROFICIENCY_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSkill(index)}
                  className="text-destructive hover:text-destructive shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {!formData.skills?.length && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mb-3">
                  <Briefcase className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No skills added yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add your technical skills and experience</p>
              </div>
            )}
          </div>
        </Section>

        {/* Education */}
        <Section icon={GraduationCap} title="Education" action={
          <Button type="button" variant="outline" size="sm" onClick={addEducation} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Add Education
          </Button>
        }>
          <div className="space-y-3">
            {formData.education?.map((edu, index) => (
              <div key={index} className="flex gap-3 items-center p-4 rounded-xl glass-card">
                <Input
                  className="flex-1"
                  placeholder="Degree (e.g., B.Tech Computer Science)"
                  value={edu.degree}
                  onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                />
                <Input
                  className="flex-1"
                  placeholder="Institution"
                  value={edu.institution}
                  onChange={(e) => updateEducation(index, 'institution', e.target.value)}
                />
                <Input
                  type="number"
                  className="w-24"
                  placeholder="Year"
                  value={edu.year}
                  onChange={(e) => updateEducation(index, 'year', parseInt(e.target.value))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeEducation(index)}
                  className="text-destructive hover:text-destructive shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {!formData.education?.length && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mb-3">
                  <GraduationCap className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No education added yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add your degrees and certifications</p>
              </div>
            )}
          </div>
        </Section>

        {/* Job Preferences */}
        <Section icon={Target} title="Job Preferences">
          <div className="space-y-5">
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
              label="Search Keywords"
              tags={formData.keywords || []}
              onAdd={(v) => addTag('keywords', v)}
              onRemove={(i) => removeTag('keywords', i)}
              placeholder="e.g., React, Node.js, TypeScript"
            />
          </div>
        </Section>

        {/* Compensation */}
        <Section icon={DollarSign} title="Compensation & Availability">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Current CTC (LPA)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.currentCtc || ''}
                onChange={(e) => setFormData({ ...formData, currentCtc: parseFloat(e.target.value) || undefined })}
                className="glass-input"
                placeholder="e.g., 12.5"
              />
            </div>
            <div className="space-y-2">
              <Label>Expected CTC (LPA)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.expectedCtc || ''}
                onChange={(e) => setFormData({ ...formData, expectedCtc: parseFloat(e.target.value) || undefined })}
                className="glass-input"
                placeholder="e.g., 18.0"
              />
            </div>
            <div className="space-y-2">
              <Label>Notice Period</Label>
              <Select
                value={formData.noticePeriod}
                onValueChange={(v) => setFormData({ ...formData, noticePeriod: v as NoticePeriod })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTICE_PERIODS.map((np) => (
                    <SelectItem key={np.value} value={np.value}>{np.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Preferred Work Mode</Label>
              <Select
                value={formData.preferredWorkMode}
                onValueChange={(v) => setFormData({ ...formData, preferredWorkMode: v as WorkMode })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_MODES.map((wm) => (
                    <SelectItem key={wm.value} value={wm.value}>{wm.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 mt-5 pt-5 border-t border-border/50">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
              <Switch
                checked={formData.immediateJoiner}
                onCheckedChange={(checked) => setFormData({ ...formData, immediateJoiner: checked })}
              />
              <Label className="cursor-pointer">Immediate Joiner</Label>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
              <Switch
                checked={formData.willingToRelocate}
                onCheckedChange={(checked) => setFormData({ ...formData, willingToRelocate: checked })}
              />
              <Label className="cursor-pointer">Willing to Relocate</Label>
            </div>
          </div>
        </Section>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={saveMutation.isPending} className="gap-2 glass-button px-8">
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Profile
              </>
            )}
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
  action,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="icon-container">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <h2 className="font-semibold text-lg">{title}</h2>
        </div>
        {action}
      </div>
      {children}
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
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-xl bg-secondary/30">
        {tags.length === 0 && (
          <span className="text-sm text-muted-foreground">No items yet</span>
        )}
        {tags.map((tag, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="gap-1.5 pr-1.5 bg-background/80 hover:bg-background"
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="ml-0.5 rounded-full hover:bg-destructive/20 hover:text-destructive p-0.5 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (value.trim()) {
              onAdd(value);
              setValue('');
            }
          }}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Press Enter or click + to add</p>
    </div>
  );
}
