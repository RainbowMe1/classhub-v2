-- Storage Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('posts', 'posts', false, 52428800, ARRAY['image/jpeg','image/png','image/webp','video/mp4']),
  ('stories', 'stories', false, 52428800, ARRAY['image/jpeg','image/png','image/webp','video/mp4']),
  ('chat', 'chat', false, 20971520, ARRAY['image/jpeg','image/png','application/pdf']),
  ('tasks', 'tasks', false, 52428800, ARRAY['image/jpeg','image/png','application/pdf']),
  ('gallery', 'gallery', true, 104857600, ARRAY['image/jpeg','image/png','image/webp','video/mp4'])
ON CONFLICT (id) DO NOTHING;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_own_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "posts_auth_read" ON storage.objects FOR SELECT USING (bucket_id = 'posts' AND auth.role() = 'authenticated');
CREATE POLICY "posts_own_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "stories_auth_read" ON storage.objects FOR SELECT USING (bucket_id = 'stories' AND auth.role() = 'authenticated');
CREATE POLICY "stories_own_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "chat_auth" ON storage.objects FOR ALL USING (bucket_id = 'chat' AND auth.role() = 'authenticated') WITH CHECK (bucket_id = 'chat' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "tasks_auth" ON storage.objects FOR SELECT USING (bucket_id = 'tasks' AND auth.role() = 'authenticated');
CREATE POLICY "tasks_own_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tasks' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "gallery_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'gallery');
CREATE POLICY "gallery_auth_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'gallery' AND auth.role() = 'authenticated');
