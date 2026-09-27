"""Postgres access for SentinelLLM.

Sync psycopg3, no ORM: the schema is half a dozen tables and hand-written
parameterized SQL is simpler here than adding an ORM dependency for it.
"""

import json
import os
import secrets
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import psycopg
from psycopg import sql
from psycopg.rows import dict_row

DATABASE_URL = os.environ["DATABASE_URL"]
SESSION_TTL = timedelta(days=30)
GLOBAL_EVENT_ID = uuid.UUID(int=0)


@contextmanager
def get_conn():
    with psycopg.connect(DATABASE_URL, row_factory=dict_row, autocommit=True) as conn:
        yield conn


def _random_display_name() -> str:
    return f"OPERATOR-{secrets.token_hex(2).upper()}"


def create_guest_operator(conn) -> dict:
    return conn.execute(
        "INSERT INTO operators (display_name) VALUES (%s) RETURNING *",
        (_random_display_name(),),
    ).fetchone()


def create_session(conn, operator_id) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + SESSION_TTL
    conn.execute(
        "INSERT INTO sessions (token, operator_id, expires_at) VALUES (%s, %s, %s)",
        (token, operator_id, expires_at),
    )
    return token


def delete_session(conn, token: str):
    conn.execute(
        "DELETE FROM sessions WHERE token = %s",
        (token,),
    )


def get_operator_by_session(conn, token: str):
    if not token:
        return None
    row = conn.execute(
        """
        UPDATE sessions SET last_seen = now()
        WHERE token = %s AND expires_at > now()
        RETURNING operator_id
        """,
        (token,),
    ).fetchone()
    if not row:
        return None
    return get_operator(conn, row["operator_id"])


def get_operator(conn, operator_id):
    return conn.execute(
        "SELECT * FROM operators WHERE id = %s",
        (operator_id,),
    ).fetchone()


def get_operator_by_username(conn, username: str):
    return conn.execute(
        "SELECT * FROM operators WHERE username = %s",
        (username,),
    ).fetchone()


def convert_guest_to_account(conn, operator_id, username: str, password_hash: str):
    return conn.execute(
        """
        UPDATE operators SET username = %s, password_hash = %s, is_guest = false
        WHERE id = %s RETURNING *
        """,
        (username, password_hash, operator_id),
    ).fetchone()


def set_onboarded(conn, operator_id):
    conn.execute(
        "UPDATE operators SET onboarded = true WHERE id = %s",
        (operator_id,),
    )


def add_xp(conn, operator_id, amount: int):
    conn.execute(
        "UPDATE operators SET xp_total = xp_total + %s WHERE id = %s",
        (amount, operator_id),
    )


def set_elo(conn, operator_id, new_elo: int):
    conn.execute(
        "UPDATE operators SET elo = %s WHERE id = %s",
        (new_elo, operator_id),
    )


def get_mission_progress(conn, operator_id, level_id):
    row = conn.execute(
        "SELECT * FROM mission_progress WHERE operator_id = %s AND level_id = %s",
        (operator_id, level_id),
    ).fetchone()
    if row:
        return row
    return conn.execute(
        """
        INSERT INTO mission_progress (operator_id, level_id) VALUES (%s, %s)
        ON CONFLICT (operator_id, level_id) DO UPDATE SET operator_id = EXCLUDED.operator_id
        RETURNING *
        """,
        (operator_id, level_id),
    ).fetchone()


def save_mission_progress(conn, operator_id, level_id, *, patches, results, attempts_used, hints_used, cleared):
    conn.execute(
        """
        UPDATE mission_progress
        SET patches = %s, results = %s::jsonb, attempts_used = %s, hints_used = %s, cleared = %s
        WHERE operator_id = %s AND level_id = %s
        """,
        (patches, json.dumps(results), attempts_used, hints_used, cleared, operator_id, level_id),
    )


def reset_mission_progress(conn, operator_id, level_id):
    conn.execute(
        """
        UPDATE mission_progress
        SET patches = '{}', results = '{}', attempts_used = 0, hints_used = 0, cleared = false
        WHERE operator_id = %s AND level_id = %s
        """,
        (operator_id, level_id),
    )


def reset_all_progress(conn, operator_id):
    conn.execute(
        "DELETE FROM mission_progress WHERE operator_id = %s",
        (operator_id,),
    )
    conn.execute(
        "UPDATE operators SET xp_total = 0, elo = 1200 WHERE id = %s",
        (operator_id,),
    )


def all_mission_progress(conn, operator_id):
    return conn.execute(
        "SELECT * FROM mission_progress WHERE operator_id = %s", (operator_id,)
    ).fetchall()


def cleared_level_ids(conn, operator_id):
    rows = conn.execute(
        "SELECT level_id FROM mission_progress WHERE operator_id = %s AND cleared = true",
        (operator_id,),
    ).fetchall()
    return {r["level_id"] for r in rows}


