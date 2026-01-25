import type { Job, JobSearchParams, JobSearchResult, ScreeningQuestion } from '@jobslave/shared';
import { generateId, delay } from '@jobslave/shared';
import { BaseScraper } from '../base/scraper';
import type { ApplyResult, ScraperConfig, ScraperEvents } from '../base/types';

export class NaukriScraper extends BaseScraper {
  readonly source = 'naukri';
  readonly baseUrl = 'https://www.naukri.com';
  readonly loginUrl = 'https://www.naukri.com/nlogin/login';

  private searchBaseUrl = 'https://www.naukri.com/jobapi/v3/search';

  constructor(config?: Partial<ScraperConfig>, events?: ScraperEvents) {
    super(config, events);
  }

  async checkLoginStatus(): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded' });
      await delay(2000);

      // Check for login indicator (user menu or profile icon)
      const loggedIn = await this.page.evaluate(() => {
        // Naukri shows different elements when logged in
        const userMenu = document.querySelector('.nI-gNb-drawer__icon, .user-img, [data-ga-track="spa-event|header|Profile"]');
        const loginBtn = document.querySelector('.nI-gNb-header__hamburger-icon-wrapper a[title="Login"]');
        return userMenu !== null && loginBtn === null;
      });

      this.state.isLoggedIn = loggedIn;
      this.log('info', `Login status: ${loggedIn ? 'Logged in' : 'Not logged in'}`);
      return loggedIn;
    } catch (error) {
      this.log('error', `Failed to check login status: ${error}`);
      return false;
    }
  }

  async openLoginPage(): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    this.log('info', 'Opening login page...');
    await this.page.goto(this.loginUrl, { waitUntil: 'networkidle' });
    this.log('info', 'Login page opened. Please log in manually.');
  }

  async waitForManualLogin(timeoutMs = 300000): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    this.log('info', `Waiting for manual login (timeout: ${timeoutMs / 1000}s)...`);

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const isLoggedIn = await this.checkLoginStatus();
      if (isLoggedIn) {
        this.log('info', 'Login successful!');
        await this.saveSession();
        return true;
      }
      await delay(3000);
    }

    this.log('warn', 'Login timeout reached');
    return false;
  }

  async searchJobs(params: JobSearchParams): Promise<JobSearchResult> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    this.log('info', `Searching jobs: ${params.keywords.join(', ')} in ${params.locations.join(', ')}`);

    // Build search URL
    const searchUrl = this.buildSearchUrl(params);
    await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await delay(2000);

    // Wait for job listings to load
    try {
      await this.page.waitForSelector('.srp-jobtuple-wrapper, .jobTuple', { timeout: 10000 });
    } catch {
      this.log('warn', 'No job listings found or page structure changed');
      return { jobs: [], totalCount: 0, page: params.page || 1, hasMore: false };
    }

    // Extract job listings
    const jobs = await this.extractJobListings();

    // Get total count
    const totalCount = await this.page.evaluate(() => {
      const countEl = document.querySelector('.styles_count-string__DlPaZ, .count');
      if (countEl) {
        const match = countEl.textContent?.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      }
      return 0;
    });

    const currentPage = params.page || 1;
    const hasMore = jobs.length > 0 && currentPage * 20 < totalCount;

    this.log('info', `Found ${jobs.length} jobs (total: ${totalCount})`);

    return {
      jobs,
      totalCount,
      page: currentPage,
      hasMore,
    };
  }

  private buildSearchUrl(params: JobSearchParams): string {
    const keywords = params.keywords.join('-').toLowerCase().replace(/\s+/g, '-');
    const locations = params.locations.join('-').toLowerCase().replace(/\s+/g, '-');

    let url = `${this.baseUrl}/${keywords}-jobs-in-${locations}`;

    const queryParams: string[] = [];

    if (params.experienceMin !== undefined) {
      queryParams.push(`experience=${params.experienceMin}`);
    }

    if (params.salaryMin) {
      queryParams.push(`salary=${params.salaryMin}`);
    }

    if (params.postedWithin) {
      const daysMap: Record<string, string> = {
        '1d': '1',
        '3d': '3',
        '7d': '7',
        '15d': '15',
        '30d': '30',
      };
      queryParams.push(`jobAge=${daysMap[params.postedWithin] || '30'}`);
    }

    if (params.page && params.page > 1) {
      queryParams.push(`page=${params.page}`);
    }

    if (queryParams.length > 0) {
      url += `?${queryParams.join('&')}`;
    }

    return url;
  }

  private async extractJobListings(): Promise<Job[]> {
    return this.page!.evaluate(() => {
      const jobCards = document.querySelectorAll('.srp-jobtuple-wrapper, .jobTuple, [data-job-id]');
      const jobs: any[] = [];

      jobCards.forEach((card, index) => {
        try {
          // Extract job ID
          const jobId = card.getAttribute('data-job-id') ||
            card.querySelector('a')?.href?.match(/jobid=(\d+)/)?.[1] ||
            `naukri-${Date.now()}-${index}`;

          // Extract title
          const titleEl = card.querySelector('.title, .row1 a, [class*="title"]');
          const title = titleEl?.textContent?.trim() || 'Unknown Title';

          // Extract company
          const companyEl = card.querySelector('.comp-name, .subTitle a, [class*="companyName"]');
          const company = companyEl?.textContent?.trim() || 'Unknown Company';

          // Extract location
          const locationEl = card.querySelector('.loc, .locWdth, [class*="location"]');
          const location = locationEl?.textContent?.trim() || 'Unknown Location';

          // Extract experience
          const expEl = card.querySelector('.expwdth, [class*="experience"]');
          const expText = expEl?.textContent?.trim() || '';
          const expMatch = expText.match(/(\d+)-(\d+)/);

          // Extract salary
          const salaryEl = card.querySelector('.salary, [class*="salary"]');
          const salaryText = salaryEl?.textContent?.trim() || '';

          // Extract job URL
          const linkEl = card.querySelector('a.title, .row1 a');
          const jobUrl = linkEl?.getAttribute('href') || '';

          // Extract description/skills
          const descEl = card.querySelector('.job-description, .row4, [class*="tags"]');
          const description = descEl?.textContent?.trim() || '';

          jobs.push({
            id: `naukri-${jobId}`,
            externalId: jobId,
            source: 'naukri',
            title,
            company,
            location,
            experienceRange: expMatch
              ? { min: parseInt(expMatch[1]), max: parseInt(expMatch[2]) }
              : undefined,
            description,
            jobUrl: jobUrl.startsWith('http') ? jobUrl : `https://www.naukri.com${jobUrl}`,
            scrapedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.error('Failed to extract job card:', e);
        }
      });

      return jobs;
    }) as Promise<Job[]>;
  }

  async getJobDetails(jobId: string): Promise<Job | null> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    const url = `${this.baseUrl}/job-listings-${jobId}?src=jobsearchDe498_${jobId}`;

    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      await delay(1500);

      const job = await this.page.evaluate((id) => {
        const title = document.querySelector('h1, .styles_jd-header-title__rZwM1')?.textContent?.trim() || '';
        const company = document.querySelector('.styles_jd-header-comp-name__MvqAI, .jd-header-comp-name')?.textContent?.trim() || '';
        const location = document.querySelector('.styles_jhc__loc__M6Kux, .loc')?.textContent?.trim() || '';
        const description = document.querySelector('.styles_JDC__dang-inner-html__h0K4t, .jd-desc')?.textContent?.trim() || '';

        // Extract experience
        const expEl = document.querySelector('.styles_jhc__exp__k_giM, .exp');
        const expText = expEl?.textContent?.trim() || '';
        const expMatch = expText.match(/(\d+)-(\d+)/);

        // Extract skills
        const skillsEls = document.querySelectorAll('.styles_chip__7YCfG, .chip');
        const skills = Array.from(skillsEls).map(el => el.textContent?.trim() || '').filter(Boolean);

        return {
          id: `naukri-${id}`,
          externalId: id,
          source: 'naukri',
          title,
          company,
          location,
          description,
          skills,
          experienceRange: expMatch
            ? { min: parseInt(expMatch[1]), max: parseInt(expMatch[2]) }
            : undefined,
          jobUrl: window.location.href,
          scrapedAt: new Date().toISOString(),
        };
      }, jobId) as Job;

      return job;
    } catch (error) {
      this.log('error', `Failed to get job details: ${error}`);
      return null;
    }
  }

  async applyToJob(job: Job): Promise<ApplyResult> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    this.state.currentJob = job;
    this.events.onApplicationStart?.(job);

    try {
      // Navigate to job page if not already there
      if (!this.page.url().includes(job.externalId)) {
        await this.page.goto(job.jobUrl, { waitUntil: 'domcontentloaded' });
        await delay(1500);
      }

      // Check if already applied
      const alreadyApplied = await this.page.evaluate(() => {
        const appliedBtn = document.querySelector('[class*="applied"], .applied');
        return appliedBtn !== null;
      });

      if (alreadyApplied) {
        this.log('info', `Already applied to: ${job.title} at ${job.company}`);
        return { success: false, alreadyApplied: true };
      }

      // Find and click apply button
      const applyBtnSelector = '.styles_apply-button__uJI3n, #apply-button, [class*="apply-button"], button:has-text("Apply")';

      try {
        await this.page.waitForSelector(applyBtnSelector, { timeout: 5000 });
        await this.page.click(applyBtnSelector);
        this.log('info', `Clicked apply for: ${job.title}`);
      } catch {
        // Try alternative selectors
        const clicked = await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, a'));
          const applyBtn = buttons.find(btn =>
            btn.textContent?.toLowerCase().includes('apply')
          );
          if (applyBtn) {
            (applyBtn as HTMLElement).click();
            return true;
          }
          return false;
        });

        if (!clicked) {
          return { success: false, error: 'Apply button not found' };
        }
      }

      await delay(2000);

      // Check for screening questions
      const hasQuestions = await this.hasScreeningQuestions();

      if (hasQuestions) {
        const questions = await this.getScreeningQuestions();
        this.log('info', `Found ${questions.length} screening questions`);
        return {
          success: false,
          screeningQuestions: questions,
          error: 'Screening questions require answers',
        };
      }

      // Check if application was successful
      const success = await this.checkApplicationSuccess();

      if (success) {
        this.state.appliedCount++;
        this.events.onApplicationComplete?.(job, true);
        this.log('info', `Successfully applied to: ${job.title} at ${job.company}`);
        return { success: true };
      }

      return { success: false, error: 'Application submission unclear' };
    } catch (error) {
      this.state.failedCount++;
      this.events.onApplicationComplete?.(job, false);
      this.events.onError?.(error as Error, job);
      return { success: false, error: String(error) };
    } finally {
      this.state.currentJob = null;
    }
  }

  private async hasScreeningQuestions(): Promise<boolean> {
    return this.page!.evaluate(() => {
      const questionContainers = document.querySelectorAll(
        '.chatbot-container, [class*="screening"], [class*="question"], .apply-modal form'
      );
      return questionContainers.length > 0;
    });
  }

  async getScreeningQuestions(): Promise<ScreeningQuestion[]> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    return this.page.evaluate(() => {
      const questions: any[] = [];
      const questionContainers = document.querySelectorAll(
        '.chatbot-question, [class*="question-container"], .form-group, .apply-modal .form-row'
      );

      questionContainers.forEach((container, index) => {
        // Get question text
        const labelEl = container.querySelector('label, .question-text, [class*="label"]');
        const questionText = labelEl?.textContent?.trim() || '';

        if (!questionText) return;

        // Determine question type and options
        let type: 'text' | 'number' | 'select' | 'radio' | 'checkbox' = 'text';
        const options: string[] = [];

        // Check for select
        const selectEl = container.querySelector('select');
        if (selectEl) {
          type = 'select';
          selectEl.querySelectorAll('option').forEach(opt => {
            if (opt.value) options.push(opt.textContent?.trim() || '');
          });
        }

        // Check for radio buttons
        const radioEls = container.querySelectorAll('input[type="radio"]');
        if (radioEls.length > 0) {
          type = 'radio';
          radioEls.forEach(radio => {
            const radioLabel = container.querySelector(`label[for="${radio.id}"]`);
            options.push(radioLabel?.textContent?.trim() || (radio as HTMLInputElement).value);
          });
        }

        // Check for checkbox
        const checkboxEls = container.querySelectorAll('input[type="checkbox"]');
        if (checkboxEls.length > 1) {
          type = 'multiselect';
          checkboxEls.forEach(cb => {
            const cbLabel = container.querySelector(`label[for="${cb.id}"]`);
            options.push(cbLabel?.textContent?.trim() || (cb as HTMLInputElement).value);
          });
        } else if (checkboxEls.length === 1) {
          type = 'checkbox';
        }

        // Check for number input
        const numberInput = container.querySelector('input[type="number"]');
        if (numberInput) {
          type = 'number';
        }

        // Check for required
        const required = container.querySelector('[required], .required, *[class*="required"]') !== null;

        questions.push({
          id: `q-${index}`,
          question: questionText,
          type,
          options: options.length > 0 ? options : undefined,
          required,
        });
      });

      return questions;
    }) as Promise<ScreeningQuestion[]>;
  }

  async fillScreeningAnswer(questionId: string, answer: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    const index = parseInt(questionId.replace('q-', ''), 10);

    await this.page.evaluate(
      ({ idx, ans }) => {
        const containers = document.querySelectorAll(
          '.chatbot-question, [class*="question-container"], .form-group, .apply-modal .form-row'
        );
        const container = containers[idx];
        if (!container) return;

        // Try text input
        const textInput = container.querySelector('input[type="text"], textarea');
        if (textInput) {
          (textInput as HTMLInputElement).value = ans;
          textInput.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }

        // Try number input
        const numberInput = container.querySelector('input[type="number"]');
        if (numberInput) {
          (numberInput as HTMLInputElement).value = ans;
          numberInput.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }

        // Try select
        const select = container.querySelector('select');
        if (select) {
          const options = Array.from(select.options);
          const matchingOption = options.find(
            opt => opt.text.toLowerCase().includes(ans.toLowerCase())
          );
          if (matchingOption) {
            select.value = matchingOption.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
          return;
        }

        // Try radio buttons
        const radioInputs = container.querySelectorAll('input[type="radio"]');
        if (radioInputs.length > 0) {
          radioInputs.forEach(radio => {
            const label = container.querySelector(`label[for="${radio.id}"]`);
            if (label?.textContent?.toLowerCase().includes(ans.toLowerCase())) {
              (radio as HTMLInputElement).click();
            }
          });
          return;
        }
      },
      { idx: index, ans: answer }
    );

    this.events.onScreeningQuestion?.({ id: questionId, question: '', type: 'text', required: true }, answer);
    await delay(500);
  }

  async submitApplication(): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      // Find and click submit button
      const submitSelectors = [
        'button[type="submit"]',
        '.apply-submit',
        '[class*="submit"]',
        'button:has-text("Submit")',
        'button:has-text("Apply")',
      ];

      for (const selector of submitSelectors) {
        const clicked = await this.safeClick(selector);
        if (clicked) {
          this.log('info', 'Clicked submit button');
          await delay(2000);
          return await this.checkApplicationSuccess();
        }
      }

      return false;
    } catch (error) {
      this.log('error', `Submit failed: ${error}`);
      return false;
    }
  }

  private async checkApplicationSuccess(): Promise<boolean> {
    return this.page!.evaluate(() => {
      const successIndicators = [
        '.success',
        '.applied',
        '[class*="success"]',
        '[class*="applied"]',
      ];

      for (const selector of successIndicators) {
        if (document.querySelector(selector)) {
          return true;
        }
      }

      // Check for success message in text
      const bodyText = document.body.textContent?.toLowerCase() || '';
      return (
        bodyText.includes('application submitted') ||
        bodyText.includes('successfully applied') ||
        bodyText.includes('application successful')
      );
    });
  }
}
