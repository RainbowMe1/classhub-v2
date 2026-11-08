CREATE TABLE IF NOT EXISTS public.agendas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  location TEXT,
  category TEXT NOT NULL DEFAULT 'umum'
    CHECK (category IN ('umum', 'ujian', 'libur', 'acara')),
  created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.agendas
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS event_time TIME,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'umum',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.agendas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agendas_authenticated_read" ON public.agendas;
CREATE POLICY "agendas_authenticated_read"
  ON public.agendas FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public.tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT,
  url TEXT NOT NULL,
  cover_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

CREATE INDEX IF NOT EXISTS agendas_event_date_idx
  ON public.agendas (event_date, event_time);
CREATE INDEX IF NOT EXISTS tracks_sort_order_idx
  ON public.tracks (sort_order, created_at DESC);

UPDATE public.tracks AS track
SET sort_order = ordered.position
FROM (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at DESC, id) - 1)::INTEGER AS position
  FROM public.tracks
) AS ordered
WHERE track.id = ordered.id
  AND track.sort_order = 0;

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tracks_authenticated_read" ON public.tracks;
CREATE POLICY "tracks_authenticated_read"
  ON public.tracks FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION public.prevent_client_managed_content_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() IS NOT NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'This content can only be changed through authorized server actions';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agendas_server_managed_mutation ON public.agendas;
CREATE TRIGGER agendas_server_managed_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.agendas
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_client_managed_content_mutation();

DROP TRIGGER IF EXISTS tracks_server_managed_mutation ON public.tracks;
CREATE TRIGGER tracks_server_managed_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.tracks
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_client_managed_content_mutation();

CREATE TABLE IF NOT EXISTS public.playlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  track_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.playlists
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS track_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "playlists_owner_read" ON public.playlists;
DROP POLICY IF EXISTS "playlists_owner_insert" ON public.playlists;
DROP POLICY IF EXISTS "playlists_owner_update" ON public.playlists;
DROP POLICY IF EXISTS "playlists_owner_delete" ON public.playlists;
CREATE POLICY "playlists_owner_read"
  ON public.playlists FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "playlists_owner_insert"
  ON public.playlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "playlists_owner_update"
  ON public.playlists FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "playlists_owner_delete"
  ON public.playlists FOR DELETE
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS playlists_user_id_idx
  ON public.playlists (user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'music',
  'music',
  true,
  8388608,
  ARRAY[
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/ogg',
    'audio/opus',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'authenticated'
    AND auth.uid() = OLD.user_id
    AND (
      to_jsonb(NEW)->'role' IS DISTINCT FROM to_jsonb(OLD)->'role'
      OR to_jsonb(NEW)->'is_banned' IS DISTINCT FROM to_jsonb(OLD)->'is_banned'
      OR to_jsonb(NEW)->'root_admin' IS DISTINCT FROM to_jsonb(OLD)->'root_admin'
    )
  THEN
    RAISE EXCEPTION 'Only server-authorized staff can change profile access fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

NOTIFY pgrst, 'reload schema';