def claim_first_blood_if_free(conn, level_id, event_id, operator_id, attack_id) -> bool:
    row = conn.execute(
        """
        INSERT INTO first_blood (level_id, event_id, operator_id, attack_id)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (level_id, event_id) DO NOTHING
        RETURNING operator_id
        """,
        (level_id, event_id or GLOBAL_EVENT_ID, operator_id, attack_id),
    ).fetchone()
    return row is not None


def first_blood_claims(conn, event_id=None) -> dict:
    rows = conn.execute(
        "SELECT level_id, operator_id, attack_id FROM first_blood WHERE event_id = %s",
        (event_id or GLOBAL_EVENT_ID,),
    ).fetchall()
    return {r["level_id"]: r for r in rows}


def record_activity(conn, operator_id, kind, level_id=None, detail=None, event_id=None):
    conn.execute(
        "INSERT INTO activity_log (operator_id, event_id, kind, level_id, detail) VALUES (%s, %s, %s, %s, %s)",
        (operator_id, event_id, kind, level_id, detail),
    )


def recent_activity(conn, limit=20, event_id=None):
    if event_id:
        return conn.execute(
            """
            SELECT a.ts, a.kind, a.level_id, a.detail, o.display_name
            FROM activity_log a JOIN operators o ON o.id = a.operator_id
            WHERE a.event_id = %s ORDER BY a.ts DESC LIMIT %s
            """,
            (event_id, limit),
        ).fetchall()
    return conn.execute(
        """
        SELECT a.ts, a.kind, a.level_id, a.detail, o.display_name
        FROM activity_log a JOIN operators o ON o.id = a.operator_id
        ORDER BY a.ts DESC LIMIT %s
        """,
        (limit,),
    ).fetchall()


def active_operator_count(conn, minutes=2):
    row = conn.execute(
        "SELECT count(*) AS n FROM sessions WHERE last_seen > now() - (%s || ' minutes')::interval",
        (minutes,),
    ).fetchone()
    return row["n"]


# Sort column is picked from a fixed allow-list and composed with
# sql.Identifier, so it is always quoted as a column name, never raw text.
_SORT_COLUMNS = {"xp": "xp_total", "elo": "elo"}


def _sort_column(sort: str) -> str:
    return _SORT_COLUMNS.get(sort, "xp_total")


def top_leaderboard(conn, sort="xp", limit=20, event_id=None):
    column = _sort_column(sort)
    if event_id:
        query = sql.SQL(
            """
            SELECT o.id, o.display_name, o.xp_total, o.elo,
                   RANK() OVER (ORDER BY {col} DESC) AS rank
            FROM event_participants ep JOIN operators o ON o.id = ep.operator_id
            WHERE ep.event_id = %s AND o.is_guest = false
            ORDER BY {col} DESC LIMIT %s
            """
        ).format(col=sql.Identifier("o", column))
        return conn.execute(query, (event_id, limit)).fetchall()
    query = sql.SQL(
        """
        SELECT id, display_name, xp_total, elo,
               RANK() OVER (ORDER BY {col} DESC) AS rank
        FROM operators WHERE is_guest = false
        ORDER BY {col} DESC LIMIT %s
        """
    ).format(col=sql.Identifier(column))
    return conn.execute(query, (limit,)).fetchall()


def operator_rank(conn, operator_id, sort="xp"):
    query = sql.SQL(
        """
        SELECT rank FROM (
            SELECT id, RANK() OVER (ORDER BY {col} DESC) AS rank
            FROM operators WHERE is_guest = false
        ) ranked WHERE id = %s
        """
    ).format(col=sql.Identifier(_sort_column(sort)))
    row = conn.execute(query, (operator_id,)).fetchone()
    return row["rank"] if row else None


def create_event(conn, created_by, name, join_code):
    return conn.execute(
        "INSERT INTO events (join_code, name, created_by) VALUES (%s, %s, %s) RETURNING *",
        (join_code, name, created_by),
    ).fetchone()


def get_event_by_code(conn, join_code):
    return conn.execute(
        "SELECT * FROM events WHERE join_code = %s",
        (join_code,),
    ).fetchone()


def join_event(conn, event_id, operator_id, display_name):
    conn.execute(
        """
        INSERT INTO event_participants (event_id, operator_id, display_name)
        VALUES (%s, %s, %s)
        ON CONFLICT (event_id, operator_id) DO UPDATE SET display_name = EXCLUDED.display_name
        """,
        (event_id, operator_id, display_name),
    )


def event_participant_count(conn, event_id):
    row = conn.execute(
        "SELECT count(*) AS n FROM event_participants WHERE event_id = %s", (event_id,)
    ).fetchone()
    return row["n"]
