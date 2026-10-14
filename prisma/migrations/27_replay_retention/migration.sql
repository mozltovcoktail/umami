CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  FOR existing_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'umami-replay-retention'
  LOOP
    PERFORM cron.unschedule(existing_job_id);
  END LOOP;

  PERFORM cron.schedule(
    'umami-replay-retention',
    '15 7 * * *',
    $job$
      DELETE FROM public.session_replay AS replay
      WHERE replay.created_at < now() - interval '30 days'
        AND NOT EXISTS (
          SELECT 1
          FROM public.session_replay_saved AS saved
          WHERE saved.website_id = replay.website_id
            AND saved.visit_id = replay.visit_id
        );
    $job$
  );
END $$;
