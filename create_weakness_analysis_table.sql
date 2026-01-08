-- ==========================================
-- AI弱点分析結果保存テーブル
-- ==========================================

-- テーブル作成
CREATE TABLE IF NOT EXISTS weakness_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  
  -- AI分析レポート
  ai_analysis TEXT NOT NULL,
  
  -- 統計情報
  total_attempts INTEGER NOT NULL,
  total_wrong INTEGER NOT NULL,
  
  -- ランキングデータ（JSON形式）
  wrong_ranking JSONB NOT NULL,
  
  -- タグ頻度（JSON形式）
  tag_frequency JSONB NOT NULL,
  
  -- おすすめ問題セット（question_idの配列）
  recommended_question_ids UUID[] NOT NULL,
  
  -- メタデータ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 制約：各ユーザー・科目ごとに1つの最新分析のみ保持
  UNIQUE(user_id, subject_id)
);

-- インデックス作成（既存の命名規則に合わせる）
CREATE INDEX IF NOT EXISTS weakness_analysis_user_id_idx ON weakness_analysis(user_id);
CREATE INDEX IF NOT EXISTS weakness_analysis_subject_id_idx ON weakness_analysis(subject_id);
CREATE INDEX IF NOT EXISTS weakness_analysis_updated_at_idx ON weakness_analysis(updated_at DESC);

-- RLS (Row Level Security) 有効化
ALTER TABLE weakness_analysis ENABLE ROW LEVEL SECURITY;

-- RLSポリシー作成（既存テーブルと同じ日本語形式）

-- ユーザーは自分の分析結果を閲覧可能
DROP POLICY IF EXISTS "ユーザーは自分の分析結果を閲覧可能" ON weakness_analysis;
CREATE POLICY "ユーザーは自分の分析結果を閲覧可能"
ON weakness_analysis FOR SELECT
USING (auth.uid() = user_id);

-- ユーザーは分析結果を作成可能
DROP POLICY IF EXISTS "ユーザーは分析結果を作成可能" ON weakness_analysis;
CREATE POLICY "ユーザーは分析結果を作成可能"
ON weakness_analysis FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ユーザーは自分の分析結果を更新可能
DROP POLICY IF EXISTS "ユーザーは自分の分析結果を更新可能" ON weakness_analysis;
CREATE POLICY "ユーザーは自分の分析結果を更新可能"
ON weakness_analysis FOR UPDATE
USING (auth.uid() = user_id);

-- ユーザーは自分の分析結果を削除可能
DROP POLICY IF EXISTS "ユーザーは自分の分析結果を削除可能" ON weakness_analysis;
CREATE POLICY "ユーザーは自分の分析結果を削除可能"
ON weakness_analysis FOR DELETE
USING (auth.uid() = user_id);

-- updated_atトリガーの追加（既存のトリガー関数を使用）
CREATE TRIGGER update_weakness_analysis_updated_at
BEFORE UPDATE ON weakness_analysis
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE 'weakness_analysisテーブル、インデックス、RLSポリシー、トリガーの作成が完了しました';
END $$;
