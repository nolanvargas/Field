# Local and shared development

Two commands. Use one or the other.

| | Local only | Shared |
| --- | --- | --- |
| Command | `npm run dev:local` | `npm run dev:share` |
| Open it at | http://localhost:5173 | The link printed in the terminal |
| Development page | Yes | No |
| Who can open it | This computer | Anyone with the link and the password |

`npm run dev` is the same as `npm run dev:local`.

Start Postgres first if it is not already running:

```powershell
docker compose up -d
```

## Local only

```powershell
npm run dev:local
```

Open http://localhost:5173. This is your normal workspace, including the Development page. Stop it with Ctrl+C, or run `npm run dev:stop`.

## Shared

```powershell
npm run dev:share
```

This builds a production copy of the app, serves that copy on this PC, asks for a password, and publishes it with a Cloudflare quick tunnel. The terminal prints the public link and the password when the tunnel is ready.

The Development page is not in this copy. Leave this terminal open. Ctrl+C closes the public link.

The link is a new `https://….trycloudflare.com` address every time you start the command. It is free and does not need a Cloudflare account. It stays up only while that terminal is running.

If `npm run dev:local` is already running, the shared site uses that API. Ctrl+C on the shared command leaves your local app running. If the local app was not running, the shared command starts the API too, and Ctrl+C stops it.

After you change code, stop the shared command and start it again. It rebuilds before it publishes.

The password is saved on this PC in `%TEMP%\field-dev-tunnel-password.txt`. It is not in the repo. To change it, edit that file and start `npm run dev:share` again.

Cloudflare’s program is `%TEMP%\cloudflared.exe`. The command tells you where to download it if that file is missing.
