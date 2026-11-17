import pg from "pg";

// DATABASE_URL (e.g. Neon on Vercel) or the PG* environment variables.
export const db = new pg.Pool(
    process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL, max: 5 } : undefined
);

export const INIT_TABLES = /* sql */ `
    CREATE TABLE IF NOT EXISTS "user" (
        id SERIAL PRIMARY KEY,
        name VARCHAR(128) UNIQUE NOT NULL,
        email VARCHAR(128),
        password TEXT,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "game" (
        id SERIAL PRIMARY KEY,
        winner VARCHAR(5),
        end_reason VARCHAR(16),
        pgn TEXT,
        white_id INT REFERENCES "user",
        white_name VARCHAR(32),
        black_id INT REFERENCES "user",
        black_name VARCHAR(32),
        started_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS rating INTEGER NOT NULL DEFAULT 1200;
    CREATE INDEX IF NOT EXISTS user_rating_idx ON "user" (rating DESC);

    -- games in progress, the events sent to their players and who is watching (see src/live)
    CREATE TABLE IF NOT EXISTS "live_game" (
        code VARCHAR(16) PRIMARY KEY,
        state JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS "live_event" (
        id BIGSERIAL PRIMARY KEY,
        code VARCHAR(16) NOT NULL,
        type VARCHAR(32) NOT NULL,
        payload JSONB,
        only_client VARCHAR(64),
        skip_client VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS live_event_code_id_idx ON "live_event" (code, id);
    CREATE TABLE IF NOT EXISTS "live_presence" (
        code VARCHAR(16) NOT NULL,
        client_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        user_name VARCHAR(128),
        last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (code, client_id)
    );
`;
