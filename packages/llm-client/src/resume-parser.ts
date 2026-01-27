import type { UserProfile, Skill, Education, NoticePeriod, WorkMode } from '@jobslave/shared';
import { LMStudioClient } from './client';

export interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  currentTitle: string;
  totalExperience: number;
  currentCompany?: string;
  skills: Skill[];
  education: Education[];
  preferredTitles: string[];
  preferredLocations: string[];
  keywords: string[];
  currentCtc?: number;
  expectedCtc?: number;
  noticePeriod: NoticePeriod;
  immediateJoiner: boolean;
  willingToRelocate: boolean;
  preferredWorkMode: WorkMode;
  summary?: string;
}

// RAG-style structured extraction prompt for resume parsing
const RESUME_PARSE_PROMPT = `You are an expert resume parser. Extract information from the resume text and fill in the JSON template below.

CRITICAL: Return ONLY the filled JSON object. No markdown, no explanations, no code blocks.

## RULES:
1. Extract EXACTLY what's in the resume - don't invent information
2. For skills: estimate yearsOfExperience based on work history dates
3. Proficiency levels: 0-1 yrs="beginner", 1-3 yrs="intermediate", 3-5 yrs="advanced", 5+ yrs="expert"
4. noticePeriod must be one of: "immediate", "15_days", "30_days", "60_days", "90_days", "more_than_90_days"
5. preferredWorkMode must be one of: "remote", "hybrid", "onsite", "any"
6. Generate 5-7 preferredTitles based on their experience and domain
7. Generate 15-20 keywords (technologies, tools, frameworks, domains)
8. Phone: keep only digits, max 10 characters

## RESUME TEXT:
---
{resume_text}
---

## FILL THIS JSON TEMPLATE (replace all values with extracted data):
{
  "name": "",
  "email": "",
  "phone": "",
  "currentTitle": "",
  "totalExperience": 0,
  "currentCompany": null,
  "skills": [
    {"name": "", "yearsOfExperience": 0, "proficiency": "intermediate"}
  ],
  "education": [
    {"degree": "", "institution": "", "year": 2020, "percentage": null}
  ],
  "preferredTitles": [],
  "preferredLocations": [],
  "keywords": [],
  "currentCtc": null,
  "expectedCtc": null,
  "noticePeriod": "30_days",
  "immediateJoiner": false,
  "willingToRelocate": true,
  "preferredWorkMode": "any",
  "summary": ""
}`;

const JOB_TITLE_SUGGESTION_PROMPT = `Based on this professional profile, suggest the best job titles to search for.

Profile:
- Current Title: {current_title}
- Experience: {experience} years
- Skills: {skills}
- Domain: {domain}

Generate 5-8 job titles that would be perfect matches. Include:
1. Exact match titles
2. Senior/Lead variations if experience > 4 years
3. Domain-specific titles
4. Alternative naming conventions (Developer vs Engineer vs Programmer)

Return as JSON array of strings only:`;

export class ResumeParserService {
  private client: LMStudioClient;

  constructor(client: LMStudioClient) {
    this.client = client;
  }

