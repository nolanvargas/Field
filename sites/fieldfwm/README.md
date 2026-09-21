# fieldwm.com — coming soon

Static placeholder styled like the Field web app (sidebar + main). Not part of the Vite app.

**Domain:** This AWS account has **fieldwm.com** (not `fieldfwm.com`). Site copy uses `fieldwm.com`.

## Preview

```bash
npm run fieldfwm:serve
```

## Publish

1. `aws login` (or your SSO profile).
2. Copy `deploy.env.example` → `deploy.local.env` (gitignored) if not already set.
3. `npm run fieldfwm:deploy`

Production (already provisioned): bucket `fieldwm-www-443357567563`, CloudFront `EHFLQWRMXR11B`, cert in ACM us-east-1.

## First-time AWS

See agent note `docs/AGENTS/fieldfwm-www-site.md` if reprovisioning elsewhere.
