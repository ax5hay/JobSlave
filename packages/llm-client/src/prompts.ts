import type { UserProfile } from '@jobslave/shared';
import { noticePeriodToText } from '@jobslave/shared';

export function createProfileSystemPrompt(profile: UserProfile): string {
  const skillsList = profile.skills
    .map(s => `${s.name} (${s.yearsOfExperience} years, ${s.proficiency})`)
    .join(', ');

  const educationList = profile.education
    .map(e => `${e.degree} from ${e.institution} (${e.year})`)
    .join('; ');

  return `You are an AI assistant helping to fill out job application forms. You have access to the following candidate profile:

**Personal Information:**
- Name: ${profile.name}
- Email: ${profile.email}
- Phone: ${profile.phone}
- Current Title: ${profile.currentTitle}
- Current Company: ${profile.currentCompany || 'Not specified'}
- Total Experience: ${profile.totalExperience} years

**Skills & Technologies:**
${skillsList}

**Education:**
${educationList}

**Job Preferences:**
- Preferred Titles: ${profile.preferredTitles.join(', ')}
- Preferred Locations: ${profile.preferredLocations.join(', ')}
- Keywords: ${profile.keywords.join(', ')}

**Compensation & Availability:**
- Current CTC: ${profile.currentCTC ? `${profile.currentCTC} LPA` : 'Not specified'}
- Expected CTC: ${profile.expectedCTC ? `${profile.expectedCTC} LPA` : 'Negotiable'}
- Notice Period: ${noticePeriodToText(profile.noticePeriod)}
- Immediate Joiner: ${profile.immediateJoiner ? 'Yes' : 'No'}
- Willing to Relocate: ${profile.willingToRelocate ? 'Yes' : 'No'}
- Preferred Work Mode: ${profile.preferredWorkMode}

When answering questions:
1. Always use the profile information to provide accurate, consistent answers
2. Be concise and direct - form fields often have character limits
3. For experience questions, calculate based on the skills listed
4. For salary questions, use the expected CTC unless asked about current
5. Match the format expected by the question (numbers, dates, etc.)
6. If a question asks for a number, provide ONLY the number without units
7. Be professional and positive in tone`;
}

export function createScreeningQuestionPrompt(
  question: string,
  questionType: string,
  options: string[] | undefined,
  jobTitle: string,
  jobCompany: string
): string {
  let prompt = `I am applying for the position of "${jobTitle}" at "${jobCompany}".

The application form has the following question:
Question: "${question}"
Question Type: ${questionType}`;

  if (options && options.length > 0) {
    prompt += `\nAvailable Options: ${options.join(', ')}`;
  }

  prompt += `

Please provide the best answer based on my profile.
${questionType === 'select' || questionType === 'radio' ? 'Choose from the available options.' : ''}
${questionType === 'number' ? 'Provide only a number.' : ''}
${questionType === 'multiselect' || questionType === 'checkbox' ? 'List applicable options separated by commas.' : ''}

Provide ONLY the answer, no explanations.`;

  return prompt;
}

export function createCoverLetterPrompt(
  jobTitle: string,
  jobCompany: string,
  jobDescription: string,
  maxLength = 500
): string {
  return `Write a brief, professional cover letter for the position of "${jobTitle}" at "${jobCompany}".

Job Description:
${jobDescription}

Requirements:
1. Keep it under ${maxLength} characters
2. Highlight relevant experience from my profile
3. Show enthusiasm for the role
4. Be professional but personable
5. Do not use generic phrases like "I am writing to express my interest"

Provide ONLY the cover letter text.`;
}

export function createExperienceExtractionPrompt(question: string): string {
  return `Extract what specific experience or skill is being asked about in this question:
"${question}"

Respond with ONLY the skill/technology name, nothing else.
For example: "Python", "React", "Project Management", "Team Leadership"`;
}
