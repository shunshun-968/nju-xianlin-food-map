-- Run as deployment owner after migrations/restores. This group role never bypasses RLS.
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='foodmap_reader') THEN CREATE ROLE foodmap_reader NOLOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA app TO foodmap_reader;
GRANT SELECT ON app.venues,app.floors,app.stalls,app.dishes,app.settings TO foodmap_reader;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='foodmap_api') THEN GRANT foodmap_reader TO foodmap_api; END IF;
END $$;
