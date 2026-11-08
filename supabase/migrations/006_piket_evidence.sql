CREATE TABLE IF NOT EXISTS public.piket_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.piket_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "piket_entries_authenticated_read" ON public.piket_entries;
CREATE POLICY "piket_entries_authenticated_read"
  ON public.piket_entries FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public.piket_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  piket_entry_id UUID REFERENCES public.piket_entries(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  group_label TEXT NOT NULL,
  evidence_path TEXT NOT NULL UNIQUE,
  duty_date DATE NOT NULL DEFAULT ((NOW() AT TIME ZONE 'Asia/Jakarta')::date),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'rejected')),
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  UNIQUE (piket_entry_id, user_id, duty_date),
  CHECK (rejection_reason IS NULL OR char_length(rejection_reason) <= 500)
);

ALTER TABLE public.piket_submissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_piket_submission_time()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.evidence_path IS DISTINCT FROM OLD.evidence_path AND NEW.evidence_path IS NOT NULL THEN
    NEW.submitted_at := NOW();
    NEW.duty_date := (NOW() AT TIME ZONE 'Asia/Jakarta')::date;
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    OR (NEW.status IN ('verified', 'rejected') AND (
      NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
      OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
    ))
  THEN
    IF NEW.status IN ('verified', 'rejected') THEN
      NEW.reviewed_at := NOW();
    ELSE
      NEW.reviewed_at := NULL;
      NEW.reviewed_by := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS piket_submission_time ON public.piket_submissions;
CREATE TRIGGER piket_submission_time
  BEFORE UPDATE ON public.piket_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_piket_submission_time();

CREATE INDEX IF NOT EXISTS piket_submissions_date_status_idx
  ON public.piket_submissions (duty_date, status);
CREATE INDEX IF NOT EXISTS piket_submissions_user_date_idx
  ON public.piket_submissions (user_id, duty_date DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('piket-evidence', 'piket-evidence', false, 1572864, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 1572864,
    allowed_mime_types = ARRAY['image/jpeg'];

NOTIFY pgrst, 'reload schema';
