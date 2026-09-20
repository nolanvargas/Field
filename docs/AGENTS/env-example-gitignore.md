# `.env.example` and `.gitignore`

`.gitignore` uses `.env.*` for local secrets. Without `!.env.example`, tools that respect ignore rules may hide the tracked template even though `git ls-files` still lists it.

Keep `!.env.example` immediately after `.env.*`.
