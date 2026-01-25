export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  resumePath?: string;

  // Professional info
  currentTitle: string;
  totalExperience: number; // in years
  currentCompany?: string;

  // Skills and technologies with years of experience
  skills: Skill[];

  // Education
  education: Education[];

  // Job preferences
  preferredTitles: string[];
  preferredLocations: string[];
  keywords: string[];

  // Compensation
  currentCtc?: number; // in LPA
  expectedCtc?: number; // in LPA
  noticePeriod: NoticePeriod;

  // Availability
  immediateJoiner: boolean;
  willingToRelocate: boolean;
  preferredWorkMode: WorkMode;

  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  name: string;
  yearsOfExperience: number;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface Education {
  degree: string;
  institution: string;
  year: number;
  percentage?: number;
}

export type NoticePeriod =
  | 'immediate'
  | '15_days'
  | '30_days'
  | '60_days'
  | '90_days'
  | 'more_than_90_days';

export type WorkMode = 'remote' | 'hybrid' | 'onsite' | 'any';

export interface ProfileFormData extends Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> {}
