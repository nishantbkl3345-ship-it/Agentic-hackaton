-- SentinelLLM Postgres schema. Matches the queries in app/db.py.
-- Apply with: psql "$DATABASE_URL" -f schema.sql   (safe to re-run)

CREATE TABLE IF NOT EXISTS operators (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username      text UNIQUE,
    password_hash text,
    display_name  text NOT NULL,
    is_guest      boolean NOT NULL DEFAULT true,
    xp_total      integer NOT NULL DEFAULT 0,
    elo           integer NOT NULL DEFAULT 1200,
    onboarded     boolean NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
    token       text PRIMARY KEY,
    operator_id uuid NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    expires_at  timestamptz NOT NULL,
    last_seen   timestamptz NOT NULL DEFAULT now(),
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_last_seen_idx ON sessions (last_seen);

CREATE TABLE IF NOT EXISTS mission_progress (
    operator_id   uuid NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    level_id      text NOT NULL,
    patches       text[] NOT NULL DEFAULT '{}',
    results       jsonb NOT NULL DEFAULT '{}',
    attempts_used integer NOT NULL DEFAULT 0,
    hints_used    integer NOT NULL DEFAULT 0,
    cleared       boolean NOT NULL DEFAULT false,
    PRIMARY KEY (operator_id, level_id)
);

CREATE TABLE IF NOT EXISTS events (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    join_code  text NOT NULL UNIQUE,
    name       text NOT NULL,
    created_by uuid REFERENCES operators(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_participants (
    event_id     uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    operator_id  uuid NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    display_name text NOT NULL,
    joined_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, operator_id)
);

-- event_id is the all-zeros UUID (db.GLOBAL_EVENT_ID) for the global board,
-- so no foreign key to events here.
CREATE TABLE IF NOT EXISTS first_blood (
    level_id    text NOT NULL,
    event_id    uuid NOT NULL,
    operator_id uuid NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    attack_id   text NOT NULL,
    claimed_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (level_id, event_id)
);

CREATE TABLE IF NOT EXISTS activity_log (
    id          bigserial PRIMARY KEY,
    ts          timestamptz NOT NULL DEFAULT now(),
    operator_id uuid NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    event_id    uuid,
    kind        text NOT NULL,
    level_id    text,
    detail      text
);
CREATE INDEX IF NOT EXISTS activity_log_ts_idx ON activity_log (ts DESC);
CREATE INDEX IF NOT EXISTS activity_log_event_ts_idx ON activity_log (event_id, ts DESC);

-- CRUCIBLE — AI testing engine. `target` never stores a bring-your-own API
-- key (see app/crucible.py); target_key groups runs against "the same AI"
-- for the before/after comparison picker.
CREATE TABLE IF NOT EXISTS crucible_runs (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id   uuid NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    target        jsonb NOT NULL,
    target_key    text NOT NULL,
    configuration jsonb NOT NULL,
    status        text NOT NULL DEFAULT 'running',
    scores        jsonb,
    started_at    timestamptz NOT NULL DEFAULT now(),
    completed_at  timestamptz
);
CREATE INDEX IF NOT EXISTS crucible_runs_target_idx ON crucible_runs (operator_id, target_key, started_at DESC);

CREATE TABLE IF NOT EXISTS crucible_tests (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id      uuid NOT NULL REFERENCES crucible_runs(id) ON DELETE CASCADE,
    category    text NOT NULL,
    test_type   text NOT NULL,
    name        text NOT NULL,
    input       jsonb,
    expected    jsonb,
    actual      jsonb,
    status      text NOT NULL,
    severity    text,
    evidence    text,
    reason      text,
    latency_ms  integer,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crucible_tests_run_idx ON crucible_tests (run_id, created_at);

CREATE TABLE IF NOT EXISTS crucible_findings (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id       uuid NOT NULL REFERENCES crucible_runs(id) ON DELETE CASCADE,
    test_id      uuid REFERENCES crucible_tests(id) ON DELETE SET NULL,
    category     text NOT NULL,
    severity     text NOT NULL,
    title        text NOT NULL,
    description  text NOT NULL,
    evidence     text,
    remediation  text,
    status       text NOT NULL DEFAULT 'open',
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crucible_findings_run_idx ON crucible_findings (run_id);