  async parseResume(resumeText: string): Promise<ParsedResume> {
    const prompt = RESUME_PARSE_PROMPT.replace('{resume_text}', resumeText);

    const response = await this.client.chatCompletion([
      {
        role: 'system',
        content: 'You are a resume parsing AI. Return only valid JSON, no markdown or explanations.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ], {
      temperature: 0.3, // Low temperature for structured output
      max_tokens: 4096,
    });

    // Extract JSON from response
    const content = response.choices[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Failed to parse resume - no valid JSON in response');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as ParsedResume;
      return this.validateAndNormalize(parsed);
    } catch (e) {
      throw new Error(`Failed to parse resume JSON: ${e}`);
    }
  }

  async suggestJobTitles(profile: {
    currentTitle: string;
    totalExperience: number;
    skills: string[];
  }): Promise<string[]> {
    const domain = this.inferDomain(profile.skills);
    const prompt = JOB_TITLE_SUGGESTION_PROMPT
      .replace('{current_title}', profile.currentTitle)
      .replace('{experience}', String(profile.totalExperience))
      .replace('{skills}', profile.skills.slice(0, 10).join(', '))
      .replace('{domain}', domain);

    const response = await this.client.chatCompletion([
      { role: 'user', content: prompt },
    ], {
      temperature: 0.5,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '[]';
    const jsonMatch = content.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      return [profile.currentTitle];
    }

    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return [profile.currentTitle];
    }
  }

  async enhanceProfileWithContext(
    profile: Partial<ParsedResume>,
    existingJobTitles: string[]
  ): Promise<{ suggestedTitles: string[]; suggestedKeywords: string[] }> {
    const prompt = `Given this profile and existing job titles in the market, suggest the best matching job titles and search keywords.

Profile:
${JSON.stringify(profile, null, 2)}

Existing job titles in market:
${existingJobTitles.slice(0, 20).join('\n')}

Return JSON with:
{
  "suggestedTitles": ["title1", "title2", ...],
  "suggestedKeywords": ["keyword1", "keyword2", ...]
}`;

    const response = await this.client.chatCompletion([
      { role: 'user', content: prompt },
    ], {
      temperature: 0.4,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return { suggestedTitles: [], suggestedKeywords: [] };
    }

    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return { suggestedTitles: [], suggestedKeywords: [] };
    }
  }

  private inferDomain(skills: string[]): string {
    const skillsLower = skills.map(s => s.toLowerCase()).join(' ');

    if (skillsLower.includes('react') || skillsLower.includes('angular') || skillsLower.includes('vue')) {
      return 'Frontend Development';
    }
    if (skillsLower.includes('node') || skillsLower.includes('python') || skillsLower.includes('java')) {
      return 'Backend Development';
    }
    if (skillsLower.includes('aws') || skillsLower.includes('kubernetes') || skillsLower.includes('docker')) {
      return 'DevOps/Cloud';
    }
    if (skillsLower.includes('tensorflow') || skillsLower.includes('pytorch') || skillsLower.includes('ml')) {
      return 'Machine Learning/AI';
    }
    if (skillsLower.includes('ios') || skillsLower.includes('android') || skillsLower.includes('flutter')) {
      return 'Mobile Development';
    }
    return 'Software Development';
  }

  private validateAndNormalize(parsed: any): ParsedResume {
    const validNoticePeriods: NoticePeriod[] = ['immediate', '15_days', '30_days', '60_days', '90_days', 'more_than_90_days'];
    const validWorkModes: WorkMode[] = ['remote', 'hybrid', 'onsite', 'any'];
    const validProficiencies = ['beginner', 'intermediate', 'advanced', 'expert'];

    return {
      name: String(parsed.name || ''),
      email: String(parsed.email || ''),
      phone: String(parsed.phone || '').replace(/\D/g, '').slice(-10),
      currentTitle: String(parsed.currentTitle || ''),
      totalExperience: Number(parsed.totalExperience) || 0,
      currentCompany: parsed.currentCompany ? String(parsed.currentCompany) : undefined,
      skills: Array.isArray(parsed.skills) ? parsed.skills.map((s: any) => ({
        name: String(s.name || ''),
        yearsOfExperience: Number(s.yearsOfExperience) || 0,
        proficiency: validProficiencies.includes(s.proficiency) ? s.proficiency : 'intermediate',
      })) : [],
      education: Array.isArray(parsed.education) ? parsed.education.map((e: any) => ({
        degree: String(e.degree || ''),
        institution: String(e.institution || ''),
        year: Number(e.year) || new Date().getFullYear(),
      })) : [],
      preferredTitles: Array.isArray(parsed.preferredTitles) ? parsed.preferredTitles.map(String) : [],
      preferredLocations: Array.isArray(parsed.preferredLocations) ? parsed.preferredLocations.map(String) : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
      currentCtc: parsed.currentCtc ? Number(parsed.currentCtc) : undefined,
      expectedCtc: parsed.expectedCtc ? Number(parsed.expectedCtc) : undefined,
      noticePeriod: validNoticePeriods.includes(parsed.noticePeriod) ? parsed.noticePeriod : 'immediate',
      immediateJoiner: Boolean(parsed.immediateJoiner),
      willingToRelocate: Boolean(parsed.willingToRelocate),
      preferredWorkMode: validWorkModes.includes(parsed.preferredWorkMode) ? parsed.preferredWorkMode : 'any',
      summary: parsed.summary ? String(parsed.summary) : undefined,
    };
  }
}
