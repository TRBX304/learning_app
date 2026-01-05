// アプリ全体を即時実行関数でラップして変数の重複を防ぐ
(function() {
    'use strict';
    
    // Supabaseの設定
    const SUPABASE_URL = window.SUPABASE_CONFIG?.url || '';
    const SUPABASE_ANON_KEY = window.SUPABASE_CONFIG?.anonKey || '';
    const EDGE_FUNCTION_URL = window.SUPABASE_CONFIG?.edgeFunctionUrl || '';

    // 設定が正しく読み込まれているかチェック
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('Supabaseの設定が見つかりません。');
        alert('アプリの設定が完了していません。');
        return;
    }
    
    if (!EDGE_FUNCTION_URL) {
        console.warn('Edge Function URLが設定されていません。AI機能が制限されます。');
    }

    // Supabaseクライアントの初期化
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// グローバル変数
let currentUser = null;
let currentSubjectId = null;
let currentQuiz = {
    questions: [],
    currentIndex: 0,
    answers: [],
    correctCount: 0
};
let weaknessQuestions = []; // 弱点問題を保存
let analysisResult = null; // AI分析結果を保存
let generatedQuestions = []; // AI生成された問題を保存

// =========================================
// 初期化
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});

async function initializeApp() {
    // 認証状態のチェック
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        await loadUserProfile();
        showScreen('main-screen');
        loadDashboard();
    } else {
        showScreen('login-screen');
    }

    // 認証状態の変更を監視
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            loadUserProfile();
            showScreen('main-screen');
            loadDashboard();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            showScreen('login-screen');
        }
    });
}

// =========================================
// イベントリスナー
// =========================================
function setupEventListeners() {
    // ハンバーガーメニュー
    document.getElementById('menu-toggle').addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
    document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

    // ログイン/サインアップタブ
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${tab}-form`).classList.add('active');
        });
    });

    // ログイン
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    
    // サインアップ
    document.getElementById('signup-btn').addEventListener('click', handleSignup);
    
    // ログアウト
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // ナビゲーション
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
        });
    });

    // 科目管理
    document.getElementById('add-subject-btn').addEventListener('click', () => {
        openSubjectForm();
    });

    document.getElementById('subject-form').addEventListener('submit', handleSubjectSubmit);
    document.getElementById('add-question-btn').addEventListener('click', () => {
        openQuestionForm();
    });

    // AI自動作問
    document.getElementById('auto-generate-btn').addEventListener('click', () => {
        openAutoGenerateModal();
    });
    document.getElementById('generate-questions-btn').addEventListener('click', handleGenerateQuestions);
    document.getElementById('save-generated-questions-btn').addEventListener('click', handleSaveGeneratedQuestions);
    document.getElementById('textbook-image').addEventListener('change', handleTextbookImagePreview);

    document.getElementById('question-form').addEventListener('submit', handleQuestionSubmit);
    document.getElementById('edit-subject-btn').addEventListener('click', handleEditSubject);
    document.getElementById('delete-subject-btn').addEventListener('click', handleDeleteSubject);

    // 問題画像プレビュー
    document.getElementById('question-image').addEventListener('change', handleImagePreview);

    // モーダルを閉じる
    document.querySelectorAll('.close-btn, .close-modal').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    // クイズ
    document.getElementById('start-quiz-btn').addEventListener('click', startQuiz);
    document.getElementById('next-question-btn').addEventListener('click', nextQuestion);
    document.getElementById('quit-quiz-btn').addEventListener('click', quitQuiz);
    document.getElementById('retry-quiz-btn').addEventListener('click', retryQuiz);
    document.getElementById('back-to-setup-btn').addEventListener('click', backToQuizSetup);
    document.getElementById('bookmark-question-btn').addEventListener('click', toggleBookmark);

    // AI弱点分析
    document.getElementById('run-weakness-analysis-btn').addEventListener('click', runWeaknessAnalysis);
    
    // 弱点クイズの操作
    document.getElementById('weakness-next-btn').addEventListener('click', nextWeaknessQuestion);
    document.getElementById('retry-weakness-quiz-btn').addEventListener('click', retryWeaknessQuiz);
    document.getElementById('back-to-analysis-btn').addEventListener('click', backToAnalysisResult);

    // 弱点クイズの解答ボタン
    document.querySelectorAll('.weakness-option').forEach(btn => {
        btn.addEventListener('click', handleWeaknessAnswer);
    });

    // 解答ボタン（通常のクイズのみ、弱点クイズボタンは除外）
    document.querySelectorAll('.option-btn:not(.weakness-option)').forEach(btn => {
        btn.addEventListener('click', handleAnswer);
    });
}

// =========================================
// 認証機能
// =========================================
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        showMessage('auth-message', error.message, 'error');
    } else {
        showMessage('auth-message', 'ログインしました！', 'success');
    }
}

async function handleSignup() {
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username: username
            }
        }
    });

    if (error) {
        showMessage('auth-message', error.message, 'error');
    } else {
        // プロフィールテーブルにユーザー情報を追加
        await supabase.from('profiles').insert([
            { id: data.user.id, username: username }
        ]);
        showMessage('auth-message', '登録完了！ログインしてください。', 'success');
        
        // ログインフォームに切り替え
        setTimeout(() => {
            document.querySelector('.tab-btn[data-tab="login"]').click();
        }, 2000);
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
}

async function loadUserProfile() {
    const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', currentUser.id)
        .single();

    if (data) {
        document.getElementById('username-display').textContent = data.username;
    }
}

// =========================================
// サイドバー管理
// =========================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
}

// =========================================
// ビュー管理
// =========================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function switchView(viewName) {
    // ナビゲーションボタンの更新
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.nav-btn[data-view="${viewName}"]`).classList.add('active');

    // ビューの切り替え
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`${viewName}-view`).classList.add('active');

    // サイドバーを閉じる
    closeSidebar();

    // 画面の一番上にスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 各ビューのデータ読み込み
    switch(viewName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'subjects':
            loadSubjects();
            break;
        case 'quiz':
            loadQuizSubjects();
            break;
        case 'bookmarks':
            loadBookmarks();
            break;
        case 'weakness-analysis':
            loadWeaknessAnalysisPage();
            break;
    }
}

// =========================================
// ダッシュボード
// =========================================
async function loadDashboard() {
    // 総問題数 - ユーザーの全科目の問題を集計
    const { data: userSubjects } = await supabase
        .from('subjects')
        .select('id')
        .eq('user_id', currentUser.id);

    let totalQuestions = 0;
    if (userSubjects && userSubjects.length > 0) {
        const subjectIds = userSubjects.map(s => s.id);
        const { count } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .in('subject_id', subjectIds);
        totalQuestions = count || 0;
    }

    // 解答済み問題数（重複なし）
    const { data: answeredData } = await supabase
        .from('learning_history')
        .select('question_id')
        .eq('user_id', currentUser.id);
    
    const answeredQuestions = new Set(answeredData?.map(a => a.question_id) || []).size;

    // 全体正答率
    const { data: historyData } = await supabase
        .from('learning_history')
        .select('is_correct')
        .eq('user_id', currentUser.id);

    const correctCount = historyData?.filter(h => h.is_correct).length || 0;
    const totalAnswers = historyData?.length || 0;
    const overallAccuracy = totalAnswers > 0 ? ((correctCount / totalAnswers) * 100).toFixed(1) : 0;

    // 登録科目数
    const totalSubjects = userSubjects?.length || 0;

    // 統計を表示
    document.getElementById('total-questions').textContent = totalQuestions;
    document.getElementById('answered-questions').textContent = answeredQuestions;
    document.getElementById('overall-accuracy').textContent = `${overallAccuracy}%`;
    document.getElementById('total-subjects').textContent = totalSubjects;

    // 苦手な科目を表示
    await loadWeakSubjects();

    // 学習記録グラフを表示
    await loadLearningChart();
}

