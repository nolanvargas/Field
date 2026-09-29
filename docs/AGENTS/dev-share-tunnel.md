# Shared dev tunnel (`npm run dev:share`)

Day-to-day work stays on `npm run dev` / `dev:local`. Share only when someone off this machine needs a link.

- Builds a production preview (`dist-tunnel/`, gitignored) and serves it behind `scripts/dev-tunnel-gate.mjs`, then a Cloudflare quick tunnel.
- The Development page is absent (`import.meta.env.DEV` is false). Do not expect `/development` on a shared link.
- Browser requests stay on relative `/api` so the gate covers the API. Vite `preview.proxy` forwards `/api` to `127.0.0.1:3000`.
- Password lives in `%TEMP%\field-dev-tunnel-password.txt` (or `DEV_TUNNEL_PASSWORD`). Never commit it.
- If local `npm run dev` is already up, the share command reuses that API and Ctrl+C does not stop it.
