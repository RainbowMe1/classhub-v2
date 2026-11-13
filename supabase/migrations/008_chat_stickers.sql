CREATE TABLE IF NOT EXISTS public.chat_stickers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  file_path TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'gif')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, file_path)
);

ALTER TABLE public.chat_stickers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_stickers_authenticated_read" ON public.chat_stickers;
CREATE POLICY "chat_stickers_authenticated_read"
  ON public.chat_stickers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION public.enforce_chat_sticker_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  IF (SELECT COUNT(*) FROM public.chat_stickers WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'Maksimal 5 stiker per pengguna';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_stickers_limit ON public.chat_stickers;
CREATE TRIGGER chat_stickers_limit
  BEFORE INSERT ON public.chat_stickers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_chat_sticker_limit();

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'chat';

NOTIFY pgrst, 'reload schema';
