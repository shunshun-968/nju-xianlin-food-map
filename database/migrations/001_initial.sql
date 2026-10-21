-- Portable PostgreSQL 16+. Business IDs are independent from authentication providers.
CREATE SCHEMA app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
CREATE TABLE app.settings (id boolean PRIMARY KEY DEFAULT true CHECK (id), read_only boolean NOT NULL DEFAULT false);
INSERT INTO app.settings DEFAULT VALUES;
CREATE TABLE app.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','moderator','admin')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.auth_identities (
  provider text NOT NULL, subject text NOT NULL, user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  PRIMARY KEY(provider,subject), UNIQUE(provider,user_id)
);
CREATE TABLE app.venues (
  id text PRIMARY KEY, name text NOT NULL, short_name text NOT NULL, area text NOT NULL,
  kind text NOT NULL CHECK(kind IN ('canteen','cart')), description text NOT NULL DEFAULT '',
  campus_x double precision NOT NULL, campus_z double precision NOT NULL,
  footprint_width double precision NOT NULL CHECK(footprint_width>0), footprint_depth double precision NOT NULL CHECK(footprint_depth>0),
  longitude double precision CHECK(longitude BETWEEN -180 AND 180), latitude double precision CHECK(latitude BETWEEN -90 AND 90),
  coordinate_system text NOT NULL DEFAULT 'CAMPUS_SCHEMATIC_V1', verified boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false, CHECK((longitude IS NULL)=(latitude IS NULL))
);
CREATE TABLE app.floors (
  id text PRIMARY KEY, venue_id text NOT NULL REFERENCES app.venues(id) ON DELETE RESTRICT,
  level integer NOT NULL, name text NOT NULL, width double precision NOT NULL CHECK(width>0), depth double precision NOT NULL CHECK(depth>0),
  elevation double precision NOT NULL, layout_version integer NOT NULL DEFAULT 1 CHECK(layout_version>0), model_key text,
  UNIQUE(venue_id,level), UNIQUE(id,layout_version)
);
CREATE TABLE app.stalls (
  id text PRIMARY KEY, floor_id text NOT NULL, layout_version integer NOT NULL DEFAULT 1,
  name text NOT NULL, category text NOT NULL, x double precision NOT NULL, z double precision NOT NULL,
  rotation_y double precision NOT NULL DEFAULT 0, width double precision NOT NULL CHECK(width>0), depth double precision NOT NULL CHECK(depth>0),
  FOREIGN KEY(floor_id,layout_version) REFERENCES app.floors(id,layout_version) ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE TABLE app.dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), stall_id text NOT NULL REFERENCES app.stalls(id) ON DELETE CASCADE,
  name text NOT NULL, description text NOT NULL DEFAULT '', price_fen integer CHECK(price_fen>=0), available boolean NOT NULL DEFAULT true
);
CREATE TABLE app.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
  stall_id text NOT NULL REFERENCES app.stalls(id) ON DELETE CASCADE, body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.ratings (
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE, stall_id text NOT NULL REFERENCES app.stalls(id) ON DELETE CASCADE,
  score smallint NOT NULL CHECK(score BETWEEN 1 AND 5), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,stall_id)
);
CREATE TABLE app.media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
  storage_key text NOT NULL UNIQUE CHECK(storage_key !~ '(^/|(^|/)\.\.(/|$)|[\\?#:])'),
  mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')), bytes bigint NOT NULL CHECK(bytes>0 AND bytes<=10485760),
  sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'), width integer NOT NULL CHECK(width>0), height integer NOT NULL CHECK(height>0),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  stall_id text REFERENCES app.stalls(id) ON DELETE CASCADE, dish_id uuid REFERENCES app.dishes(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES app.comments(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(num_nonnulls(stall_id,dish_id,comment_id)=1)
);
CREATE TABLE app.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reporter_id uuid NOT NULL REFERENCES app.users(id),
  comment_id uuid REFERENCES app.comments(id) ON DELETE CASCADE, media_id uuid REFERENCES app.media(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 1000), status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(), CHECK(num_nonnulls(comment_id,media_id)=1)
);
CREATE TABLE app.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid REFERENCES app.users(id), action text NOT NULL,
  target_id text NOT NULL, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX floors_venue_idx ON app.floors(venue_id);
CREATE INDEX stalls_floor_idx ON app.stalls(floor_id);
CREATE INDEX dishes_stall_idx ON app.dishes(stall_id);
CREATE INDEX comments_stall_status_idx ON app.comments(stall_id,status,created_at);
CREATE INDEX media_stall_status_idx ON app.media(stall_id,status);
CREATE INDEX ratings_stall_idx ON app.ratings(stall_id,status);
CREATE INDEX identities_user_idx ON app.auth_identities(user_id);

-- Shared lock remains held until transaction commit. Maintenance takes the exclusive lock,
-- waiting for already-started writes to finish before acknowledging the read-only transition.
CREATE FUNCTION app.reject_maintenance_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
BEGIN
  PERFORM pg_advisory_xact_lock_shared(781204);
  IF (SELECT read_only FROM app.settings WHERE id=true) THEN
    RAISE EXCEPTION 'READ_ONLY_MAINTENANCE' USING ERRCODE='55000';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE ALL ON FUNCTION app.reject_maintenance_write() FROM PUBLIC;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['users','auth_identities','venues','floors','stalls','dishes','comments','ratings','media','reports','audit_log'] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE TRIGGER maintenance_guard BEFORE INSERT OR UPDATE OR DELETE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.reject_maintenance_write()',t);
  END LOOP;
END $$;
ALTER TABLE app.settings ENABLE ROW LEVEL SECURITY;
-- Safe public read policies; no client write policies exist in Phase 0.
CREATE POLICY venues_public ON app.venues FOR SELECT USING(published);
CREATE POLICY floors_public ON app.floors FOR SELECT USING(EXISTS(SELECT 1 FROM app.venues v WHERE v.id=venue_id AND v.published));
CREATE POLICY stalls_public ON app.stalls FOR SELECT USING(EXISTS(SELECT 1 FROM app.floors f WHERE f.id=floor_id));
CREATE POLICY dishes_public ON app.dishes FOR SELECT USING(available AND EXISTS(SELECT 1 FROM app.stalls s WHERE s.id=stall_id));
CREATE POLICY settings_read ON app.settings FOR SELECT USING(true);
-- users, identities, moderation, comments, ratings and media stay private until a safe API exists.
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
