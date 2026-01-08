-- ==========================================
-- 自作問題集アプリ - Supabaseデータベース設定
-- ==========================================

-- プロフィールテーブル
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    username TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- プロフィールテーブルのRLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ユーザーは自分のプロフィールを閲覧可能"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "ユーザーは自分のプロフィールを挿入可能"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "ユーザーは自分のプロフィールを更新可能"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- ==========================================
-- 科目テーブル
CREATE TABLE subjects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 科目テーブルのインデックス
CREATE INDEX subjects_user_id_idx ON subjects(user_id);

-- 科目テーブルのRLS
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ユーザーは自分の科目を閲覧可能"
ON subjects FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "ユーザーは科目を作成可能"
ON subjects FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分の科目を更新可能"
ON subjects FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分の科目を削除可能"
ON subjects FOR DELETE
USING (auth.uid() = user_id);

-- ==========================================
-- 問題テーブル
CREATE TABLE questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    question_text TEXT NOT NULL,
    question_image_url TEXT,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
    explanation TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 問題テーブルのインデックス
CREATE INDEX questions_subject_id_idx ON questions(subject_id);
CREATE INDEX questions_tags_idx ON questions USING GIN(tags);

-- 問題テーブルのRLS
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ユーザーは自分の科目の問題を閲覧可能"
ON questions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM subjects
        WHERE subjects.id = questions.subject_id
        AND subjects.user_id = auth.uid()
    )
);

CREATE POLICY "ユーザーは自分の科目に問題を作成可能"
ON questions FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM subjects
        WHERE subjects.id = questions.subject_id
        AND subjects.user_id = auth.uid()
    )
);

CREATE POLICY "ユーザーは自分の科目の問題を更新可能"
ON questions FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM subjects
        WHERE subjects.id = questions.subject_id
        AND subjects.user_id = auth.uid()
    )
);

CREATE POLICY "ユーザーは自分の科目の問題を削除可能"
ON questions FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM subjects
        WHERE subjects.id = questions.subject_id
        AND subjects.user_id = auth.uid()
    )
);

-- ==========================================
-- 学習履歴テーブル
CREATE TABLE learning_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
    user_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 学習履歴テーブルのインデックス
CREATE INDEX learning_history_user_id_idx ON learning_history(user_id);
CREATE INDEX learning_history_question_id_idx ON learning_history(question_id);
CREATE INDEX learning_history_answered_at_idx ON learning_history(answered_at);

-- 学習履歴テーブルのRLS
ALTER TABLE learning_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ユーザーは自分の学習履歴を閲覧可能"
ON learning_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "ユーザーは学習履歴を作成可能"
ON learning_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分の学習履歴を削除可能"
ON learning_history FOR DELETE
USING (auth.uid() = user_id);

-- ==========================================
-- ブックマークテーブル
CREATE TABLE bookmarks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, question_id)
);

-- ブックマークテーブルのインデックス
CREATE INDEX bookmarks_user_id_idx ON bookmarks(user_id);
CREATE INDEX bookmarks_question_id_idx ON bookmarks(question_id);

-- ブックマークテーブルのRLS
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ユーザーは自分のブックマークを閲覧可能"
ON bookmarks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "ユーザーはブックマークを作成可能"
ON bookmarks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ユーザーは自分のブックマークを削除可能"
ON bookmarks FOR DELETE
USING (auth.uid() = user_id);

-- ==========================================
-- ストレージバケットの設定（Supabase Storageで実行）
-- Storage > Create Bucket で "question-images" という名前のバケットを作成してください
-- その後、以下のポリシーを設定：

-- 1. ストレージポリシー：ユーザーは自分のフォルダに画像をアップロード可能
-- CREATE POLICY "ユーザーは自分のフォルダに画像をアップロード可能"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--     bucket_id = 'question-images' 
--     AND auth.uid()::text = (storage.foldername(name))[1]
-- );

-- 2. ストレージポリシー：すべてのユーザーが画像を閲覧可能（認証済みユーザーのみ）
-- CREATE POLICY "認証済みユーザーは画像を閲覧可能"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'question-images' AND auth.role() = 'authenticated');

-- 3. ストレージポリシー：ユーザーは自分のフォルダの画像を削除可能
-- CREATE POLICY "ユーザーは自分のフォルダの画像を削除可能"
-- ON storage.objects FOR DELETE
-- USING (
--     bucket_id = 'question-images' 
--     AND auth.uid()::text = (storage.foldername(name))[1]
-- );

-- ==========================================
-- トリガー関数：updated_atの自動更新
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 科目テーブルのupdated_atトリガー
CREATE TRIGGER update_subjects_updated_at
BEFORE UPDATE ON subjects
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 問題テーブルのupdated_atトリガー
CREATE TRIGGER update_questions_updated_at
BEFORE UPDATE ON questions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 新規ユーザー登録時にプロフィールを自動作成する関数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'ユーザー' || substr(NEW.id::text, 1, 8))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 新規ユーザー登録時のトリガー
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
