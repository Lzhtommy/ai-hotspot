# Auth Providers & Deployment Runbook

> **Status (2026-04-23):** Phase 5 — active. Operational contract for GitHub / Google / Resend auth providers, Vercel env scoping, and admin promotion.

Covers the operational setup for GitHub OAuth, Google OAuth, Resend magic links, Vercel env scoping, admin promotion, and the preview-deployment OAuth smoke test. Sections 1–3 are one-time provider setup; §4 is repeated any time secrets rotate; §5 is the one-off admin-bootstrap playbook; §6 is the per-PR verification checklist.

## 1. GitHub OAuth App

1. Go to https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**
2. Fill in:
   - **Application name:** `AI Hotspot`
   - **Homepage URL:** `https://{production-domain}`
   - **Authorization callback URL:** `https://{production-domain}/api/auth/callback/github`
     - Register **only one** callback URL. All preview deployments route through production via `AUTH_REDIRECT_PROXY_URL` (see §4) — you do not need to register every Vercel preview URL.
3. Register the app. Note the **Client ID**. Click **Generate a new client secret** and save the secret immediately — it is shown exactly once.
4. Copy the Client ID into `GITHUB_CLIENT_ID` in Vercel (all scopes). Copy the secret into `GITHUB_CLIENT_SECRET` in Vercel (all scopes).

**Rotation:** clicking **Generate a new client secret** again revokes the previous secret after a 30-day grace period. Update Vercel immediately after rotation.

## 2. Google OAuth App

1. Go to https://console.cloud.google.com → **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth client ID** → **Web application**
3. Under **Authorized redirect URIs**, add: `https://{production-domain}/api/auth/callback/google`
   - Again, one URI only. Previews proxy through production.
4. Save. Copy **Client ID** + **Client Secret** into Vercel as `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (all scopes).

**OAuth consent screen (first-time only):** on the same project, configure the consent screen with the app name, support email, and a privacy-policy URL. `User type = External`. Scopes requested are the defaults (`openid`, `profile`, `email`) — no sensitive scopes, so no Google verification review is required.

## 3. Resend Domain Verification

For local dev and early preview testing, the Resend sandbox address `onboarding@resend.dev` works without any DNS setup. For production (and for any preview that needs real email deliverability), the sending domain must be verified.

1. Go to https://resend.com/domains → **Add Domain**
2. Enter the sending domain (e.g., `aihotspot.com` — the bare apex or a `mail.` subdomain).
3. Resend shows an SPF `TXT` record, a DKIM `CNAME` record, and (optionally) a DMARC `TXT` record. Copy all three into your DNS provider.
4. Wait for the green checkmark on each record in the Resend dashboard. Propagation typically completes in 10 minutes; allow up to 24 hours for slow resolvers.
5. Set `RESEND_FROM` in Vercel (all scopes) using the **Display Name \<email\>** format:
   ```
   AI Hotspot <noreply@aihotspot.com>
   ```
6. Set `RESEND_API_KEY` from https://resend.com/api-keys (all scopes).

**Pitfall:** Without a verified domain, Resend returns `403 domain not verified`; the magic-link server action surfaces this to the user as the generic `发送失败` error in `LoginPromptModal`. Confirm Resend's dashboard shows a green ✓ on all three DNS records before expecting magic links to land.

## 4. Vercel Env Scope Matrix

> **CRITICAL:** `AUTH_SECRET` must be **byte-identical** across Production + Preview + Development scopes. Different values silently break preview OAuth via the redirect proxy (RESEARCH §Pitfall 3 — the state-cookie HMAC signature signed in production fails to verify on preview).

| Variable                  | Production                    | Preview                             | Development                      |
| ------------------------- | ----------------------------- | ----------------------------------- | -------------------------------- |
| `AUTH_SECRET`             | **same value**                | **same value**                      | **same value**                   |
| `AUTH_URL`                | `https://{production-domain}` | _(unset — Auth.js uses VERCEL_URL)_ | `http://localhost:3000`          |
| `AUTH_REDIRECT_PROXY_URL` | _(unset)_                     | `https://{production}/api/auth`     | _(unset)_                        |
| `GITHUB_CLIENT_ID`        | set                           | set                                 | set                              |
| `GITHUB_CLIENT_SECRET`    | set                           | set                                 | set                              |
| `GOOGLE_CLIENT_ID`        | set                           | set                                 | set                              |
| `GOOGLE_CLIENT_SECRET`    | set                           | set                                 | set                              |
| `RESEND_API_KEY`          | set                           | set                                 | set                              |
| `RESEND_FROM`             | set (verified-domain address) | set (verified-domain address)       | set (`onboarding@resend.dev` OK) |

