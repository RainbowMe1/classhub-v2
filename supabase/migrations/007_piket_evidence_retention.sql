ALTER TABLE public.piket_submissions
  ALTER COLUMN evidence_path DROP NOT NULL;

ALTER TABLE public.piket_submissions
  ADD COLUMN IF NOT EXISTS deleted_evidence_path TEXT;

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

NOTIFY pgrst, 'reload schema';
