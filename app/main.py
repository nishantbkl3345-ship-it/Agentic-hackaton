from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.report import build_report
from app.scanner import scan_repo

app = FastAPI(title="SentinelLLM")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Latest built report; replaced by /scan now, and by the attack run in Phase 7.
LAST_REPORT = build_report([], [])


class ScanRequest(BaseModel):
    path: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/scan")
def scan(req: ScanRequest):
    global LAST_REPORT
    findings = scan_repo(req.path)
    LAST_REPORT = build_report(findings, LAST_REPORT["attacks"])
    return findings


@app.get("/report")
def report():
    return LAST_REPORT
