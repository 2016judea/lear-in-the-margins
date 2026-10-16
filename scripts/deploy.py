#!/usr/bin/env python3
"""Deploy site/ to Vercel over the REST API (no CLI on this Mac). Needs VERCEL_TOKEN.
site/ is the public page, sample and images; private/king_lear_course.pdf (the paid file)
goes up as api/_full/, bundled only with /api/download. site/r/ (per-recipient lines,
written by scripts/build_for_pages.py from the gitignored ledger) goes up but is never
committed. Enables Web Analytics on the project and prints the production aliases.
Ported from msp-house-index/scripts/deploy.py, 2026-10-16."""
import hashlib, os, sys, time
from pathlib import Path
import requests

TEAM = "team_XnhPzBEcaSfEmZFo9M2isLFY"
PROJECT = "lear-in-the-margins"
ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
PDF = ROOT / "private" / "king_lear_course.pdf"
H = {"Authorization": f"Bearer {os.environ['VERCEL_TOKEN']}"}
API = "https://api.vercel.com"


def upload(p, rel):
    b = p.read_bytes()
    sha = hashlib.sha1(b).hexdigest()
    r = requests.post(f"{API}/v2/files?teamId={TEAM}", data=b, timeout=120,
                      headers={**H, "x-vercel-digest": sha, "Content-Type": "application/octet-stream"})
    r.raise_for_status()
    return {"file": rel, "sha": sha, "size": len(b)}


assert PDF.exists(), "run scripts/build_edition.sh first: private/king_lear_course.pdf is what the paywall serves"
paths = [(p, str(p.relative_to(SITE))) for p in sorted(SITE.rglob("*"))
         if p.is_file() and not p.name.startswith(".") and "_full" not in p.parts]
paths.append((PDF, "api/_full/king_lear_course.pdf"))
paths.append((ROOT / "private" / "cover.pdf", "api/_full/cover.pdf"))
files = [upload(p, rel) for p, rel in paths]
print(f"uploaded {len(files)} files")
d = requests.post(f"{API}/v13/deployments?teamId={TEAM}&forceNew=1", headers=H, json={
    "name": PROJECT, "project": PROJECT, "target": "production", "files": files,
    "projectSettings": {"framework": None, "buildCommand": "echo build", "outputDirectory": ".", "installCommand": "echo skip"},
}).json()
print("deployment", d.get("id"), d.get("readyState"), d.get("error"))
if not d.get("id"):
    sys.exit(1)
for _ in range(200):
    s = requests.get(f"{API}/v13/deployments/{d['id']}?teamId={TEAM}", headers=H).json()
    if s.get("readyState") in ("READY", "ERROR"):
        break
    time.sleep(3)
print("state", s.get("readyState"))
prj = requests.get(f"{API}/v9/projects/{PROJECT}?teamId={TEAM}", headers=H).json()
if not (prj.get("webAnalytics") or {}).get("enabledAt"):
    print("analytics", requests.post(f"{API}/web/insights/toggle?projectId={prj['id']}&teamId={TEAM}", headers=H, json={"value": True}).json())
print("aliases", (prj.get("targets", {}).get("production") or {}).get("alias"))
