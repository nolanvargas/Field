# Mobile auth capability matrix

Native app supports **one active auth mode at a time**: IdP (work account) **or** QR device session, not both.

| Capability | QR device session | IdP (JWT) |
|------------|-------------------|-----------|
| Assigned crew execution (status, complete, deliver, attachments, GPS) | Yes | Yes |
| Task list scope | Own assigned/created only | Permissions + filters (`view_all_tasks`) |
| Create / edit / cancel / clone / restore tasks | No | Yes (with permissions) |
| Users, issue QR, revoke devices | No | Yes (`manage_users`) |
| Management, org settings, logo | No | Yes (`manage_org`) |
| Crew map | No | Yes (`view_crew_map`) |
| Bulk import | No | Yes (`manage_org`) |
| FCM crew push (v1) | Yes | Deferred |

## Parity checklist (implementation)

- [x] Docs: `docs/auth.md`, `AGENTS.md`, this matrix
- [x] API: `assertRequiresIdpIdentity` on privileged routes; device scoping unchanged
- [x] Native IdP: MSAL + `nativeAuthMode`, dual login picker, token provider, 401 handling
- [x] UI: auth-kind gates (not viewport-only) for Users, Crew map, nav, Tasks coordinator tools
- [x] FCM: register only in device mode; IdP documented
- [x] Tests: auth helpers + integration JWT vs device
