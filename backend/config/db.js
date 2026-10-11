const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

// Guarantee root .env file is loaded regardless of process CWD
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lLx4mhd7Hpub@ep-lucky-voice-b38meu3r.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 30000
});

pool.on('error', (err) => {
  console.warn('[Postgres Pool Warning - Handled]:', err.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

// Table schema definitions to auto-initialize NeonDB PostgreSQL
const TABLES_INIT_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(24) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role VARCHAR(50) NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id VARCHAR(24) PRIMARY KEY,
  user_id VARCHAR(24) UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50),
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos (
  id VARCHAR(24) PRIMARY KEY,
  user_id VARCHAR(24) REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  url TEXT,
  drill_type VARCHAR(50),
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analyses (
  id VARCHAR(24) PRIMARY KEY,
  user_id VARCHAR(24) REFERENCES users(id) ON DELETE CASCADE,
  video_id VARCHAR(24) REFERENCES videos(id) ON DELETE CASCADE,
  drill_type VARCHAR(50),
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chats (
  id VARCHAR(24) PRIMARY KEY,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(24) PRIMARY KEY,
  chat_id VARCHAR(24) REFERENCES chats(id) ON DELETE CASCADE,
  sender_id VARCHAR(24) REFERENCES users(id) ON DELETE CASCADE,
  text TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(24) PRIMARY KEY,
  user_id VARCHAR(24) REFERENCES users(id) ON DELETE CASCADE,
  text TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR(24) PRIMARY KEY,
  post_id VARCHAR(24) REFERENCES posts(id) ON DELETE CASCADE,
  user_id VARCHAR(24) REFERENCES users(id) ON DELETE CASCADE,
  text TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS followers (
  id VARCHAR(24) PRIMARY KEY,
  user_id VARCHAR(24) REFERENCES users(id) ON DELETE CASCADE,
  follower_id VARCHAR(24) REFERENCES users(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(24) PRIMARY KEY,
  user_id VARCHAR(24) REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50),
  title TEXT,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournaments (
  id VARCHAR(24) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id VARCHAR(24) PRIMARY KEY,
  tournament_id VARCHAR(24) REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id VARCHAR(24) REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trials (
  id VARCHAR(24) PRIMARY KEY,
  scout_id VARCHAR(24) REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scout_ratings (
  id VARCHAR(24) PRIMARY KEY,
  player_id VARCHAR(24) REFERENCES users(id) ON DELETE CASCADE,
  scout_id VARCHAR(24) REFERENCES users(id) ON DELETE CASCADE,
  trial_id VARCHAR(24),
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scout_reports (
  id VARCHAR(24) PRIMARY KEY,
  player_id VARCHAR(24) REFERENCES users(id) ON DELETE CASCADE,
  scout_id VARCHAR(24) REFERENCES users(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`;

async function connectDB() {
  console.log(`[DB] Connecting to NeonDB PostgreSQL...`);
  try {
    const res = await query('SELECT NOW()');
    console.log(`[✓] NeonDB PostgreSQL connected successfully at ${res.rows[0].now}`);

    // Auto-create database tables if not created
    await query(TABLES_INIT_SQL);
    console.log(`[✓] PostgreSQL database tables initialized & ready`);
    return true;
  } catch (error) {
    console.error(`[✗] Failed to connect to NeonDB PostgreSQL:`, error.message);
    return false;
  }
}

module.exports = connectDB;
module.exports.pool = pool;
module.exports.query = query;
