# Cloudflare Workers deployment

This fork can run Umami on Cloudflare Workers with its analytics database in Supabase Postgres. It does not use D1. Cloudflare Hyperdrive supplies pooled Postgres connections to the Worker.

## Cloudflare setup

1. Create a Hyperdrive configuration that connects to the Supabase Postgres endpoint. Use a database connection string with TLS enabled. Put its ID in `wrangler.jsonc` under `hyperdrive` as the `HYPERDRIVE` binding. Each account needs its own Hyperdrive config.
2. Keep `wrangler.jsonc`'s `name` unique to the account. The default deploy URL is the matching `workers.dev` hostname.
3. Set the Worker secrets:

   ```sh
   pnpm exec wrangler secret put DATABASE_URL
   pnpm exec wrangler secret put APP_SECRET
   ```

   `DATABASE_URL` is used for Prisma schema selection and non-Worker tooling; database queries inside the Worker use `HYPERDRIVE`. Use a long, random `APP_SECRET` and keep it private.

4. Apply Umami's migrations to the Supabase database before the first request:

   ```sh
   DATABASE_URL='your-supabase-postgres-url' pnpm db:migrate
   ```

## Connect coding agents

The self-hosted read-only MCP endpoint is enabled at `/mcp`. In Umami, create an API key under **Settings → API keys**, then configure Codex or Claude Code to connect to `https://<your-worker>.workers.dev/mcp` with `Authorization: Bearer umami_<api-key>`. The key only grants the access of its owner; revoke it in Umami to disconnect an agent.

## Build and deploy

Install the repo's pinned dependencies, then build and deploy:

```sh
pnpm install --frozen-lockfile
pnpm build:cloudflare
pnpm exec wrangler deploy
```

For local Worker preview, set `.dev.vars` with the usual Umami variables and set `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` to a local Postgres URL, as Wrangler's Hyperdrive emulator requires a local database URL.
