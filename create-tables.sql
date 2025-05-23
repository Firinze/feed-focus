-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Feeds table
CREATE TABLE IF NOT EXISTS feeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LinkedIn profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unique_id TEXT,
  name TEXT NOT NULL,
  title TEXT,
  image_url TEXT,
  linkedin_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table for feeds and profiles (many-to-many)
CREATE TABLE IF NOT EXISTS feed_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(feed_id, profile_id)
);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  focus_mode BOOLEAN DEFAULT FALSE,
  keyword_filter TEXT,
  content_type TEXT DEFAULT 'all',
  current_feed_id UUID REFERENCES feeds(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- Feeds policies
CREATE POLICY "Users can view their own feeds" ON feeds
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feeds" ON feeds
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feeds" ON feeds
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feeds" ON feeds
  FOR DELETE USING (auth.uid() = user_id);

-- Profiles policies (profiles can be shared between users)
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert profiles" ON profiles
  FOR INSERT WITH CHECK (true);

-- Feed profiles policies
CREATE POLICY "Users can view their own feed profiles" ON feed_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feeds
      WHERE feeds.id = feed_profiles.feed_id
      AND feeds.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own feed profiles" ON feed_profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM feeds
      WHERE feeds.id = feed_profiles.feed_id
      AND feeds.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own feed profiles" ON feed_profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM feeds
      WHERE feeds.id = feed_profiles.feed_id
      AND feeds.user_id = auth.uid()
    )
  );

-- User settings policies
CREATE POLICY "Users can view their own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_modtime
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_feeds_modtime
  BEFORE UPDATE ON feeds
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_profiles_modtime
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_user_settings_modtime
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();
