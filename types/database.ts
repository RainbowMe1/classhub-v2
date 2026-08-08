export type Role = 'admin' | 'teacher' | 'student';

export type Profile = {
  id: string;
  user_id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  role: Role;
  is_banned: boolean;
  created_at: string;
};

export type Post = {
  id: string;
  user_id: string;
  content: string | null;
  media_urls: string[];
  media_type: 'image' | 'video' | 'none';
  is_hidden: boolean;
  created_at: string;
  profiles?: Profile;
};

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  profiles?: Profile;
};

export type Story = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video' | 'text';
  caption: string | null;
  expires_at: string;
  created_at: string;
  profiles?: Profile;
};

export type Task = {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  subject: string | null;
  deadline: string;
  attachment_url: string | null;
  status: string;
  created_at: string;
};

export type TaskSubmission = {
  id: string;
  task_id: string;
  user_id: string;
  file_url: string;
  file_name: string | null;
  note: string | null;
  grade: number | null;
  feedback: string | null;
  submitted_at: string;
};

export type Schedule = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string;
  teacher_id: string | null;
  room: string | null;
  notes: string | null;
};

export type Duty = {
  id: string;
  day_of_week: number;
  user_ids: string[];
};

export type Announcement = {
  id: string;
  author_id: string;
  title: string;
  content: string;
  attachment_url: string | null;
  is_pinned: boolean;
  is_published: boolean;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  actor_id: string | null;
  target_type: string | null;
  target_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type ClassSettings = {
  id: string;
  class_name: string;
  subtitle: string | null;
  description: string | null;
  school_name: string | null;
  logo_url: string | null;
  accent_color: string;
  default_theme: string;
};

export type ErrorLog = {
  id: number;
  user_id: string | null;
  page: string | null;
  error_message: string;
  error_code: string | null;
  context: Record<string, unknown> | null;
  created_at: string;
};