### Generating `AUTH_SECRET`

```bash
openssl rand -base64 32
```

Copy the output **once** and paste it into all three Vercel scopes (Production + Preview + Development) and into `.env.local`. Treat any mismatch as a deployment regression.

### Scope editing in Vercel

1. https://vercel.com/{team}/{project}/settings/environment-variables
2. **Add New** → enter Key + Value → under **Environments**, tick all three scopes.
3. For `AUTH_REDIRECT_PROXY_URL`, tick **only Preview**. Production reads `AUTH_URL` (or falls back to `VERCEL_URL`); production must NOT see a redirect proxy or Auth.js will loop.
4. **Save**. Trigger a redeploy of the affected environment — Vercel does not re-inject new env into running lambdas without a rebuild.

## 5. Admin Role Promotion (out-of-band SQL runbook)

v1 does **not** ship an admin-promotion UI or API (per `.planning/phases/05-auth-user-interactions/05-CONTEXT.md` §Deferred Ideas §Admin bootstrap). The first admin is created via direct SQL on the `users` table. Phase 6's admin dashboard will add an in-app promote/demote action; until then, this is the only way to grant the role.

### Prerequisites

- The target user has signed in at least once via the normal OAuth or magic-link flow, so their `users` row exists.
- You have direct `psql` access to the Neon production branch (Neon Console → **Connection Details** → copy the `psql` command).

### Promote

```sql
-- Connect: psql 'postgresql://...'
UPDATE users
SET role = 'admin'
WHERE email = 'admin-to-promote@example.com';
```

### Verify

```sql
SELECT id, email, role
FROM users
WHERE role = 'admin';
```

The user's next sign-in (or the next session-callback refresh, whichever is sooner) will surface `session.user.role = 'admin'` — Phase 6 admin route gating reads this field.

### Demote

```sql
UPDATE users
SET role = 'user'
WHERE email = 'formerly-admin@example.com';
```

Demotion does NOT invalidate an existing session — the role is re-read on each session callback (Auth.js DB strategy), so the next request after the UPDATE sees the new role. To force immediate invalidation, also delete the user's sessions:

```sql
DELETE FROM sessions WHERE "userId" = (SELECT id FROM users WHERE email = 'formerly-admin@example.com');
```

## 6. Preview OAuth Smoke Test

Run this checklist after deploying any Vercel preview that touches auth code.

1. Open the Vercel-generated preview URL (e.g., `https://{project}-{pr-hash}-{team}.vercel.app/`).
2. Click **登录** in the sidebar → `LoginPromptModal` opens.
3. Click **使用 GitHub 登录**.
4. Observe the redirect chain in the browser address bar:
   ```
   preview URL → github.com/login/oauth/authorize → production URL (AUTH_REDIRECT_PROXY_URL) → preview URL
   ```
   The cross-deployment hop through production is the redirect proxy doing its job.
5. Authorize the GitHub app. You should land back on the preview URL, signed in.
6. `UserChip` in the sidebar should now show your GitHub avatar + display name (not 登录).
7. Click `UserChip` → **退出登录** → confirm you return to the anonymous UI.
8. (Optional, if Resend is live for the preview) Reopen the modal, enter your email, click **发送登录链接**. Expect the `链接已发送` status. Check inbox, click the link, verify you return to the preview URL authenticated.

### Failure modes and fixes