async function loadWeakSubjects() {
    const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('user_id', currentUser.id);

    if (!subjects || subjects.length === 0) {
        document.getElementById('weak-subjects').innerHTML = '<p class="empty-state">データがありません</p>';
        return;
    }

    const subjectAccuracies = [];

    for (const subject of subjects) {
        const { data: questions } = await supabase
            .from('questions')
            .select('id')
            .eq('subject_id', subject.id);

        if (!questions || questions.length === 0) continue;

        const questionIds = questions.map(q => q.id);

        const { data: history } = await supabase
            .from('learning_history')
            .select('is_correct')
            .eq('user_id', currentUser.id)
            .in('question_id', questionIds);

        if (history && history.length > 0) {
            const correct = history.filter(h => h.is_correct).length;
            const accuracy = (correct / history.length) * 100;
            subjectAccuracies.push({ name: subject.name, accuracy: accuracy.toFixed(1) });
        }
    }

    subjectAccuracies.sort((a, b) => a.accuracy - b.accuracy);
    const weakSubjects = subjectAccuracies.slice(0, 3);

    if (weakSubjects.length === 0) {
        document.getElementById('weak-subjects').innerHTML = '<p class="empty-state">データがありません</p>';
        return;
    }

    const html = weakSubjects.map(s => `
        <div class="weak-subject-item">
            <span class="weak-subject-name">${s.name}</span>
            <span class="weak-subject-accuracy">${s.accuracy}%</span>
        </div>
    `).join('');

    document.getElementById('weak-subjects').innerHTML = html;
}

async function loadLearningChart() {
    const canvas = document.getElementById('learning-chart');
    const ctx = canvas.getContext('2d');

    // canvasの論理的な幅と高さを、CSSで設定された親要素の現在のサイズに合わせる
    const container = canvas.parentElement;
    if (container) {
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // canvasの描画属性を再設定（棒の計算に使用される）
        canvas.width = containerWidth;
        canvas.height = containerHeight;
    }

    // 過去7日間のデータを取得
    const today = new Date();
    const days = [];
    const counts = [];

    for (let i = 6; i >= 0; i--) {
        // --- 日付計算ロジック (この部分はOKです) ---
        const dayStart = new Date(today); // todayをコピーして使用
        dayStart.setDate(today.getDate() - i);
        dayStart.setHours(0, 0, 0, 0); // ローカルタイムでその日の0時0分0秒に設定

        const nextDayStart = new Date(dayStart);
        nextDayStart.setDate(dayStart.getDate() + 1); // ローカルタイムで翌日の0時0分0秒に設定
        
        // .toISOString()で正確にUTCに変換してSupabaseに渡す
        const startISO = dayStart.toISOString(); // 例: 2025-12-07T15:00:00.000Z (JSTの0時)
        const endISO = nextDayStart.toISOString(); // 例: 2025-12-08T15:00:00.000Z (JSTの翌日0時)
        // ---------------------------------
        
        const { count } = await supabase
            .from('learning_history')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            // 👇 修正1: 正しく計算した startISO を使用
            .gte('answered_at', startISO) 
            // 👇 修正2: 翌日0時までの endISO を使用
            .lt('answered_at', endISO); 

        // 👇 修正3: dayStart を使用してグラフのX軸ラベルを設定
        days.push(`${dayStart.getMonth() + 1}/${dayStart.getDate()}`);
        counts.push(count || 0);
    }

    // シンプルな棒グラフを描画
    const maxCount = Math.max(...counts, 1);
    const barWidth = canvas.width / days.length - 20;
    const barMaxHeight = canvas.height - 40;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#6366f1';

    counts.forEach((count, index) => {
        const barHeight = (count / maxCount) * barMaxHeight;
        const x = index * (barWidth + 20) + 10;
        const y = canvas.height - barHeight - 20;

        ctx.fillRect(x, y, barWidth, barHeight);

        // ラベル
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '12px Poppins';
        ctx.textAlign = 'center';
        ctx.fillText(days[index], x + barWidth / 2, canvas.height - 5);
        ctx.fillText(count, x + barWidth / 2, y - 5);
        ctx.fillStyle = '#6366f1';
    });
}

// =========================================
// 科目管理
// =========================================
async function loadSubjects() {
    const { data: subjects, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    const container = document.getElementById('subjects-list');

    if (!subjects || subjects.length === 0) {
        container.innerHTML = '<p class="empty-state">科目がありません。新しい科目を追加してください。</p>';
        return;
    }

    const html = await Promise.all(subjects.map(async (subject) => {
        const { count } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('subject_id', subject.id);

        return `
            <div class="subject-card" data-subject-id="${subject.id}">
                <div class="subject-name">${subject.name}</div>
                <div class="subject-description">${subject.description || ''}</div>
                <div class="subject-stats">
                    <span>📝 ${count || 0} 問題</span>
                </div>
            </div>
        `;
    }));

    container.innerHTML = html.join('');

    // 科目カードにクリックイベントを追加
    document.querySelectorAll('.subject-card').forEach(card => {
        card.addEventListener('click', () => {
            const subjectId = card.dataset.subjectId;
            openSubjectDetail(subjectId);
        });
    });
}

function openSubjectForm(subject = null) {
    const modal = document.getElementById('subject-form-modal');
    const form = document.getElementById('subject-form');
    
    if (subject) {
        document.getElementById('subject-form-title').textContent = '科目を編集';
        document.getElementById('subject-name').value = subject.name;
        document.getElementById('subject-description').value = subject.description || '';
        form.dataset.subjectId = subject.id;
    } else {
        document.getElementById('subject-form-title').textContent = '新しい科目';
        form.reset();
        delete form.dataset.subjectId;
    }

    modal.classList.add('active');
}

async function handleSubjectSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const name = document.getElementById('subject-name').value;
    const description = document.getElementById('subject-description').value;
    const subjectId = form.dataset.subjectId;

    if (subjectId) {
        // 更新
        await supabase
            .from('subjects')
            .update({ name, description, updated_at: new Date() })
            .eq('id', subjectId);
    } else {
        // 新規作成
        await supabase
            .from('subjects')
            .insert([{ user_id: currentUser.id, name, description }]);
    }

    closeAllModals();
    loadSubjects();
}

