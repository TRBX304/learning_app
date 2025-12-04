# 自作問題集アプリ（QuizMaster）

自分で問題集を作成し、学習をサポートするWebアプリケーションです。

## 主な機能

### 1. 教材・問題の管理機能
- 科目の作成・編集・削除
- 問題の登録（テキスト、画像、4択選択肢）
- 問題のタグ付け
- 問題の編集・削除

### 2. 出題・解答機能
- 科目ごとに問題数を指定してランダム出題
- 4択形式での解答
- リアルタイムの正答率表示
- 解説の表示

### 3. 結果表示・履歴管理機能
- クイズ終了後の点数表示
- 間違えた問題の一覧表示
- 学習履歴の記録

### 4. 追加機能
- 問題のブックマーク（後で見る）機能
- 学習進捗ダッシュボード
  - 総問題数
  - 解答済み問題数
  - 全体正答率
  - 苦手な科目の表示
  - 日々の学習記録グラフ

## 技術スタック

- **フロントエンド**: HTML, CSS, JavaScript
- **バックエンド**: Supabase（認証、データベース、ストレージ）
- **デプロイ**: GitHub Pages

## セットアップ手順

### 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com/)にアクセスしてアカウントを作成
2. 新しいプロジェクトを作成
3. プロジェクトのURLとAPIキーをメモ

### 2. データベースのセットアップ

1. Supabaseのダッシュボードで「SQL Editor」を開く
2. `setup.sql`の内容をコピーして実行
3. すべてのテーブルとポリシーが作成されることを確認

### 3. Storageの設定

1. Supabaseのダッシュボードで「Storage」を開く
2. 「Create Bucket」をクリックし、`question-images`という名前でバケットを作成
3. バケットを「Public」に設定
4. 以下のポリシーを追加：

**アップロードポリシー:**
```sql
CREATE POLICY "ユーザーは自分のフォルダに画像をアップロード可能"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'question-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);
```

**閲覧ポリシー:**
```sql
CREATE POLICY "認証済みユーザーは画像を閲覧可能"
ON storage.objects FOR SELECT
USING (bucket_id = 'question-images' AND auth.role() = 'authenticated');
```

**削除ポリシー:**
```sql
CREATE POLICY "ユーザーは自分のフォルダの画像を削除可能"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'question-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### 4. アプリケーションの設定

1. `app.js`ファイルを開く
2. 以下の部分を自分のSupabaseプロジェクトの情報に置き換え：

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // 例: 'https://xxxxx.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

**取得方法:**
- Supabaseのダッシュボードで「Settings」→「API」を開く
- 「Project URL」をコピーして`SUPABASE_URL`に貼り付け
- 「Project API keys」の「anon public」をコピーして`SUPABASE_ANON_KEY`に貼り付け

### 5. GitHub Pagesへのデプロイ

1. GitHubで新しいリポジトリを作成
2. 以下のファイルをリポジトリにプッシュ：
   - `index.html`
   - `styles.css`
   - `app.js`

3. リポジトリの「Settings」→「Pages」を開く
4. 「Source」で「Deploy from a branch」を選択
5. 「Branch」で「main」（またはメインブランチ）を選択し、「/root」を選択
6. 「Save」をクリック
7. 数分後、`https://[ユーザー名].github.io/[リポジトリ名]/`でアプリにアクセス可能

## データベース構造

### profiles テーブル
ユーザーの基本情報を保存

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | UUID | ユーザーID（auth.users.idへの参照） |
| username | TEXT | ユーザー名 |
| created_at | TIMESTAMP | 作成日時 |

### subjects テーブル
科目情報を保存

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | UUID | 科目ID |
| user_id | UUID | ユーザーID |
| name | TEXT | 科目名 |
| description | TEXT | 科目の説明 |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |

### questions テーブル
問題情報を保存

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | UUID | 問題ID |
| subject_id | UUID | 科目ID |
| question_text | TEXT | 問題文 |
| question_image_url | TEXT | 画像URL |
| option_a | TEXT | 選択肢A |
| option_b | TEXT | 選択肢B |
| option_c | TEXT | 選択肢C |
| option_d | TEXT | 選択肢D |
| correct_answer | TEXT | 正解（A/B/C/D） |
| explanation | TEXT | 解説 |
| tags | TEXT[] | タグの配列 |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |

### learning_history テーブル
学習履歴を保存

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | UUID | 履歴ID |
| user_id | UUID | ユーザーID |
| question_id | UUID | 問題ID |
| user_answer | TEXT | ユーザーの回答 |
| is_correct | BOOLEAN | 正誤 |
| answered_at | TIMESTAMP | 回答日時 |

### bookmarks テーブル
ブックマーク（後で見る）を保存

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | UUID | ブックマークID |
| user_id | UUID | ユーザーID |
| question_id | UUID | 問題ID |
| created_at | TIMESTAMP | 作成日時 |

## セキュリティ

このアプリケーションでは、Supabaseの**Row Level Security (RLS)**を使用して、ユーザーごとのデータアクセスを制限しています。

- ユーザーは自分のデータ（科目、問題、学習履歴）のみにアクセス可能
- 他のユーザーのデータは閲覧・変更不可
- すべてのテーブルにRLSポリシーが適用済み

## 使い方

### 1. アカウント登録
1. アプリにアクセス
2. 「新規登録」タブをクリック
3. ユーザー名、メールアドレス、パスワードを入力
4. 「登録する」をクリック

### 2. 科目の作成
1. 「科目管理」タブをクリック
2. 「+ 新しい科目を追加」ボタンをクリック
3. 科目名と説明を入力
4. 「保存」をクリック

### 3. 問題の追加
1. 科目カードをクリック
2. 「+ 問題を追加」ボタンをクリック
3. 問題文、画像（任意）、選択肢、正解、解説、タグを入力
4. 「保存」をクリック

### 4. クイズに挑戦
1. 「問題に挑戦」タブをクリック
2. 科目と問題数を選択
3. 「開始」ボタンをクリック
4. 選択肢から回答を選択
5. 結果を確認

### 5. ダッシュボードで進捗確認
1. 「ダッシュボード」タブをクリック
2. 統計情報、苦手な科目、学習記録グラフを確認

## トラブルシューティング

### ログインできない
- メールアドレスとパスワードが正しいか確認
- Supabaseの認証設定を確認

### 画像がアップロードできない
- Storageバケット`question-images`が作成されているか確認
- Storageポリシーが正しく設定されているか確認

### データが表示されない
- `app.js`のSupabase設定が正しいか確認
- ブラウザの開発者ツールでエラーメッセージを確認
- Supabaseのダッシュボードでデータが保存されているか確認

### RLSエラーが発生する
- すべてのテーブルでRLSが有効になっているか確認
- 各テーブルのポリシーが正しく設定されているか確認

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 開発者

作成者: [あなたの名前]

## 今後の機能追加予定

- [ ] 複数の問題形式のサポート（記述式、複数選択など）
- [ ] 問題のインポート/エクスポート機能
- [ ] 他のユーザーとの問題共有機能
- [ ] より詳細な統計情報とグラフ
- [ ] モバイルアプリ版の開発
- [ ] AIによる問題生成機能

## サポート

問題や質問がある場合は、GitHubのIssuesで報告してください。