| Symptom                                                 | Root cause                                                      | Fix                                                                                                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generic `Verification` error on callback; no other logs | `AUTH_SECRET` differs between prod and preview scopes           | Regenerate once with `openssl rand -base64 32`, set the identical value in all three Vercel scopes, redeploy both prod and preview.                        |
| GitHub returns `redirect_uri_mismatch`                  | Preview is hitting GitHub directly (proxy not used)             | Confirm `AUTH_REDIRECT_PROXY_URL` is set **in Preview scope only** and points at `https://{production}/api/auth`. Redeploy preview.                        |
| Callback 302s indefinitely / loops                      | GitHub OAuth app callback URL points at a preview URL, not prod | Edit GitHub OAuth app → set callback to `https://{production-domain}/api/auth/callback/github`. Remove any preview-URL callbacks.                          |
| `Email server connection failure` in magic-link submit  | `RESEND_API_KEY` unset or revoked                               | Re-issue key at https://resend.com/api-keys, update Vercel, redeploy.                                                                                      |
| `发送失败` toast on magic-link submit (other errors)    | `RESEND_FROM` uses a domain without green DNS                   | Verify domain in Resend dashboard (§3). `onboarding@resend.dev` is the safe fallback for preview.                                                          |
| `UserChip` shows 登录 after successful GitHub return    | Session cookie blocked (cross-site / SameSite)                  | Confirm preview URL and production share the same parent domain, or accept that preview cookies are scoped to each preview URL (default Auth.js behavior). |

## 7. Ban Enforcement Operational Notes

Banning a user is a one-line SQL UPDATE — v1 has no admin UI for this (Phase 6 will add one).

```sql
UPDATE users
SET is_banned = true
WHERE email = 'abusive-user@example.com';
```

The next request the banned user makes clears their session via the Plan 05-02 session callback (D-05 Layer 1 — `session()` returns `null` when `is_banned = true`). No logout is required from the user's side; the next page load drops them to anonymous.

### Unban

```sql
UPDATE users
SET is_banned = false
WHERE email = '...';
```

### Audit

```sql
SELECT id, email, role, is_banned, "updatedAt"
FROM users
WHERE is_banned = true
ORDER BY "updatedAt" DESC;
```

## 8. Final deployment checklist

Run through this before calling Phase 5 deployment "done" on any new environment:

- [ ] All 9 Phase 5 env vars set in Vercel Production + Preview + Development (see §4).
- [ ] `AUTH_SECRET` byte-identical across all three scopes (verified by pasting into each scope from the same clipboard buffer, not re-generating per scope).
- [ ] `AUTH_REDIRECT_PROXY_URL` set in **Preview only**, unset in Production and Development.
- [ ] GitHub OAuth app callback URL points at production `/api/auth/callback/github`.
- [ ] Google OAuth redirect URI points at production `/api/auth/callback/google`.
- [ ] Resend sending domain shows green DNS in dashboard (production) OR `RESEND_FROM=onboarding@resend.dev` is accepted (dev/preview).
- [ ] `.env.example` reflects all 9 variables and is in sync with this document (see §4 matrix).
- [ ] `next.config.ts → images.remotePatterns` allowlists `avatars.githubusercontent.com` + `lh3.googleusercontent.com` (RESEARCH §Pitfall 7).
- [ ] Preview OAuth smoke test (§6) passes end-to-end.
- [ ] First admin promoted via §5 if the environment is expected to exercise admin routes in Phase 6.

## References

- Auth.js v5 docs: https://authjs.dev
- Redirect proxy deployment: https://authjs.dev/getting-started/deployment
- Resend Auth.js provider: https://authjs.dev/getting-started/providers/resend
- Phase 5 research (in-repo): `.planning/phases/05-auth-user-interactions/05-RESEARCH.md`
- Phase 5 context: `.planning/phases/05-auth-user-interactions/05-CONTEXT.md`
- Phase 5 patterns: `.planning/phases/05-auth-user-interactions/05-PATTERNS.md`
