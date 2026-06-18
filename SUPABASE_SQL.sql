-- ================================================
-- חוד החנית - SQL Schema לסופאבייס
-- הרץ את כל הקוד הזה בעורך SQL של Supabase
-- ================================================

-- הפעלת UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- טבלת פרופילי משתמשים
-- ================================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'level1'
    CHECK (role IN ('level1', 'level2', 'level3', 'writer', 'admin')),
  login_days_count INTEGER DEFAULT 0,
  total_active_minutes INTEGER DEFAULT 0,
  received_likes_count INTEGER DEFAULT 0,
  last_login_date DATE,
  is_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- טבלת קטגוריות
-- ================================================
CREATE TABLE public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📰',
  is_hidden BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- טבלת פוסטים
-- ================================================
CREATE TABLE public.posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  cover_image TEXT,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'pending')),
  tags TEXT[] DEFAULT '{}',
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- ================================================
-- טבלת תגובות
-- ================================================
CREATE TABLE public.comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- טבלת לייקים לפוסטים
-- ================================================
CREATE TABLE public.post_likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT DEFAULT '👍',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- ================================================
-- טבלת לייקים לתגובות
-- ================================================
CREATE TABLE public.comment_likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- ================================================
-- טבלת יומן כניסות (לגאמיפיקציה)
-- ================================================
CREATE TABLE public.login_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  login_date DATE NOT NULL DEFAULT CURRENT_DATE,
  active_minutes INTEGER DEFAULT 0,
  UNIQUE(user_id, login_date)
);

-- ================================================
-- קטגוריות ברירת מחדל
-- ================================================
INSERT INTO public.categories (name, slug, description, icon, sort_order) VALUES
  ('חדשות', 'news', 'חדשות עדכניות מהארץ והעולם', '📰', 1),
  ('בדיחות', 'jokes', 'בדיחות ובידור קל לכל המשפחה', '😄', 2),
  ('בינה מלאכותית', 'ai', 'עולם ה-AI והטכנולוגיה החדישה', '🤖', 3),
  ('טכנולוגיה', 'tech', 'עדכוני טכנולוגיה וחדשנות', '💻', 4);

-- ================================================
-- פונקציה: יצירת פרופיל אוטומטית בהרשמה
-- ================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    CASE WHEN NEW.email = 'E0556770172@gmail.com' THEN 'admin' ELSE 'level1' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================================================
-- פונקציה: עדכון מונה צפיות פוסט
-- ================================================
CREATE OR REPLACE FUNCTION public.increment_post_views(post_id UUID)
RETURNS VOID AS $$
  UPDATE public.posts SET views_count = views_count + 1 WHERE id = post_id;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ================================================
-- פונקציה: אלגוריתם שדרוג אוטומטי (מריצים ידנית או בcron)
-- ================================================
CREATE OR REPLACE FUNCTION public.auto_upgrade_users()
RETURNS TEXT AS $$
DECLARE
  upgraded_count INTEGER := 0;
  rec RECORD;
BEGIN
  -- שדרוג מרמה 1 לרמה 2: 5 ימי כניסה + 60 דקות
  FOR rec IN
    SELECT p.id FROM public.profiles p
    WHERE p.role = 'level1' AND p.is_blocked = FALSE
      AND p.login_days_count >= 5
      AND p.total_active_minutes >= 60
  LOOP
    UPDATE public.profiles SET role = 'level2', updated_at = NOW()
    WHERE id = rec.id;
    upgraded_count := upgraded_count + 1;
  END LOOP;

  -- שדרוג מרמה 2 לרמה 3: 20 ימי כניסה + 300 דקות + 10 לייקים על תגובות
  FOR rec IN
    SELECT p.id FROM public.profiles p
    WHERE p.role = 'level2' AND p.is_blocked = FALSE
      AND p.login_days_count >= 20
      AND p.total_active_minutes >= 300
      AND p.received_likes_count >= 10
  LOOP
    UPDATE public.profiles SET role = 'level3', updated_at = NOW()
    WHERE id = rec.id;
    upgraded_count := upgraded_count + 1;
  END LOOP;

  RETURN 'שודרגו ' || upgraded_count || ' משתמשים';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- פונקציה: עדכון נתוני כניסה יומית
