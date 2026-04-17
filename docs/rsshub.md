# RSSHub (Hugging Face Space)

RSSHub is deployed externally on a Hugging Face Space. This project does NOT host RSSHub; it reads from the Space via HTTPS.

**Space URL:** `https://lurnings-rsshub.hf.space`

## Environment Variables

| Variable            | Where it's set                                                                                     | Purpose                                      |
| ------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `RSSHUB_BASE_URL`   | Vercel (Preview+Production), Trigger.dev Cloud, `.env.local`                                       | Base URL of the Space                        |
| `RSSHUB_ACCESS_KEY` | Vercel (Preview+Production), Trigger.dev Cloud, `.env.local`, **HF Space secrets (as ACCESS_KEY)** | Auth query parameter on every RSSHub request |

All three vaults must hold the **same** value for `RSSHUB_ACCESS_KEY`. Variable name `RSSHUB_ACCESS_KEY` in vaults; inside the HF Space UI it's named `ACCESS_KEY`.

## Hardened Defaults (D-04)

The HF Space must have these env vars set:

```
ALLOW_USER_HOTLINK=false
DISALLOW_ROBOT=true
REQUEST_RETRY=2
CACHE_EXPIRE=900
CACHE_CONTENT_EXPIRE=3600
ACCESS_KEY=<secret>
```

RSSHub uses its in-process memory cache (no Redis backing). Cache is ephemeral across Space restarts — acceptable for hourly polling.

## Key Rotation Runbook (D-02)

Prior ACCESS_KEY values have been exposed in planning chat transcripts. Rotate every time any of:

- A secret appeared in `.planning/`, chat transcripts, or git history
- A contributor leaves the project
- The value appears in an error log

**Steps:**

1. Generate a new UUID v4: `uuidgen` (or `python -c "import uuid; print(uuid.uuid4())"`).
2. HF Space → Settings → Variables and secrets → `ACCESS_KEY` → set new value → Save → Restart the Space.
3. Vercel Dashboard → Project → Settings → Environment Variables → update `RSSHUB_ACCESS_KEY` for Production AND Preview → Save.
4. Trigger.dev Cloud → Project → Environment Variables → update `RSSHUB_ACCESS_KEY` for dev AND prod → Save.
5. `.env.local` on every developer laptop: update manually.
6. Verify: `curl https://<vercel-url>/api/health` should return 200 with `rsshub: "ok"`. If 503 with rsshub error, a vault update was missed.

## Cold-Start Behavior (D-05)

HF Spaces sleep after ~48h of inactivity. First request takes 30-60s. The `/api/health` route and `src/lib/rsshub.ts` wrapper issue a fire-and-forget warmup before the measured call, with a 60s timeout budget.

If cold-starts become operationally disruptive in Phase 2+, consider adding a 10-minute keep-alive cron (deferred item in CONTEXT.md).

## Operational Limits

- **No redeploy from this repo** — the HF Space is deployed separately; this repo only reads from it.
- **Do NOT commit the ACCESS_KEY anywhere.** Pre-commit hook (`.husky/pre-commit`) blocks UUID-shaped tokens. If a commit is blocked, the key is staged — remove it.
- **If the Space disappears** (account deletion, quota), provision Railway or Hetzner per the deferred option in CONTEXT.md.
