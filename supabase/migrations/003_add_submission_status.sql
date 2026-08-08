ALTER TABLE public.task_submissions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'submitted';

NOTIFY pgrst, 'reload schema';
