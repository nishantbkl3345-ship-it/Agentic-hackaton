"""Password hashing and the guest-by-default session cookie.

Every visitor gets an operator row and a session immediately, with no login
wall: current_operator() creates a guest the first time it sees a request
with no valid session cookie. Signing up later converts that same operator
row in place (see db.convert_guest_to_account), which is how XP earned
before signup carries over without a migration step.
"""

import bcrypt
from fastapi import Request, Response

from app.db import create_guest_operator, create_session, get_conn, get_operator_by_session

SESSION_COOKIE = "sid"
SESSION_MAX_AGE = 60 * 60 * 24 * 30


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        max_age=SESSION_MAX_AGE,
    )


def current_operator(request: Request, response: Response) -> dict:
    token = request.cookies.get(SESSION_COOKIE)
    with get_conn() as conn:
        operator = get_operator_by_session(conn, token)
        if operator:
            return operator
        operator = create_guest_operator(conn)
        new_token = create_session(conn, operator["id"])
    set_session_cookie(response, new_token)
    return operator
