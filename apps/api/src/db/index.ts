import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import fs from 'fs';

import * as schema from './schema';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'jobslave.db');

let db: ReturnType<typeof drizzle>;

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export async function initializeDatabase() {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');

  db = drizzle(sqlite, { schema });

  // Create tables if they don't exist
  await createTables(sqlite);

  console.log('Database initialized at:', DB_PATH);
  return db;
}

async function createTables(sqlite: Database.Database) {
  // Create profiles table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      resume_path TEXT,
      current_title TEXT NOT NULL,
      total_experience REAL NOT NULL,
      current_company TEXT,
      skills TEXT NOT NULL DEFAULT '[]',
      education TEXT NOT NULL DEFAULT '[]',
      preferred_titles TEXT NOT NULL DEFAULT '[]',
      preferred_locations TEXT NOT NULL DEFAULT '[]',
      keywords TEXT NOT NULL DEFAULT '[]',
      current_ctc REAL,
      expected_ctc REAL,
      notice_period TEXT NOT NULL DEFAULT 'immediate',
      immediate_joiner INTEGER NOT NULL DEFAULT 0,
      willing_to_relocate INTEGER NOT NULL DEFAULT 0,
      preferred_work_mode TEXT NOT NULL DEFAULT 'any',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Create jobs table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      external_id TEXT NOT NULL,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT NOT NULL,
      work_mode TEXT,
      experience_min INTEGER,
      experience_max INTEGER,
      salary_min INTEGER,
      salary_max INTEGER,
      salary_currency TEXT,
      description TEXT,
      requirements TEXT,
      skills TEXT,
      job_url TEXT NOT NULL,
      apply_url TEXT,
      posted_date TEXT,
      scraped_at TEXT NOT NULL,
      match_score INTEGER,
      matched_keywords TEXT
    )
  `);

  // Create applications table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      applied_at TEXT,
      screening_questions TEXT,
      answers_provided TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    )
  `);

  // Create settings table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      llm_base_url TEXT NOT NULL DEFAULT 'http://127.0.0.1:1234',
      llm_model TEXT,
      llm_temperature REAL NOT NULL DEFAULT 0.7,
      llm_max_tokens INTEGER NOT NULL DEFAULT 1024,
      automation_delay INTEGER NOT NULL DEFAULT 5000,
      automation_max_per_session INTEGER NOT NULL DEFAULT 50,
      automation_headless INTEGER NOT NULL DEFAULT 0,
      automation_retry INTEGER NOT NULL DEFAULT 1,
      automation_max_retries INTEGER NOT NULL DEFAULT 3,
      credentials TEXT,
      notifications_sound INTEGER NOT NULL DEFAULT 1,
      notifications_desktop INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    )
  `);

  // Create application_logs table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS application_logs (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT,
      FOREIGN KEY (application_id) REFERENCES applications(id)
    )
  `);

  // Insert default settings if not exists
  sqlite.exec(`
    INSERT OR IGNORE INTO settings (id, updated_at)
    VALUES ('default', datetime('now'))
  `);
}

export { schema };
