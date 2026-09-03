# Contributing to Schedule-System

Team guide. Read once before your first push.

## Repo basics
- This is a **public** repo: anyone can view it. But it has **no open-source
  license** — the code is the team's ("all rights reserved"). Do not copy code
  from other projects into this repo without the team agreeing.
- `backend/` = Django REST API (the schedule engine). `core/` = Django settings.
  `frontend/` = React app (coming later).

## Rules of the road
1. Never push straight to `main` or `staging`. Always branch, then open a PR.
2. Pull the latest `staging` before you start each task.
3. Small branches, small commits, commit often.

## First-time setup
    git clone https://github.com/rkenbperez/Schedule-System.git
    cd Schedule-System/backend
    source .venv/bin/activate       # run INSIDE the backend/ folder
    python manage.py migrate
    python manage.py runserver

Open http://127.0.0.1:8000/api/schema/swagger-ui/ to see the API docs.

## Everyday flow (feature → PR)
    git checkout staging
    git pull origin staging
    git checkout -b feature/my-thing
    # ...make changes...
    git add -A
    git commit -m "feat: short description"
    git push origin feature/my-thing

Then on GitHub: **Compare & pull request** → base branch = `staging` → title =
your commit message → Create PR. Ask a teammate to review before merging.

## Check before you push
    cd backend
    python manage.py check          # no errors
    python manage.py makemigrations # only if you changed models
    python manage.py migrate
    python manage.py test           # all tests pass

## Commit messages
Format: `type: short summary`
- `feat:` new feature          good: `feat: Added user models`
- `fix:` bug fixes             bad:  `update`, `fixed stuff`
- `chore:` setup / no new code
- `docs:` documentation

## Branch names
- `feature/<what>` → `feature/availability-api`
- `fix/<what>`    → `fix/prof-overlap-bug`

## Tagging + Releases (milestones only, after merge)
    git checkout staging
    git pull origin staging
    git tag -a v0.2.0 -m "Phase 2: solver engines"
    git push origin v0.2.0        # tags are NOT sent by a normal git push

Then github.com → **Releases → Draft a new release** → pick the tag → add notes
→ Publish. These snapshots are what the thesis panel will see.

## Gotchas we hit already
- `source .venv/bin/activate` fails → you are in the repo root, not `backend/`.
- `git pull staging` is wrong → always `git pull origin staging`.
- `git push` says "no upstream" → use `git push origin <branch-name>`.
- Tag missing on GitHub after push → tags need their own `git push origin <tag>`.
