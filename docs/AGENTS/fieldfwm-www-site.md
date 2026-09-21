# fieldfwm.com coming soon site

- **Live domain (this account):** **fieldwm.com** — registered in Route53; `fieldfwm.com` is not in this AWS account.
- **Source:** `sites/fieldfwm/` — single-page static HTML: Field brand rail (64px, logo only — not app nav) + light main; tokens aligned with `src/styles/tokens.css`. No faux nav or status pills.
- **Preview (live deploy copy):** `npm run fieldfwm:serve`
- **Deploy:** `npm run fieldfwm:deploy` with `sites/fieldfwm/deploy.local.env` (bucket `fieldwm-www-443357567563`, CloudFront `EHFLQWRMXR11B`).
- **Stack:** S3 (private) + CloudFront OAC + ACM (us-east-1) + Route53 aliases apex/`www`.