-- ================================================
CREATE OR REPLACE FUNCTION public.record_user_activity(
  p_user_id UUID,
  p_active_minutes INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.login_logs (user_id, login_date, active_minutes)
  VALUES (p_user_id, CURRENT_DATE, p_active_minutes)
  ON CONFLICT (user_id, login_date)
  DO UPDATE SET active_minutes = login_logs.active_minutes + p_active_minutes;

  UPDATE public.profiles SET
    login_days_count = (SELECT COUNT(DISTINCT login_date) FROM public.login_logs WHERE user_id = p_user_id),
    total_active_minutes = (SELECT COALESCE(SUM(active_minutes), 0) FROM public.login_logs WHERE user_id = p_user_id),
    last_login_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- RLS - Row Level Security
-- ================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "פרופילים גלויים לכולם" ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "משתמש יכול לעדכן פרופיל שלו" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Categories policies
CREATE POLICY "קטגוריות גלויות לכולם" ON public.categories FOR SELECT USING (TRUE);
CREATE POLICY "רק אדמין יכול לנהל קטגוריות" ON public.categories FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Posts policies
CREATE POLICY "פוסטים מפורסמים גלויים לכולם" ON public.posts FOR SELECT
  USING (status = 'published' OR author_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'writer')));
CREATE POLICY "כתבים ואדמינים יכולים ליצור פוסטים" ON public.posts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'writer', 'level3')));
CREATE POLICY "עריכת פוסט שלך או אדמין" ON public.posts FOR UPDATE
  USING (author_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "מחיקת פוסט - כתב שלו או אדמין" ON public.posts FOR DELETE
  USING (author_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Comments policies
CREATE POLICY "תגובות גלויות לכולם" ON public.comments FOR SELECT USING (TRUE);
CREATE POLICY "רמה 2 ומעלה יכולים להגיב" ON public.comments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('level2','level3','writer','admin') AND is_blocked = FALSE));
CREATE POLICY "עריכת תגובה שלך (15 דקות) או אדמין" ON public.comments FOR UPDATE
  USING (author_id = auth.uid() AND created_at > NOW() - INTERVAL '15 minutes'
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "מחיקת תגובה שלך או אדמין" ON public.comments FOR DELETE
  USING (author_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Likes policies
CREATE POLICY "לייקים גלויים לכולם" ON public.post_likes FOR SELECT USING (TRUE);
CREATE POLICY "כל משתמש מחובר יכול לסמן לייק" ON public.post_likes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);
CREATE POLICY "מחיקת לייק שלך" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "לייקים לתגובות גלויים לכולם" ON public.comment_likes FOR SELECT USING (TRUE);
CREATE POLICY "כל משתמש מחובר יכול ללייק תגובה" ON public.comment_likes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);
CREATE POLICY "מחיקת לייק תגובה שלך" ON public.comment_likes FOR DELETE USING (auth.uid() = user_id);

-- Login logs
CREATE POLICY "לוג כניסה שלך" ON public.login_logs FOR ALL USING (user_id = auth.uid());

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.increment_post_views TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_user_activity TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_upgrade_users TO authenticated;

-- ================================================
-- אינדקסים לביצועים
-- ================================================
CREATE INDEX idx_posts_status ON public.posts(status);
CREATE INDEX idx_posts_category ON public.posts(category_id);
CREATE INDEX idx_posts_author ON public.posts(author_id);
CREATE INDEX idx_posts_published ON public.posts(published_at DESC);
CREATE INDEX idx_comments_post ON public.comments(post_id);
CREATE INDEX idx_post_likes_post ON public.post_likes(post_id);
CREATE INDEX idx_comment_likes_comment ON public.comment_likes(comment_id);