async function openSubjectDetail(subjectId) {
    currentSubjectId = subjectId;

    const { data: subject } = await supabase
        .from('subjects')
        .select('*')
        .eq('id', subjectId)
        .single();

    document.getElementById('subject-detail-name').textContent = subject.name;

    // 問題リストを読み込む
    const { data: questions } = await supabase
        .from('questions')
        .select('*')
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: false });

    const container = document.getElementById('questions-list');

    if (!questions || questions.length === 0) {
        container.innerHTML = '<p class="empty-state">問題がありません</p>';
    } else {
        const html = questions.map(q => `
            <div class="question-item" data-question-id="${q.id}">
                <div class="question-text">${q.question_text}</div>
                <div class="question-meta">
                    <span>正解: ${q.correct_answer}</span>
                    ${q.tags ? q.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : ''}
                </div>
                <div class="question-actions">
                    <button class="btn-secondary btn-small edit-question-btn">編集</button>
                    <button class="btn-danger btn-small delete-question-btn">削除</button>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;

        // 問題の編集・削除ボタン
        container.querySelectorAll('.edit-question-btn').forEach((btn, index) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openQuestionForm(questions[index]);
            });
        });

        container.querySelectorAll('.delete-question-btn').forEach((btn, index) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('この問題を削除しますか？')) {
                    await supabase.from('questions').delete().eq('id', questions[index].id);
                    openSubjectDetail(subjectId);
                }
            });
        });
    }

    document.getElementById('subject-detail-modal').classList.add('active');
}

function openQuestionForm(question = null) {
    const modal = document.getElementById('question-form-modal');
    const form = document.getElementById('question-form');
    
    if (question) {
        document.getElementById('question-form-title').textContent = '問題を編集';
        document.getElementById('question-text').value = question.question_text;
        document.getElementById('option-a').value = question.option_a;
        document.getElementById('option-b').value = question.option_b;
        document.getElementById('option-c').value = question.option_c;
        document.getElementById('option-d').value = question.option_d;
        document.getElementById('correct-answer').value = question.correct_answer;
        document.getElementById('explanation').value = question.explanation || '';
        document.getElementById('tags').value = question.tags ? question.tags.join(', ') : '';
        form.dataset.questionId = question.id;

        if (question.question_image_url) {
            document.getElementById('image-preview').innerHTML = 
                `<img src="${question.question_image_url}" alt="問題画像">`;
        }
    } else {
        document.getElementById('question-form-title').textContent = '新しい問題';
        form.reset();
        document.getElementById('image-preview').innerHTML = '';
        delete form.dataset.questionId;
    }

    modal.classList.add('active');
}

async function handleQuestionSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const questionId = form.dataset.questionId;
    
    const questionData = {
        subject_id: currentSubjectId,
        question_text: document.getElementById('question-text').value,
        option_a: document.getElementById('option-a').value,
        option_b: document.getElementById('option-b').value,
        option_c: document.getElementById('option-c').value,
        option_d: document.getElementById('option-d').value,
        correct_answer: document.getElementById('correct-answer').value,
        explanation: document.getElementById('explanation').value,
        tags: document.getElementById('tags').value.split(',').map(t => t.trim()).filter(t => t)
    };

    // 画像アップロード処理
    const imageFile = document.getElementById('question-image').files[0];
    if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('question-images')
            .upload(fileName, imageFile);

        if (!uploadError) {
            const { data: urlData } = supabase.storage
                .from('question-images')
                .getPublicUrl(fileName);
            
            questionData.question_image_url = urlData.publicUrl;
        }
    }

    if (questionId) {
        // 更新
        await supabase
            .from('questions')
            .update({ ...questionData, updated_at: new Date() })
            .eq('id', questionId);
    } else {
        // 新規作成
        await supabase
            .from('questions')
            .insert([questionData]);
    }

    closeAllModals();
    openSubjectDetail(currentSubjectId);
}

function handleImagePreview(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('image-preview').innerHTML = 
                `<img src="${e.target.result}" alt="プレビュー">`;
        };
        reader.readAsDataURL(file);
    }
}

async function handleEditSubject() {
    const { data: subject } = await supabase
        .from('subjects')
        .select('*')
        .eq('id', currentSubjectId)
        .single();

    document.getElementById('subject-detail-modal').classList.remove('active');
    openSubjectForm(subject);
}

async function handleDeleteSubject() {
    if (!confirm('この科目とすべての問題を削除しますか？')) return;

    await supabase.from('questions').delete().eq('subject_id', currentSubjectId);
    await supabase.from('subjects').delete().eq('id', currentSubjectId);

    closeAllModals();
    loadSubjects();
}

// =========================================
// クイズ機能
// =========================================
async function loadQuizSubjects() {
    const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('user_id', currentUser.id);

    const select = document.getElementById('quiz-subject');
    select.innerHTML = '<option value="">選択してください</option>';

    // おすすめ問題セットを取得
    const { data: weaknessAnalyses } = await supabase
        .from('weakness_analysis')
        .select('id, subject_name, subject_id, recommended_question_ids')
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false });

    // おすすめ問題セットのオプショングループ
    if (weaknessAnalyses && weaknessAnalyses.length > 0) {
        const recommendedGroup = document.createElement('optgroup');
        recommendedGroup.label = '📚 おすすめ問題セット（AI分析）';
        
        weaknessAnalyses.forEach(analysis => {
            if (analysis.recommended_question_ids && analysis.recommended_question_ids.length > 0) {
                const option = document.createElement('option');
                option.value = `recommended:${analysis.id}`;
                option.textContent = `${analysis.subject_name} おすすめ問題セット (${analysis.recommended_question_ids.length}問)`;
                option.dataset.analysisId = analysis.id;
                recommendedGroup.appendChild(option);
            }
        });
        
        if (recommendedGroup.children.length > 0) {
            select.appendChild(recommendedGroup);
        }
    }

    // 通常の科目のオプショングループ
    if (subjects && subjects.length > 0) {
        const subjectsGroup = document.createElement('optgroup');
        subjectsGroup.label = '📖 科目別';
        
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.id;
            option.textContent = subject.name;
            subjectsGroup.appendChild(option);
        });
        
        select.appendChild(subjectsGroup);
    }

    // クイズビューに切り替わった時は常にセットアップ画面を表示
    document.getElementById('quiz-setup').style.display = 'block';
    document.getElementById('quiz-play').classList.remove('active');
    document.getElementById('quiz-result').classList.remove('active');
}

async function startQuiz() {
    const selectedValue = document.getElementById('quiz-subject').value;
    const count = parseInt(document.getElementById('quiz-count').value);
    const orderOption = document.querySelector('input[name="quiz-order"]:checked').value;

    if (!selectedValue) {
        alert('科目を選択してください');
        return;
    }

    let questions;

    // おすすめ問題セットの場合
    if (selectedValue.startsWith('recommended:')) {
        const analysisId = selectedValue.replace('recommended:', '');
        
        // 分析データから問題IDを取得
        const { data: analysis } = await supabase
            .from('weakness_analysis')
            .select('recommended_question_ids')
            .eq('id', analysisId)
            .single();

        if (!analysis || !analysis.recommended_question_ids || analysis.recommended_question_ids.length === 0) {
            alert('おすすめ問題が見つかりませんでした');
            return;
        }

        // 問題詳細を取得
        const { data: fetchedQuestions } = await supabase
            .from('questions')
            .select('*')
            .in('id', analysis.recommended_question_ids);

        if (!fetchedQuestions || fetchedQuestions.length === 0) {
            alert('問題が見つかりませんでした');
            return;
        }

        // 分析結果の順序を保持してソート
        fetchedQuestions.sort((a, b) => {
            const aIndex = analysis.recommended_question_ids.indexOf(a.id);
            const bIndex = analysis.recommended_question_ids.indexOf(b.id);
            return aIndex - bIndex;
        });

        questions = fetchedQuestions;
        
        // ランダムオプションが選択されている場合はシャッフル
        if (orderOption === 'random') {
            questions = questions.sort(() => Math.random() - 0.5);
        }
    } 
    // 通常の科目の場合
    else {
        const subjectId = selectedValue;
        
        // 問題を取得（登録順 = created_at昇順）
        const { data: fetchedQuestions } = await supabase
            .from('questions')
            .select('*')
            .eq('subject_id', subjectId)
            .order('created_at', { ascending: true });

        if (!fetchedQuestions || fetchedQuestions.length === 0) {
            alert('この科目には問題がありません');
            return;
        }

        // 出題順オプションに応じてシャッフルするかどうかを決定
        if (orderOption === 'random') {
            questions = fetchedQuestions.sort(() => Math.random() - 0.5);
        } else {
            questions = fetchedQuestions;
        }
    }

    // 指定数だけ取得
    currentQuiz.questions = questions.slice(0, Math.min(count, questions.length));
    currentQuiz.currentIndex = 0;
    currentQuiz.answers = [];
    currentQuiz.correctCount = 0;

    // セットアップ画面を非表示、プレイ画面を表示
    document.getElementById('quiz-setup').style.display = 'none';
    document.getElementById('quiz-result').classList.remove('active');
    document.getElementById('quiz-play').classList.add('active');

    // 問題を表示
    displayQuestion();

    // 画面の一番上にスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function displayQuestion() {
    const question = currentQuiz.questions[currentQuiz.currentIndex];
    
    document.getElementById('current-question-num').textContent = currentQuiz.currentIndex + 1;
    document.getElementById('total-question-num').textContent = currentQuiz.questions.length;
    
    const accuracy = currentQuiz.currentIndex > 0 
        ? ((currentQuiz.correctCount / currentQuiz.currentIndex) * 100).toFixed(1)
        : 0;
    document.getElementById('current-accuracy').textContent = `${accuracy}%`;

    document.getElementById('question-display').textContent = question.question_text;

    // 画像表示
    const imageDisplay = document.getElementById('question-image-display');
    if (question.question_image_url) {
        imageDisplay.innerHTML = `<img src="${question.question_image_url}" alt="問題画像">`;
    } else {
        imageDisplay.innerHTML = '';
    }

    // 選択肢表示
    const options = document.querySelectorAll('.option-btn');
    options[0].querySelector('.option-text').textContent = question.option_a;
    options[1].querySelector('.option-text').textContent = question.option_b;
    options[2].querySelector('.option-text').textContent = question.option_c;
    options[3].querySelector('.option-text').textContent = question.option_d;

    // リセット
    options.forEach(btn => {
        btn.classList.remove('selected', 'correct', 'incorrect', 'disabled');
        btn.disabled = false;
    });

    document.getElementById('answer-feedback').classList.remove('show', 'correct', 'incorrect');
    document.getElementById('next-question-btn').style.display = 'none';

    // ブックマーク状態をチェック
    checkBookmarkStatus();
}

async function handleAnswer(e) {
    const selectedOption = e.currentTarget.dataset.option;
    const question = currentQuiz.questions[currentQuiz.currentIndex];
    const isCorrect = selectedOption === question.correct_answer;

    // ボタンを無効化
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.disabled = true;
        btn.classList.add('disabled');
    });

    // 選択したボタンをハイライト
    e.currentTarget.classList.add('selected');

    // 正誤を表示
    setTimeout(() => {
        document.querySelectorAll('.option-btn').forEach(btn => {
            if (btn.dataset.option === question.correct_answer) {
                btn.classList.add('correct');
            } else if (btn.dataset.option === selectedOption && !isCorrect) {
                btn.classList.add('incorrect');
            }
        });

        // フィードバック表示
        const feedback = document.getElementById('answer-feedback');
        feedback.innerHTML = `
            <div class="feedback-title">${isCorrect ? '✅ 正解！' : '❌ 不正解'}</div>
            ${question.explanation ? `<div>${question.explanation}</div>` : ''}
        `;
        feedback.classList.add('show', isCorrect ? 'correct' : 'incorrect');

        document.getElementById('next-question-btn').style.display = 'block';

        // 結果を記録
        currentQuiz.answers.push({
            question: question,
            userAnswer: selectedOption,
            isCorrect: isCorrect
        });

        if (isCorrect) {
            currentQuiz.correctCount++;
        }

        // 学習履歴に保存
        saveLearningHistory(question.id, selectedOption, isCorrect);
    }, 500);
}

async function saveLearningHistory(questionId, userAnswer, isCorrect) {
    await supabase.from('learning_history').insert([{
        user_id: currentUser.id,
        question_id: questionId,
        user_answer: userAnswer,
        is_correct: isCorrect,
        answered_at: new Date()
    }]);
}

function nextQuestion() {
    currentQuiz.currentIndex++;

    if (currentQuiz.currentIndex < currentQuiz.questions.length) {
        displayQuestion();
        // 画面の一番上にスクロール
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        showQuizResult();
        // 画面の一番上にスクロール
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function showQuizResult() {
    document.getElementById('quiz-play').classList.remove('active');
    document.getElementById('quiz-result').classList.add('active');

    const total = currentQuiz.questions.length;
    const correct = currentQuiz.correctCount;
    const percentage = ((correct / total) * 100).toFixed(1);

    document.getElementById('result-percentage').textContent = `${percentage}%`;
    document.getElementById('result-correct').textContent = correct;
    document.getElementById('result-total').textContent = total;

    // 間違えた問題を表示
    const wrongQuestions = currentQuiz.answers.filter(a => !a.isCorrect);
    const wrongList = document.getElementById('wrong-questions-list');

    if (wrongQuestions.length === 0) {
        wrongList.innerHTML = '<p class="empty-state">全問正解です！🎉</p>';
    } else {
        const html = wrongQuestions.map((answer, index) => `
            <div class="wrong-question-item">
                <div><strong>問題 ${index + 1}:</strong> ${answer.question.question_text}</div>
                <div style="margin-top: 0.5rem; color: var(--danger);">あなたの回答: ${answer.userAnswer}</div>
                <div style="color: var(--secondary);">正解: ${answer.question.correct_answer}</div>
                ${answer.question.explanation ? `<div style="margin-top: 0.5rem; color: var(--text-secondary);">${answer.question.explanation}</div>` : ''}
            </div>
        `).join('');

        wrongList.innerHTML = html;
    }
}

function quitQuiz() {
    if (confirm('クイズを終了しますか？')) {
        backToQuizSetup();
        // 画面の一番上にスクロール
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function retryQuiz() {
    currentQuiz.currentIndex = 0;
    currentQuiz.answers = [];
    currentQuiz.correctCount = 0;

    document.getElementById('quiz-result').classList.remove('active');
    document.getElementById('quiz-play').classList.add('active');

    displayQuestion();
    // 画面の一番上にスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToQuizSetup() {
    document.getElementById('quiz-play').classList.remove('active');
    document.getElementById('quiz-result').classList.remove('active');
    document.getElementById('quiz-setup').style.display = 'block';
    // 画面の一番上にスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =========================================
// ブックマーク機能
// =========================================
async function toggleBookmark() {
    const question = currentQuiz.questions[currentQuiz.currentIndex];
    
    // 既存のブックマークをチェック
    const { data: existing } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('question_id', question.id)
        .single();

    const btn = document.getElementById('bookmark-question-btn');

    if (existing) {
        // ブックマークを削除
        await supabase.from('bookmarks').delete().eq('id', existing.id);
        btn.classList.remove('bookmarked');
        btn.textContent = '🔖 後で見る';
    } else {
        // ブックマークを追加
        await supabase.from('bookmarks').insert([{
            user_id: currentUser.id,
            question_id: question.id
        }]);
        btn.classList.add('bookmarked');
        btn.textContent = '✅ ブックマーク済み';
    }
}

async function checkBookmarkStatus() {
    const question = currentQuiz.questions[currentQuiz.currentIndex];
    
    const { data } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('question_id', question.id)
        .single();

    const btn = document.getElementById('bookmark-question-btn');
    if (data) {
        btn.classList.add('bookmarked');
        btn.textContent = '✅ ブックマーク済み';
    } else {
        btn.classList.remove('bookmarked');
        btn.textContent = '🔖 後で見る';
    }
}

async function loadBookmarks() {
    const { data: bookmarks } = await supabase
        .from('bookmarks')
        .select(`
            id,
            question_id,
            questions (
                question_text,
                option_a,
                option_b,
                option_c,
                option_d,
                correct_answer,
                explanation,
                subject_id,
                subjects (name)
            )
        `)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    const container = document.getElementById('bookmarks-list');

    if (!bookmarks || bookmarks.length === 0) {
        container.innerHTML = '<p class="empty-state">ブックマークした問題はありません</p>';
        return;
    }

    const html = bookmarks.map(bookmark => `
        <div class="bookmark-item">
            <div class="bookmark-subject">${bookmark.questions.subjects.name}</div>
            <div class="bookmark-question">${bookmark.questions.question_text}</div>
            <div class="bookmark-actions">
                <button class="btn-secondary view-bookmark-btn" data-bookmark='${JSON.stringify(bookmark)}'>
                    詳細を見る
                </button>
                <button class="btn-danger remove-bookmark-btn" data-bookmark-id="${bookmark.id}">
                    削除
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;

    // 詳細表示ボタン
    container.querySelectorAll('.view-bookmark-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const bookmark = JSON.parse(btn.dataset.bookmark);
            showBookmarkDetail(bookmark);
        });
    });

    // 削除ボタン
    container.querySelectorAll('.remove-bookmark-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('このブックマークを削除しますか？')) {
                await supabase.from('bookmarks').delete().eq('id', btn.dataset.bookmarkId);
                loadBookmarks();
            }
        });
    });
}

