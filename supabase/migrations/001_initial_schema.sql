-- ClassHub Initial Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT UNIQUE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  role TEXT CHECK (role IN ('admin','teacher','student')) DEFAULT 'student',
  is_banned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  content TEXT,
  media_urls TEXT[] DEFAULT '{}',
  media_type TEXT CHECK (media_type IN ('image','video','none')),
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  target_type TEXT CHECK (target_type IN ('post','comment')),
  target_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('image','video','text')),
  caption TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE story_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, user_id)
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES profiles(user_id),
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  deadline TIMESTAMPTZ NOT NULL,
  attachment_url TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  note TEXT,
  grade INTEGER CHECK (grade >= 0 AND grade <= 100),
  feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_of_week INTEGER CHECK (day_of_week >= 1 AND day_of_week <= 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject TEXT NOT NULL,
  teacher_id UUID REFERENCES profiles(user_id),
  room TEXT,
  notes TEXT
);

CREATE TABLE duties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_of_week INTEGER CHECK (day_of_week >= 1 AND day_of_week <= 7),
  user_ids UUID[] DEFAULT '{}'
);

CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  subject TEXT,
  bio TEXT,
  avatar_url TEXT
);

CREATE TABLE gallery_albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE gallery_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID REFERENCES gallery_albums(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(user_id),
  media_url TEXT NOT NULL,
  media_type TEXT,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE portfolio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_name TEXT NOT NULL,
  subtitle TEXT,
  school_name TEXT,
  academic_year TEXT,
  description TEXT,
  vision TEXT,
  mission TEXT,
  logo_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES profiles(user_id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  attachment_url TEXT,
  is_pinned BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  actor_id UUID REFERENCES profiles(user_id),
  target_type TEXT,
  target_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE class_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_name TEXT DEFAULT 'ClassHub',
  subtitle TEXT,
  description TEXT,
  school_name TEXT,
  logo_url TEXT,
  accent_color TEXT DEFAULT '#a3e635',
  default_theme TEXT DEFAULT 'dark',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES profiles(user_id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE error_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  page TEXT,
  error_message TEXT,
  error_code TEXT,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "posts_select" ON posts FOR SELECT USING (is_hidden = false);
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "posts_delete" ON posts FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "comments_select" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON comments FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "likes_select" ON likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete" ON likes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "stories_select" ON stories FOR SELECT USING (expires_at > NOW());
CREATE POLICY "stories_insert" ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chat_select" ON chat_messages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "chat_insert" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (true);
CREATE POLICY "tasks_insert" ON tasks FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "submissions_select" ON task_submissions FOR SELECT USING (true);
CREATE POLICY "submissions_insert" ON task_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (true);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, username, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO class_settings (class_name, subtitle, school_name)
VALUES ('ClassHub', 'Kelas Kamu', 'Man 4 Bogor')
ON CONFLICT DO NOTHING;
