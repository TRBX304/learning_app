// Supabaseの設定（ユーザーが自分の値に置き換える必要があります）
const SUPABASE_URL = 'https://etgwytkuwxdogonqokjd.supabase.co'; // 例: 'https://xxxxx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0Z3d5dGt1d3hkb2dvbnFva2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTY4NzUsImV4cCI6MjA4MDMzMjg3NX0.8j2TDRnLf3BqI4mBFzxsm5tIKuNtpJs2N1mNAtjnCEU';

// 設定が正しく読み込まれているかチェック
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Supabaseの設定が見つかりません。config.jsファイルを作成してください。');
    alert('アプリの設定が完了していません。README.mdを参照してconfig.jsファイルを作成してください。');
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

    // 解答ボタン
    document.querySelectorAll('.option-btn').forEach(btn => {
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

    // 過去7日間のデータを取得
    const today = new Date();
    const days = [];
    const counts = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const { count } = await supabase
            .from('learning_history')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .gte('answered_at', `${dateStr} 00:00:00`)
            .lt('answered_at', `${dateStr} 23:59:59`);

        days.push(`${date.getMonth() + 1}/${date.getDate()}`);
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

    if (subjects) {
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.id;
            option.textContent = subject.name;
            select.appendChild(option);
        });
    }
}

async function startQuiz() {
    const subjectId = document.getElementById('quiz-subject').value;
    const count = parseInt(document.getElementById('quiz-count').value);

    if (!subjectId) {
        alert('科目を選択してください');
        return;
    }

    // 問題を取得
    const { data: questions } = await supabase
        .from('questions')
        .select('*')
        .eq('subject_id', subjectId);

    if (!questions || questions.length === 0) {
        alert('この科目には問題がありません');
        return;
    }

    // ランダムにシャッフルして指定数だけ取得
    const shuffled = questions.sort(() => Math.random() - 0.5);
    currentQuiz.questions = shuffled.slice(0, Math.min(count, questions.length));
    currentQuiz.currentIndex = 0;
    currentQuiz.answers = [];
    currentQuiz.correctCount = 0;

    // 画面を切り替え
    document.getElementById('quiz-setup').classList.remove('active');
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
    document.getElementById('quiz-setup').classList.add('active');
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