function showBookmarkDetail(bookmark) {
    const question = bookmark.questions;
    alert(`
問題: ${question.question_text}

A: ${question.option_a}
B: ${question.option_b}
C: ${question.option_c}
D: ${question.option_d}

正解: ${question.correct_answer}

${question.explanation ? '解説: ' + question.explanation : ''}
    `);
}

// =========================================
// ユーティリティ
// =========================================
function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `message ${type}`;
    element.style.display = 'block';

    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// =========================================
// AI弱点分析機能
// =========================================

// AI APIキー（実際の運用では環境変数やconfig.jsから取得）
const AI_API_KEY = window.AI_CONFIG?.apiKey || '';

/**
 * 弱点分析ページを読み込み（科目リストを設定）
 */
async function loadWeaknessAnalysisPage() {
    // 科目リストを取得してセレクトボックスに設定
    const { data: subjects } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('name');

    const select = document.getElementById('analysis-subject');
    
    // 既存のオプション（「科目を選択」と「全科目」）以外をクリア
    while (select.options.length > 2) {
        select.remove(2);
    }

    // 科目を追加
    if (subjects && subjects.length > 0) {
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.id;
            option.textContent = subject.name;
            select.appendChild(option);
        });
    }

    // Supabaseから最新の分析結果を復元
    const savedAnalysis = await loadLatestWeaknessAnalysisFromSupabase();
    
    if (savedAnalysis) {
        try {
            // AI分析テキストを表示
            if (savedAnalysis.ai_analysis) {
                await displayAiAnalysis(savedAnalysis.ai_analysis);
            }
            
            // おすすめ問題セットを表示（ランキング表示は削除）
            if (savedAnalysis.wrong_ranking && savedAnalysis.wrong_ranking.length > 0) {
                // wrong_rankingから直接表示
                await displayRecommended(savedAnalysis.wrong_ranking);
            }
            
            // 分析コンテナを表示
            document.getElementById('ai-analysis-container').style.display = 'block';
        } catch (error) {
            console.error('分析結果の復元エラー:', error);
            // エラーの場合は分析結果を非表示
            document.getElementById('ai-analysis-container').style.display = 'none';
        }
    } else {
        // 保存された結果がない場合は分析結果を非表示
        document.getElementById('ai-analysis-container').style.display = 'none';
    }
}

