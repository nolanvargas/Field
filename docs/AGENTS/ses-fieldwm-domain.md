# SES on fieldwm.com

- **Region:** `us-west-1` (matches `server/email.mjs` default `AWS_REGION`).
- **Account:** `443357567563` — domain identity `fieldwm.com` (SESv2), verified via Easy DKIM CNAMEs in Route53 hosted zone `Z09699482HILYJ6F9I79S`.
- **DNS:** Three `*_domainkey` CNAMEs → `*.dkim.amazonses.com`; apex TXT `v=spf1 include:amazonses.com ~all`.
- **Sandbox:** `ProductionAccessEnabled` was false at setup — can only send to verified recipient addresses until production access is granted in the SES console.
- **App env:** `EMAIL_PROVIDER=ses`, `EMAIL_FROM=` an `@fieldwm.com` address (domain identity covers any local-part), `AWS_REGION=us-west-1`. Smoke: `EMAIL_TEST_TO=verified@… npm run email:test`.
