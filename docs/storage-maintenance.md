# Umami replay retention and storage alerts

Replay cleanup is installed as a Supabase Cron job. The `umami-storage-maintenance` Cloudflare Worker handles storage alerts:

- Every day at 07:15 UTC, Supabase deletes unsaved replay chunks older than 30 days. Saved replays remain available.
- At the top of every hour, the Worker checks `pg_database_size(current_database())`. It emails when usage reaches 80% of the configured database limit, escalates at 90%, and repeats an alert at most once per level every 24 hours. It clears the alert state below 75%.

The default limit is 500 MiB, matching Supabase's Free plan database-size quota. Update `DATABASE_SIZE_LIMIT_BYTES` in `wrangler.maintenance.jsonc` if the project plan or quota changes. The monitor includes total database size and replay-table size in its email.

## Email setup

The alert Worker sends from `umami-alerts@airpiehi.com` to `aaronmorrisprice@gmail.com` using Cloudflare Email Service. The deployed Email binding restricts messages to this recipient and sender.

## Build and deploy

```sh
pnpm build:cloudflare:maintenance
pnpm exec wrangler deploy --config wrangler.maintenance.jsonc
```

The replay-retention migration lives in `prisma/migrations/27_replay_retention`. The maintenance Worker shares the existing `HYPERDRIVE` binding and does not expose an HTTP route. Alert run history is available in Cloudflare Workers > Triggers > Cron Triggers; replay cleanup history is available in the Supabase Cron dashboard.