/**
 * メインフロー: AI弱点分析を実行
 */
async function runWeaknessAnalysis() {
    try {
        const btn = document.getElementById('run-weakness-analysis-btn');
        const subjectSelect = document.getElementById('analysis-subject');
        const selectedSubjectId = subjectSelect.value;

        if (!selectedSubjectId) {
            alert('科目を選択してください');
            return;
        }

        btn.disabled = true;
        btn.textContent = '🤖 分析中...';

        // 1. 学習履歴を取得
        const history = await fetchLearningHistory(currentUser.id);
        
        if (!history || history.length === 0) {
            alert('学習履歴がありません。問題を解いてから分析を実行してください。');
            btn.disabled = false;
            btn.textContent = '🤖 AI弱点分析を実行';
            return;
        }

        // 2. 科目に応じた問題を取得
        let questionsQuery = supabase.from('questions').select('*');
        
        if (selectedSubjectId !== 'all') {
            questionsQuery = questionsQuery.eq('subject_id', selectedSubjectId);
        }
        
        const { data: allQuestions } = await questionsQuery;

        if (!allQuestions || allQuestions.length === 0) {
            alert('選択した科目に問題がありません。');
            btn.disabled = false;
            btn.textContent = '🤖 AI弱点分析を実行';
            return;
        }

        // 3. 選択した科目の問題IDリストを作成
        const questionIds = allQuestions.map(q => q.id);

        // 4. 学習履歴を科目の問題のみにフィルタリング
        const filteredHistory = history.filter(h => questionIds.includes(h.question_id));

        if (filteredHistory.length === 0) {
            alert('選択した科目の学習履歴がありません。問題を解いてから分析を実行してください。');
            btn.disabled = false;
            btn.textContent = '🤖 AI弱点分析を実行';
            return;
        }

        // 5. 誤答ランキングを生成
        const wrongRanking = calculateWrongRanking(filteredHistory, allQuestions);

        if (wrongRanking.length === 0) {
            alert('選択した科目に誤答データがありません。素晴らしいです！');
            btn.disabled = false;
            btn.textContent = '🤖 AI弱点分析を実行';
            return;
        }

        // 6. タグ頻度を集計
        const tagFrequency = calculateTagFrequency(wrongRanking);

        // 7. 科目名を取得
        let subjectName = '全科目';
        if (selectedSubjectId !== 'all') {
            const selectedOption = subjectSelect.options[subjectSelect.selectedIndex];
            subjectName = selectedOption.textContent;
        }

        // 8. 分析用データを作成
        const analysisData = {
            subject: subjectName,
            wrong_question_ranking: wrongRanking.slice(0, 10),
            tag_frequency: tagFrequency,
            total_attempts: filteredHistory.length,
            total_wrong: wrongRanking.reduce((sum, item) => sum + item.wrong_count, 0)
        };

        // 9. AI APIを呼び出して弱点分析
        const aiAnalysisText = await callAiWeaknessAnalysis(analysisData);

        // 10. 結果を表示
        await displayAiAnalysis(aiAnalysisText);
        await displayRecommended(wrongRanking);

        // 11. Supabaseに分析結果を保存
        const recommendedQuestionIds = weaknessQuestions.map(q => q.id);
        await saveWeaknessAnalysisToSupabase({
            subjectId: selectedSubjectId === 'all' ? null : selectedSubjectId,
            subjectName: subjectName,
            aiAnalysis: aiAnalysisText,
            wrongRanking: wrongRanking,
            tagFrequency: tagFrequency,
            totalAttempts: filteredHistory.length,
            totalWrong: wrongRanking.reduce((sum, item) => sum + item.wrong_count, 0),
            recommendedQuestionIds: recommendedQuestionIds
        });

        // 分析コンテナを表示
        document.getElementById('ai-analysis-container').style.display = 'block';

        // クイズエリアは非表示のまま（問題に挑戦ページで利用可能）

        btn.disabled = false;
        btn.textContent = '🤖 AI弱点分析を実行';

        // 画面の一番上にスクロール
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error('AI弱点分析エラー:', error);
        alert('分析中にエラーが発生しました: ' + error.message);
        
        const btn = document.getElementById('run-weakness-analysis-btn');
        btn.disabled = false;
        btn.textContent = '🤖 AI弱点分析を実行';
    }
}

/**
 * 弱点分析結果をSupabaseに保存
 */
async function saveWeaknessAnalysisToSupabase(data) {
    try {
        const { data: result, error } = await supabase
            .from('weakness_analysis')
            .upsert({
                user_id: currentUser.id,
                subject_id: data.subjectId,
                subject_name: data.subjectName,
                ai_analysis: data.aiAnalysis,
                total_attempts: data.totalAttempts,
                total_wrong: data.totalWrong,
                wrong_ranking: data.wrongRanking,
                tag_frequency: data.tagFrequency,
                recommended_question_ids: data.recommendedQuestionIds,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,subject_id' // 既存データがあれば更新
            });

        if (error) {
            console.error('Supabaseへの保存エラー:', error);
            throw error;
        }

        console.log('✅ 分析結果をSupabaseに保存しました');
        return result;
    } catch (error) {
        console.error('分析結果の保存に失敗:', error);
        // エラーでもローカルストレージには保存されているので、処理は継続
    }
}

/**
 * Supabaseから分析結果を取得
 */
async function loadWeaknessAnalysisFromSupabase(subjectId) {
    try {
        let query = supabase
            .from('weakness_analysis')
            .select('*')
            .eq('user_id', currentUser.id);

        // 科目指定がある場合
        if (subjectId && subjectId !== 'all') {
            query = query.eq('subject_id', subjectId);
        } else if (subjectId === 'all') {
            query = query.is('subject_id', null);
        }

        const { data, error } = await query.order('updated_at', { ascending: false }).limit(1).single();

        if (error) {
            if (error.code === 'PGRST116') {
                // データが見つからない場合
                console.log('保存された分析結果がありません');
                return null;
            }
            throw error;
        }

        console.log('✅ Supabaseから分析結果を読み込みました');
        return data;
    } catch (error) {
        console.error('分析結果の読み込みエラー:', error);
        return null;
    }
}

/**
 * Supabaseから最新の分析結果を取得（科目指定なし）
 */
async function loadLatestWeaknessAnalysisFromSupabase() {
    try {
        const { data, error } = await supabase
            .from('weakness_analysis')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                console.log('保存された分析結果がありません');
                return null;
            }
            throw error;
        }

        console.log('✅ 最新の分析結果を読み込みました');
        return data;
    } catch (error) {
        console.error('分析結果の読み込みエラー:', error);
        return null;
    }
}

/**
 * Supabaseから学習履歴を取得
 */
async function fetchLearningHistory(userId) {
    const { data, error } = await supabase
        .from('learning_history')
        .select('*')
        .eq('user_id', userId)
        .order('answered_at', { ascending: false });

    if (error) {
        console.error('学習履歴の取得エラー:', error);
        throw error;
    }

    return data;
}

/**
 * 誤答回数ランキングを生成
 */
function calculateWrongRanking(history, allQuestions) {
    const wrongCount = {};

    // 誤答のみをカウント
    history.forEach(record => {
        if (!record.is_correct) {
            if (!wrongCount[record.question_id]) {
                wrongCount[record.question_id] = 0;
            }
            wrongCount[record.question_id]++;
        }
    });

    // 問題情報と結合してランキング作成
    const ranking = [];
    for (const [questionId, count] of Object.entries(wrongCount)) {
        // UUID対応：文字列として比較
        const question = allQuestions.find(q => q.id === questionId);
        if (question) {
            ranking.push({
                question_id: question.id,
                question_text: question.question_text,
                wrong_count: count,
                tags: question.tags || []
            });
        }
    }

    // 誤答回数の降順でソート
    ranking.sort((a, b) => b.wrong_count - a.wrong_count);

    return ranking;
}

