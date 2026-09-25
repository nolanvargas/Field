# Authentication

Field supports **multiple web identity sources**. Each organization configures which provider(s) its users sign in through. **Microsoft Entra ID** is the first implemented provider — not the architectural center. New providers (Okta, Google Workspace, SAML/OIDC brokers, etc.) should plug in the same way Entra does today.

Mobile (Capacitor) supports **two mutually exclusive sign-in modes** (see [capability matrix](mobile-auth-capability-matrix.md)):

1. **QR activation** — durable device session for crew execution; remotely revocable.
2. **IdP sign-in** — same Entra (or future web provider) JWT as desktop; full org tools when permissions allow.

Only one mode is stored on a device at a time.

## Clients

| Client | Auth | Users |
| ------ | ---- | ----- |
| **Web** | Required — provider chosen per org | Task creators; extra keys for Users / Management / Crew map |
| **Mobile** | **IdP or QR** (one active mode) | Crew (QR); owners/coordinators (IdP) |

## Web: pluggable identity providers

### Model

1. **Org-scoped configuration** — each tenant picks an identity source (type + provider-specific settings). Users in that org authenticate through that source.
2. **Provider modules** — each source implements the same contract:
   - **Client:** initiate login (redirect, popup, etc.) and obtain a Bearer token for API calls.
   - **API:** verify the token (JWKS, introspection, or equivalent) and map claims to a stable subject id + email/name.
   - **User sync:** upsert `users` from verified claims (`POST /api/auth/session` today).
3. **`users.id`** — UUID subject from the identity provider (e.g. Entra `oid`). Same linking rules for imports: match by email when id differs.
4. **Dev stub** — when no provider is configured, local user picker from `users` (unauthenticated API). Not a production path.

### Implemented providers

| Provider | Client | API | Status |
| -------- | ------ | --- | ------ |
| **Local stub** | User picker (`LoginPage`) | `requireWebAuth` no-op | Dev only |
| **Microsoft Entra ID** | MSAL (`src/auth/`, `AuthRoot`) | `verifyEntraToken` (`server/auth.mjs`) | First SSO module |
| *(others)* | — | — | Add as new modules |

Entra env vars (`VITE_AZURE_*`, `AZURE_*`) are **Entra-module configuration** used when org settings source is "Server environment". Per-org values are stored in `org_settings.web_auth_provider` / `web_auth_config` and editable under Management → Web sign-in.

### What not to do

- Do not hard-code Entra/MSAL assumptions in shared auth paths — gate provider-specific code behind the module boundary.
- Do not run IdP and QR device session **at the same time** on one device.
- Do not treat Amazon Cognito as the web auth layer (explicitly out of scope).

## Mobile: QR activation and IdP

**QR (device session)** — [SDD §7.2](sdd.md#72-mobile-qr-activation--durable-session-remotely-revocable):

- Shared private build shows **Sign in** or **Activate** when no session.
- Crew scans a QR → `POST /api/mobile/activate` → token stored in Capacitor Preferences (`field.mobileDeviceSession`).
- Admin can revoke remotely; next API call returns `401` and the app clears device session.

**IdP (native)**:

- MSAL with custom URL scheme redirect (`field://auth`); token cache in WebView `localStorage`.
- Mode flag `field.nativeAuthMode` = `idp` in Preferences.
- API Bearer is a verified JWT (`req.auth.identity`); same rules as web.
- Sign-out clears MSAL cache and mode flag.

When web SSO is enabled, Bearer may be a **JWT** or a **device session token** (never both on the client).

### Entra mobile redirect URIs

Register in the Entra app registration (in addition to web origins):

- `field://auth` (Android/iOS Capacitor redirect)

## Authorization

`users.role` is a label only. Extra access uses `users.permissions` (`manage_users`, `manage_org`, `view_crew_map`). Do not gate on `role === 'admin'` or `role === 'crew'`.

New users from any web provider get an empty role and no extra keys. If nobody has `manage_users`, the first insert is bootstrapped with all extra keys.

## Code map (current)

| Layer | Location | Notes |
| ----- | -------- | ----- |
| Web gate | `src/auth/AuthRoot.tsx` | Web stub/Entra; native Entra when `nativeAuthMode=idp` |
| Native mode | `src/auth/nativeAuthMode.ts` | `idp` \| `device` in Preferences |
| Mobile gate | `src/auth/MobileAuthGate.tsx` | IdP session or device session or picker |
| Entra client | `src/auth/msalConfig.ts`, `token.ts`, `EntraSignedIn.tsx` | Entra module only |
| API middleware | `server/auth.mjs` | `requireWebAuth`, token verify dispatch, user upsert |
| Entra module | `server/auth/providers/entra.mjs`, `src/auth/msalConfig.ts` | First web SSO provider |
| Provider registry | `server/auth/webAuth.mjs`, `src/auth/config.ts` | `getActiveWebAuthProvider`, `isWebAuthEnabled` |
| Public config API | `GET /api/auth/config` | Auth-exempt; returns provider + client-safe settings |
| Mobile session | `server/mobileAuth.mjs`, `src/auth/mobileSession.ts` | Independent of web providers |

When adding a provider, add client + server modules and register them in org settings — do not extend Entra-specific helpers for other IdPs.
