ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;

CREATE TABLE IF NOT EXISTS public.contact_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('saran', 'kritik')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'baru' CHECK (status IN ('baru', 'ditinjau', 'selesai')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contact_feedback
  ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'baru',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.contact_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contact_feedback_admin_read" ON public.contact_feedback;
CREATE POLICY "contact_feedback_admin_read"
  ON public.contact_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.user_id = auth.uid()
        AND profile.role = 'admin'
        AND profile.is_banned = false
    )
  );

CREATE INDEX IF NOT EXISTS contact_feedback_created_at_idx
  ON public.contact_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS contact_feedback_status_idx
  ON public.contact_feedback (status, created_at DESC);

NOTIFY pgrst, 'reload schema';