/**
 * タグごとの誤答頻度を集計
 */
function calculateTagFrequency(wrongRanking) {
    const frequency = {};

    wrongRanking.forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach(tag => {
                if (!frequency[tag]) {
                    frequency[tag] = 0;
                }
                frequency[tag] += item.wrong_count;
            });
        }
    });

    return frequency;
}

/**
 * 生成AI APIを呼び出して弱点分析レポートを生成
 * Supabase Edge Function経由でOpenAI APIを呼び出し
 */
async function callAiWeaknessAnalysis(data) {
    const prompt = `あなたは学習ログ分析AIです。
以下の誤答データからユーザーの弱点を分析し、
・よく間違える分野
・ミスの原因の推定
・改善のためのアドバイス
・今後取り組むべき問題の特徴
を 150〜250文字で簡潔に説明してください。

分析対象：
科目: ${data.subject}
${JSON.stringify(data, null, 2)}`;

    try {
        if (!EDGE_FUNCTION_URL) {
            throw new Error('Edge Function URLが設定されていません');
        }

        // 現在のセッショントークンを取得
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('ログインセッションが見つかりません');
        }

        // Supabase Edge Function経由でOpenAI APIを呼び出し
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                model: 'gpt-4o-mini',
                max_tokens: 500
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        // OpenAI APIのレスポンスからテキストを抽出
        if (result.choices && result.choices.length > 0) {
            return result.choices[0].message.content;
        }
        
        throw new Error('APIからの応答が不正です');

    } catch (error) {
        console.error('AI API呼び出しエラー:', error);
        
        // Edge Functionが設定されていない場合やエラー時はダミーの分析を返す
        const topTags = Object.entries(data.tag_frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([tag]) => tag);

        return `【${data.subject} - 分析結果】
誤答が多い分野: ${topTags.join('、') || 'タグ未設定'}
総回答数 ${data.total_attempts} 回のうち ${data.total_wrong} 回の誤答がありました。
特に上位の問題を重点的に復習することをおすすめします。
繰り返し演習することで理解が深まります。

※ AI機能が設定されていないため、簡易分析を表示しています。`;
    }
}

/**
 * AI分析結果を画面に表示
 */
async function displayAiAnalysis(text) {
    const container = document.getElementById('ai-analysis');
    // テキストの前後の空白・改行を削除し、改行は<br>タグに変換
    const cleanText = text.trim().replace(/\n/g, '<br>');
    container.innerHTML = `
        <div style="background: var(--bg-card); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border); line-height: 1.8;">
            ${cleanText}
        </div>
    `;
}

/**
 * 誤答ランキングを画面に表示
 */
