"""Postgres access for CRUCIBLE. Same idiom as app/db.py: sync psycopg3,
dict_row, hand-written parameterized SQL, no ORM."""

import json


def create_run(conn, operator_id, target: dict, target_key: str, configuration: dict) -> dict:
    return conn.execute(
        """
        INSERT INTO crucible_runs (operator_id, target, target_key, configuration)
        VALUES (%s, %s::jsonb, %s, %s::jsonb)
        RETURNING *
        """,
        (operator_id, json.dumps(target), target_key, json.dumps(configuration)),
    ).fetchone()


def get_run(conn, run_id):
    return conn.execute("SELECT * FROM crucible_runs WHERE id = %s", (run_id,)).fetchone()


def list_runs(conn, operator_id, target_key: str, limit=20):
    return conn.execute(
        """
        SELECT * FROM crucible_runs
        WHERE operator_id = %s AND target_key = %s AND status = 'completed'
        ORDER BY started_at DESC LIMIT %s
        """,
        (operator_id, target_key, limit),
    ).fetchall()


def complete_run(conn, run_id, scores: dict, status="completed"):
    conn.execute(
        """
        UPDATE crucible_runs SET status = %s, scores = %s::jsonb, completed_at = now()
        WHERE id = %s
        """,
        (status, json.dumps(scores), run_id),
    )


def record_test(conn, run_id, *, category, test_type, name, input=None, expected=None,
                 actual=None, status, severity=None, evidence=None, reason=None, latency_ms=None) -> dict:
    return conn.execute(
        """
        INSERT INTO crucible_tests
            (run_id, category, test_type, name, input, expected, actual, status, severity, evidence, reason, latency_ms)
        VALUES (%s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (run_id, category, test_type, name,
         json.dumps(input) if input is not None else None,
         json.dumps(expected) if expected is not None else None,
         json.dumps(actual) if actual is not None else None,
         status, severity, evidence, reason, latency_ms),
    ).fetchone()


def record_finding(conn, run_id, test_id, *, category, severity, title, description,
                    evidence=None, remediation=None) -> dict:
    return conn.execute(
        """
        INSERT INTO crucible_findings
            (run_id, test_id, category, severity, title, description, evidence, remediation)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (run_id, test_id, category, severity, title, description, evidence, remediation),
    ).fetchone()


def list_tests(conn, run_id, since_id=None, category=None):
    clauses = ["run_id = %s"]
    params = [run_id]
    if since_id:
        clauses.append("created_at > (SELECT created_at FROM crucible_tests WHERE id = %s)")
        params.append(since_id)
    if category:
        clauses.append("category = %s")
        params.append(category)
    where = " AND ".join(clauses)
    return conn.execute(
        f"SELECT * FROM crucible_tests WHERE {where} ORDER BY created_at", tuple(params)
    ).fetchall()


def list_findings(conn, run_id):
    return conn.execute(
        "SELECT * FROM crucible_findings WHERE run_id = %s ORDER BY severity, created_at", (run_id,)
    ).fetchall()


def get_finding(conn, finding_id):
    return conn.execute("SELECT * FROM crucible_findings WHERE id = %s", (finding_id,)).fetchone()


def get_test(conn, test_id):
    return conn.execute("SELECT * FROM crucible_tests WHERE id = %s", (test_id,)).fetchone()


def set_finding_status(conn, finding_id, status: str):
    conn.execute("UPDATE crucible_findings SET status = %s WHERE id = %s", (status, finding_id))


def test_counts(conn, run_id):
    rows = conn.execute(
        "SELECT category, status, count(*) AS n FROM crucible_tests WHERE run_id = %s GROUP BY category, status",
        (run_id,),
    ).fetchall()
    out = {}
    for r in rows:
        out.setdefault(r["category"], {})[r["status"]] = r["n"]
    return out
