# JobSlave

Automated job application SaaS with LLM-powered form filling. Apply to jobs on Naukri.com automatically with intelligent screening question answering.

## Features

- **No Login Required**: Just click and play
- **LLM-Powered**: Uses local LLM via LMStudio for intelligent form filling
- **Profile-Based Answers**: Answers screening questions based on your profile
- **Visible Browser**: Watch the automation work (can be toggled to headless)
- **Manual Login Once**: Log in once, session saved for future use
- **Queue System**: Add jobs to queue and process them automatically

## Prerequisites

1. **Node.js 20+** - Install from [nodejs.org](https://nodejs.org)
2. **pnpm** - Install with `npm install -g pnpm`
3. **LMStudio** - Download from [lmstudio.ai](https://lmstudio.ai)
   - Start local server on `http://localhost:1234`
   - Load any chat model (e.g., Llama, Mistral)

## Quick Start

```bash
# Install dependencies
pnpm install

# Install Playwright browsers (for automation)
npx playwright install chromium

# Start development (run in separate terminals)
pnpm dev:api    # Start API server on port 3001
pnpm dev:web    # Start frontend on port 5173

# Or start both at once
pnpm dev
```

Open http://localhost:5173 in your browser.

## Usage

### 1. Setup Profile

Go to **Profile** page and fill in:
- Personal information (name, email, phone)
- Current role and experience
- Skills with years of experience
- Education
- Job preferences (titles, locations, keywords)
- Notice period and salary expectations

### 2. Configure LLM

Go to **Settings** page:
1. Enter LMStudio URL (default: `http://localhost:1234`)
2. Click "Test" to verify connection
3. Select a model from the dropdown
4. Save settings

### 3. Start Automation

Go to **Dashboard**:
1. Click "Start Browser" to initialize Playwright
2. Click "Login to Naukri" - browser opens, log in manually
3. Once logged in, the session is saved

### 4. Search & Apply

Go to **Jobs** page:
1. Enter keywords and locations
2. Click "Search Jobs"
3. Select jobs you want to apply to
4. Click "Add to Queue"

Go back to **Dashboard**:
1. Click "Process Queue" to start auto-applying
2. Watch the browser apply to jobs automatically
3. LLM answers screening questions using your profile

## Project Structure

```
JobSlave/
├── apps/
│   ├── web/          # React frontend (Vite + TailwindCSS)
│   ├── api/          # Express backend (TypeScript)
│   └── desktop/      # Electron app (optional)
├── packages/
│   ├── shared/       # Shared types and utilities
│   ├── llm-client/   # LMStudio API client
│   └── job-scrapers/ # Playwright automation
└── data/             # SQLite database and uploads
```

## API Endpoints

### Profile
- `GET /api/profile` - Get profile
- `POST /api/profile` - Create/update profile
- `POST /api/profile/resume` - Upload resume

### Jobs
- `GET /api/jobs` - List saved jobs
- `POST /api/jobs/queue` - Add jobs to queue
- `GET /api/jobs/queue` - Get application queue
- `GET /api/jobs/stats` - Get statistics

### LLM
- `GET /api/llm/test` - Test LMStudio connection
- `GET /api/llm/models` - Get available models
- `POST /api/llm/answer-screening` - Answer screening question

### Automation
- `POST /api/automation/init` - Initialize browser
- `POST /api/automation/login` - Open login page
- `POST /api/automation/search` - Search jobs
- `POST /api/automation/process-queue` - Process job queue
- `POST /api/automation/stop` - Stop processing

### Settings
- `GET /api/settings` - Get settings
- `PATCH /api/settings` - Update settings

## Supported Job Sites

- **Naukri.com** (Primary, fully implemented)
- Indeed (coming soon)
- LinkedIn (coming soon)

## Technologies

- **Frontend**: React 18, Vite, TailwindCSS, React Query, Zustand
- **Backend**: Express, TypeScript, SQLite (Drizzle ORM)
- **Automation**: Playwright
- **LLM**: LMStudio (OpenAI-compatible API)
- **Monorepo**: Turborepo, pnpm

## License

MIT