async function displayRanking(ranking) {
    const container = document.getElementById('ranking');
    
    if (!ranking || ranking.length === 0) {
        container.innerHTML = '<p class="empty-state">データがありません</p>';
        return;
    }

    const top10 = ranking.slice(0, 10);
    
    const html = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: var(--bg-hover); border-bottom: 2px solid var(--border);">
                    <th style="padding: 0.75rem; text-align: left;">順位</th>
                    <th style="padding: 0.75rem; text-align: left;">問題</th>
                    <th style="padding: 0.75rem; text-align: left;">タグ</th>
                    <th style="padding: 0.75rem; text-align: center;">誤答回数</th>
                </tr>
            </thead>
            <tbody>
                ${top10.map((item, index) => `
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 0.75rem; font-weight: bold;">${index + 1}</td>
                        <td style="padding: 0.75rem;">${item.question_text.substring(0, 50)}${item.question_text.length > 50 ? '...' : ''}</td>
                        <td style="padding: 0.75rem;">
                            ${item.tags.map(tag => `<span style="background: var(--primary); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; margin-right: 0.25rem;">${tag}</span>`).join('')}
                        </td>
                        <td style="padding: 0.75rem; text-align: center; color: var(--danger); font-weight: bold;">${item.wrong_count}回</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

/**
 * おすすめ問題セットを画面に表示（問題データから直接）
 */
async function displayRecommendedFromQuestions(questions, rankingData) {
    const container = document.getElementById('recommended');
    
    if (!questions || questions.length === 0) {
        container.innerHTML = '<p class="empty-state">データがありません</p>';
        return;
    }

    const html = questions.map((q, index) => {
        const wrongItem = rankingData.find(item => item.question_id === q.id);
        const wrongCount = wrongItem ? wrongItem.wrong_count : 0;
        return `
            <div class="recommended-question-item" style="background: var(--bg-card); padding: 1rem; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                    <div>
                        <span style="background: var(--danger); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; margin-right: 0.5rem;">
                            誤答 ${wrongCount}回
                        </span>
                        <span style="color: var(--text-secondary); font-size: 0.9rem;">${q.subjects?.name || '科目不明'}</span>
                    </div>
                </div>
                <div style="font-weight: 500; margin-bottom: 0.5rem;">${q.question_text}</div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    ${(q.tags || []).map(tag => 
                        `<span style="background: var(--secondary-bg); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${tag}</span>`
                    ).join('')}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

/**
 * おすすめ問題セットを画面に表示
 */
async function displayRecommended(ranking) {
    const container = document.getElementById('recommended');
    
    if (!ranking || ranking.length === 0) {
        container.innerHTML = '<p class="empty-state">データがありません</p>';
        return;
    }

    const top10 = ranking.slice(0, 10);
    const questionIds = top10.map(item => item.question_id);

    let questions;
    
    // すでにweaknessQuestionsがセットされている場合はそれを使用（ローカルストレージから復元時）
    if (weaknessQuestions && weaknessQuestions.length > 0) {
        // weaknessQuestionsが既にある場合、それが正しい問題かチェック
        const firstId = questionIds[0];
        const hasMatchingQuestion = weaknessQuestions.some(q => q.id === firstId);
        
        if (hasMatchingQuestion) {
            // 既存のweaknessQuestionsを使用
            questions = weaknessQuestions;
            console.log('✅ 既存のweaknessQuestionsを使用');
        } else {
            // 一致しない場合はSupabaseから再取得
            const { data: fetchedQuestions } = await supabase
                .from('questions')
                .select(`
                    *,
                    subjects (name)
                `)
                .in('id', questionIds);
            questions = fetchedQuestions;
            console.log('✅ Supabaseから問題を再取得');
        }
    } else {
        // weaknessQuestionsがない場合はSupabaseから取得
        const { data: fetchedQuestions } = await supabase
            .from('questions')
            .select(`
                *,
                subjects (name)
            `)
            .in('id', questionIds);
        questions = fetchedQuestions;
        console.log('✅ Supabaseから問題を取得');
    }

    if (!questions || questions.length === 0) {
        container.innerHTML = '<p class="empty-state">問題が見つかりませんでした</p>';
        return;
    }

    // ランキング順にソート
    questions.sort((a, b) => {
        const aRank = top10.findIndex(item => item.question_id === a.id);
        const bRank = top10.findIndex(item => item.question_id === b.id);
        return aRank - bRank;
    });

    // グローバル変数に保存（クイズで使用）
    weaknessQuestions = questions;

    const html = questions.map((q, index) => {
        const wrongCount = top10.find(item => item.question_id === q.id).wrong_count;
        return `
            <div class="recommended-question-item" style="background: var(--bg-card); padding: 1.25rem; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 1rem; transition: all 0.3s ease;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="background: var(--primary); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1rem;">
                            ${index + 1}
                        </div>
                        <div>
                            <span style="background: var(--danger); color: white; padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.85rem; margin-right: 0.5rem; font-weight: 500;">
                                ❌ ${wrongCount}回
                            </span>
                            <span style="color: var(--text-secondary); font-size: 0.9rem;">${q.subjects?.name || '科目不明'}</span>
                        </div>
                    </div>
                </div>
                <div style="font-weight: 500; font-size: 1.05rem; margin-bottom: 0.75rem; line-height: 1.5; color: var(--text-primary);">${q.question_text}</div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    ${(q.tags || []).map(tag => 
                        `<span style="background: var(--bg-hover); color: var(--text-primary); padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.85rem; border: 1px solid var(--border);">#${tag}</span>`
                    ).join('')}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

/**
 * 弱点問題クイズを自動的に開始（分析実行時に呼ばれる）
 */
function autoStartWeaknessQuiz() {
    console.log('🚀 autoStartWeaknessQuiz 呼び出し');
    console.log('📚 weaknessQuestions:', weaknessQuestions);
    console.log('📚 問題数:', weaknessQuestions ? weaknessQuestions.length : 0);

    if (!weaknessQuestions || weaknessQuestions.length === 0) {
        console.log('⚠️ 問題がないため、クイズを表示しない');
        return;
    }

    // クイズデータをセットアップ
    currentQuiz = {
        questions: [...weaknessQuestions],
        currentIndex: 0,
        answers: [],
        correctCount: 0
    };

    console.log('✅ currentQuiz セットアップ完了:', currentQuiz);

    // クイズエリアを表示（分析結果は非表示にしない）
    document.getElementById('weakness-quiz-area').style.display = 'block';
    document.getElementById('weakness-quiz-result').style.display = 'none';
    console.log('👁️ weakness-quiz-area を表示');

    // 問題数を設定
    document.getElementById('weakness-total-questions').textContent = currentQuiz.questions.length;
    
    // 最初の問題を表示
    displayWeaknessQuestion();
    console.log('📝 最初の問題を表示');
}

/**
 * 弱点問題クイズを開始（手動で呼ばれる場合）
 */
function startWeaknessQuiz() {
    console.log('🚀 startWeaknessQuiz 呼び出し');
    console.log('📚 weaknessQuestions:', weaknessQuestions);
    console.log('📚 問題数:', weaknessQuestions ? weaknessQuestions.length : 0);

    if (!weaknessQuestions || weaknessQuestions.length === 0) {
        alert('問題が読み込まれていません。');
        return;
    }

    // クイズデータをセットアップ
    currentQuiz = {
        questions: [...weaknessQuestions],
        currentIndex: 0,
        answers: [],
        correctCount: 0
    };

    console.log('✅ currentQuiz セットアップ完了:', currentQuiz);

    // 分析結果を非表示
    document.getElementById('ai-analysis-container').style.display = 'none';
    console.log('👁️ ai-analysis-container を非表示');

    // クイズエリアを表示
    document.getElementById('weakness-quiz-area').style.display = 'block';
    document.getElementById('weakness-quiz-result').style.display = 'none';
    console.log('👁️ weakness-quiz-area を表示');

    // 問題数を設定
    document.getElementById('weakness-total-questions').textContent = currentQuiz.questions.length;
    
    // 最初の問題を表示
    displayWeaknessQuestion();
    console.log('📝 最初の問題を表示');

    // 画面の一番上にスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * 弱点クイズの問題を表示
 */
function displayWeaknessQuestion() {
    const question = currentQuiz.questions[currentQuiz.currentIndex];
    
    document.getElementById('weakness-current-question').textContent = currentQuiz.currentIndex + 1;
    document.getElementById('weakness-total-questions').textContent = currentQuiz.questions.length;
    
    // 正答率の計算を修正（解答済みの問題数で割る）
    const answeredCount = currentQuiz.answers.length; // 解答済みの問題数
    const accuracy = answeredCount > 0 
        ? ((currentQuiz.correctCount / answeredCount) * 100).toFixed(1)
        : 0;
    document.getElementById('weakness-accuracy').textContent = `${accuracy}%`;

    document.getElementById('weakness-question-text').textContent = question.question_text;

    // 選択肢表示
    const options = document.querySelectorAll('.weakness-option');
    options[0].querySelector('.option-text').textContent = question.option_a;
    options[1].querySelector('.option-text').textContent = question.option_b;
    options[2].querySelector('.option-text').textContent = question.option_c;
    options[3].querySelector('.option-text').textContent = question.option_d;

    // リセット
    options.forEach(btn => {
        btn.classList.remove('selected', 'correct', 'incorrect', 'disabled');
        btn.disabled = false;
    });

    document.getElementById('weakness-answer-feedback').classList.remove('show', 'correct', 'incorrect');
    document.getElementById('weakness-next-btn').style.display = 'none';
}

/**
 * 弱点クイズの解答処理
 */
function handleWeaknessAnswer(e) {
    // 既に解答済みの場合は無視（二重クリック防止）
    if (e.currentTarget.disabled) {
        return;
    }

    const selectedOption = e.currentTarget.dataset.option;
    const question = currentQuiz.questions[currentQuiz.currentIndex];
    const isCorrect = selectedOption === question.correct_answer;

    console.log('🎯 解答処理:', {
        currentIndex: currentQuiz.currentIndex,
        selectedOption,
        correctAnswer: question.correct_answer,
        isCorrect,
        currentCorrectCount: currentQuiz.correctCount,
        currentAnswersLength: currentQuiz.answers.length
    });

    // ボタンを無効化
    document.querySelectorAll('.weakness-option').forEach(btn => {
        btn.disabled = true;
        btn.classList.add('disabled');
    });

    // 選択したボタンをハイライト
    e.currentTarget.classList.add('selected');

    // 正誤を表示
    setTimeout(() => {
        document.querySelectorAll('.weakness-option').forEach(btn => {
            if (btn.dataset.option === question.correct_answer) {
                btn.classList.add('correct');
            } else if (btn.dataset.option === selectedOption && !isCorrect) {
                btn.classList.add('incorrect');
            }
        });

        const feedback = document.getElementById('weakness-answer-feedback');
        feedback.innerHTML = `
            <div class="feedback-result ${isCorrect ? 'correct' : 'incorrect'}">
                ${isCorrect ? '✅ 正解！' : '❌ 不正解'}
            </div>
            <div class="feedback-answer">正解: ${question.correct_answer}</div>
            ${question.explanation ? `<div class="feedback-explanation">${question.explanation}</div>` : ''}
        `;
        feedback.classList.add('show', isCorrect ? 'correct' : 'incorrect');

        document.getElementById('weakness-next-btn').style.display = 'block';

        // 結果を記録
        currentQuiz.answers.push({
            question: question,
            userAnswer: selectedOption,
            isCorrect: isCorrect
        });

        if (isCorrect) {
            currentQuiz.correctCount++;
        }

        console.log('✅ 解答記録後:', {
            correctCount: currentQuiz.correctCount,
            answersLength: currentQuiz.answers.length,
            totalQuestions: currentQuiz.questions.length
        });

        // 学習履歴に保存
        saveLearningHistory(question.id, selectedOption, isCorrect);
    }, 500);
}

/**
 * 次の弱点問題へ
 */
function nextWeaknessQuestion() {
    console.log('➡️ 次の問題へ:', {
        currentIndex: currentQuiz.currentIndex,
        answersLength: currentQuiz.answers.length,
        correctCount: currentQuiz.correctCount,
        totalQuestions: currentQuiz.questions.length
    });

    currentQuiz.currentIndex++;

    console.log('➡️ インデックス更新後:', {
        newIndex: currentQuiz.currentIndex,
        totalQuestions: currentQuiz.questions.length,
        shouldShowResult: currentQuiz.currentIndex >= currentQuiz.questions.length
    });

    if (currentQuiz.currentIndex < currentQuiz.questions.length) {
        displayWeaknessQuestion();
    } else {
        showWeaknessQuizResult();
    }
    // スクロールを完全に削除：すべてのケースで画面位置を保持
}

/**
 * 弱点クイズの結果を表示
 */
function showWeaknessQuizResult() {
    console.log('📊 結果表示:', {
        totalQuestions: currentQuiz.questions.length,
        correctCount: currentQuiz.correctCount,
        answersLength: currentQuiz.answers.length,
        answers: currentQuiz.answers
    });

    // クイズエリアの問題部分を非表示
    document.querySelector('#weakness-quiz-area .quiz-header').style.display = 'none';
    document.querySelector('#weakness-quiz-area .quiz-content').style.display = 'none';
    
    // 結果を表示
    document.getElementById('weakness-quiz-result').style.display = 'block';

    const total = currentQuiz.questions.length;
    const correct = currentQuiz.correctCount;
    const percentage = ((correct / total) * 100).toFixed(1);

    document.getElementById('weakness-result-percentage').textContent = `${percentage}%`;
    document.getElementById('weakness-result-correct').textContent = correct;
    document.getElementById('weakness-result-total').textContent = total;

    // 間違えた問題を表示
    const wrongQuestions = currentQuiz.answers.filter(a => !a.isCorrect);
    const wrongList = document.getElementById('weakness-wrong-list');

    if (wrongQuestions.length === 0) {
        wrongList.innerHTML = '<p class="empty-state">全問正解です！🎉</p>';
    } else {
        const html = wrongQuestions.map((answer, index) => `
            <div class="wrong-question-item">
                <div><strong>問題 ${index + 1}:</strong> ${answer.question.question_text}</div>
                <div style="margin-top: 0.5rem; color: var(--danger);">あなたの回答: ${answer.userAnswer}</div>
                <div style="color: var(--secondary);">正解: ${answer.question.correct_answer}</div>
                ${answer.question.explanation ? `<div style="margin-top: 0.5rem; color: var(--text-secondary);">${answer.question.explanation}</div>` : ''}
            </div>
        `).join('');

        wrongList.innerHTML = html;
    }
}

/**
 * 弱点クイズをリトライ
 */
function retryWeaknessQuiz() {
    currentQuiz.currentIndex = 0;
    currentQuiz.answers = [];
    currentQuiz.correctCount = 0;

    document.getElementById('weakness-quiz-result').style.display = 'none';
    document.querySelector('#weakness-quiz-area .quiz-header').style.display = 'flex';
    document.querySelector('#weakness-quiz-area .quiz-content').style.display = 'block';

    displayWeaknessQuestion();
    // スクロールを削除：画面位置を保持
}

/**
 * 分析結果に戻る
 */
function backToAnalysisResult() {
    // クイズエリアを非表示
    document.getElementById('weakness-quiz-area').style.display = 'none';
    
    // クイズ状態をリセット
    document.querySelector('#weakness-quiz-area .quiz-header').style.display = 'flex';
    document.querySelector('#weakness-quiz-area .quiz-content').style.display = 'block';
    document.getElementById('weakness-quiz-result').style.display = 'none';

    // 分析結果を再表示
    document.getElementById('ai-analysis-container').style.display = 'block';

    // スクロールを削除：画面位置を保持
}

// =========================================
// AI自動作問機能
// =========================================

/**
 * 自動作問モーダルを開く
 */
function openAutoGenerateModal() {
    const modal = document.getElementById('auto-generate-modal');
    
    // フォームをリセット
    document.getElementById('textbook-image').value = '';
    document.getElementById('textbook-preview').innerHTML = '';
    document.getElementById('num-questions').value = '5';
    document.getElementById('generation-status').style.display = 'none';
    document.getElementById('generated-questions-preview').style.display = 'none';
    document.getElementById('generate-questions-btn').style.display = 'inline-block';
    document.getElementById('save-generated-questions-btn').style.display = 'none';
    
    generatedQuestions = [];
    
    modal.classList.add('active');
}

/**
 * 教科書画像のプレビュー
 */
function handleTextbookImagePreview(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('textbook-preview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            preview.innerHTML = `<img src="${event.target.result}" alt="教科書プレビュー" style="max-width: 100%; border-radius: 8px;">`;
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
    }
}

/**
 * 画像をBase64に変換
 */
async function imageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * OpenAI APIを使って問題を生成（Edge Function経由）
 */
async function handleGenerateQuestions() {
    const imageFile = document.getElementById('textbook-image').files[0];
    const numQuestions = parseInt(document.getElementById('num-questions').value);
    
    // バリデーション
    if (!imageFile) {
        alert('画像を選択してください');
        return;
    }
    
    if (!EDGE_FUNCTION_URL) {
        alert('Edge Function URLが設定されていません。config.jsを確認してください。');
        return;
    }
    
    // ステータス表示
    document.getElementById('generation-status').style.display = 'block';
    document.getElementById('status-text').textContent = '📸 画像から重要な単語を読み取り中...';
    document.getElementById('generate-questions-btn').disabled = true;
    
    try {
        // 画像をBase64に変換
        const base64Image = await imageToBase64(imageFile);
        
        document.getElementById('status-text').textContent = '🤖 AIが重要単語に基づいて問題を生成中...';
        
        // 現在のセッショントークンを取得
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('ログインセッションが見つかりません');
        }
        
        // Supabase Edge Function経由でOpenAI APIを呼び出し
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: `この教科書の画像から、重要なキーワードや概念を抽出し、${numQuestions}個の四択問題を作成してください。

重要事項：
- 問題は教科書の内容に基づいて作成してください
- 正解は必ずA, B, C, Dのいずれかで指定してください
- 解説は簡潔に書いてください
- タグは内容を表すキーワードを2-3個つけてください

以下のJSON形式で出力してください：
{
  "questions": [
    {
      "question_text": "問題文",
      "option_a": "選択肢A",
      "option_b": "選択肢B", 
      "option_c": "選択肢C",
      "option_d": "選択肢D",
      "correct_answer": "A",
      "explanation": "解説文",
      "tags": ["タグ1", "タグ2"]
    }
  ]
}`
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 4000
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API呼び出しに失敗しました');
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content;
        
        // JSONモードを使用しているため、直接パース可能
        const parsedContent = JSON.parse(content);
        
        generatedQuestions = parsedContent.questions;
        
        // バリデーション
        if (!generatedQuestions || generatedQuestions.length === 0) {
            throw new Error('問題が生成されませんでした。画像を変更して再試行してください。');
        }
        
        // プレビューを表示
        displayGeneratedQuestionsPreview();
        
        document.getElementById('generation-status').style.display = 'none';
        document.getElementById('generate-questions-btn').disabled = false;
        document.getElementById('save-generated-questions-btn').style.display = 'inline-block';
        
    } catch (error) {
        console.error('問題生成エラー:', error);
        alert('問題の生成に失敗しました: ' + error.message);
        document.getElementById('generation-status').style.display = 'none';
        document.getElementById('generate-questions-btn').disabled = false;
    }
}

/**
 * 生成された問題のプレビューを表示
 */
function displayGeneratedQuestionsPreview() {
    const container = document.getElementById('preview-list');
    const previewSection = document.getElementById('generated-questions-preview');
    
    const html = generatedQuestions.map((q, index) => `
        <div class="preview-question-item">
            <div class="question-text"><strong>問題${index + 1}:</strong> ${q.question_text}</div>
            <div class="options">
                A: ${q.option_a}<br>
                B: ${q.option_b}<br>
                C: ${q.option_c}<br>
                D: ${q.option_d}
            </div>
            <div class="correct-answer">正解: ${q.correct_answer}</div>
            ${q.explanation ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.3rem;">解説: ${q.explanation}</div>` : ''}
            ${q.tags && q.tags.length > 0 ? `<div style="margin-top: 0.3rem;">${q.tags.map(tag => `<span class="tag">${tag}</span>`).join(' ')}</div>` : ''}
        </div>
    `).join('');
    
    container.innerHTML = html;
    previewSection.style.display = 'block';
}

/**
 * 生成された問題をデータベースに保存
 */
async function handleSaveGeneratedQuestions() {
    if (generatedQuestions.length === 0) {
        alert('保存する問題がありません');
        return;
    }
    
    if (!currentSubjectId) {
        alert('科目が選択されていません');
        return;
    }
    
    try {
        document.getElementById('status-text').textContent = '問題を保存中...';
        document.getElementById('generation-status').style.display = 'block';
        document.getElementById('save-generated-questions-btn').disabled = true;
        
        // 問題を一つずつ保存
        for (const question of generatedQuestions) {
            await supabase.from('questions').insert([{
                subject_id: currentSubjectId,
                question_text: question.question_text,
                option_a: question.option_a,
                option_b: question.option_b,
                option_c: question.option_c,
                option_d: question.option_d,
                correct_answer: question.correct_answer,
                explanation: question.explanation || '',
                tags: question.tags || [],
                question_image_url: null
            }]);
        }
        
        alert(`${generatedQuestions.length}個の問題を保存しました！`);
        
        // モーダルを閉じて科目詳細を再読み込み
        closeAllModals();
        openSubjectDetail(currentSubjectId);
        
    } catch (error) {
        console.error('保存エラー:', error);
        alert('問題の保存に失敗しました: ' + error.message);
    } finally {
        document.getElementById('generation-status').style.display = 'none';
        document.getElementById('save-generated-questions-btn').disabled = false;
    }
}

})(); // 即時実行関数の終了
