import { useState, useEffect, useCallback } from 'react';
import type { TabType } from './components/BottomNav';
import type { StudyRecord, PhraseItem } from './types';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { QuickPromptView } from './components/QuickPromptView';
import { QuickResponseView } from './components/QuickResponseView';
import { RepeatView } from './components/RepeatView';
import { ConversationView } from './components/ConversationView';
import { ReviewView } from './components/ReviewView';
import { PhrasebookView } from './components/PhrasebookView';
import { StatsDataView } from './components/StatsDataView';
import { Toast, type ToastMessage } from './components/Toast';
import { db, getTodayRecords, getWeakRecords } from './services/db';
import { calculateAnalytics } from './services/analytics';
import { startAutoSync, queueAutoSync, subscribeSyncDataChanges } from './services/autoSync';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [quickMode, setQuickMode] = useState<'composition' | 'response'>('composition');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [todayRecords, setTodayRecords] = useState<StudyRecord[]>([]);
  const [phraseCount, setPhraseCount] = useState<number>(0);
  const [weakCount, setWeakCount] = useState<number>(0);
  const [streakDays, setStreakDays] = useState<number>(0);

  // トースト表示ヘルパー
  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      const newToast: ToastMessage = {
        id: `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type,
        message,
      };
      setToasts((prev) => [...prev, newToast]);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // データの再同期
  const refreshAppData = useCallback(async () => {
    try {
      const records = await getTodayRecords();
      setTodayRecords(records);

      const pCount = await db.phrases.count();
      setPhraseCount(pCount);

      const weaks = await getWeakRecords();
      setWeakCount(weaks.length);

      // 連続した回答日のみを数える（従来の累計日数表示を修正）。
      const allRecords = await db.records.toArray();
      setStreakDays(calculateAnalytics(allRecords, [], []).currentStreak);
    } catch (err) {
      console.error('Failed to sync app data:', err);
    }
  }, []);

  // Only foreground opt-in sync. Refresh dashboard counters when remote items arrive.
  useEffect(() => {
    const stop = startAutoSync();
    const unsubscribe = subscribeSyncDataChanges(() => { void refreshAppData(); });
    return () => { unsubscribe(); stop(); };
  }, [refreshAppData]);

  const learningChanged = useCallback(() => {
    void refreshAppData();
    queueAutoSync();
  }, [refreshAppData]);

  // 初回起動時の初期化（初期フレーズのシード）
  useEffect(() => {
    const initApp = async () => {
      try {
        const count = await db.phrases.count();
        if (count === 0) {
          // 初回起動時に役立つ初期フレーズを5件プレゼント
          const initialSamples: PhraseItem[] = [
            {
              id: 'seed-1',
              english: 'In my opinion, we should focus on testing the prototype first.',
              japanese: '私の考えでは、まずプロトタイプのテストに注力すべきです。',
              notes: '会議で発言を切り出す定番フレーズ。"focus on ~"（注力する）',
              tags: ['会議', '意見', '仕事'],
              isBookmarked: true,
              reviewCount: 1,
              createdAt: new Date().toISOString(),
            },
            {
              id: 'seed-2',
              english: 'We need to finish this project by next Friday.',
              japanese: '来週の金曜日までに、このプロジェクトを終わらせる必要があります。',
              notes: '期限を表す「〜までに」は until ではなく by。',
              tags: ['期限', '数字', '仕事'],
              isBookmarked: true,
              reviewCount: 0,
              createdAt: new Date().toISOString(),
            },
            {
              id: 'seed-3',
              english: 'Could you give us a quick update on the current progress?',
              japanese: '現在の進捗状況を簡単に教えていただけますか？',
              notes: '会議で進捗を尋ねる洗練された表現。「a quick update」が自然。',
              tags: ['会議', '進捗', '仕事'],
              isBookmarked: true,
              reviewCount: 0,
              createdAt: new Date().toISOString(),
            },
            {
              id: 'seed-4',
              english: 'Can I get an iced latte with oat milk to go, please?',
              japanese: 'アイスラテをオーツミルクで、持ち帰りでお願いします。',
              notes: 'アメリカのカフェでの注文。"to go" はテイクアウト。',
              tags: ['コーヒー', '日常', 'カフェ'],
              isBookmarked: true,
              reviewCount: 0,
              createdAt: new Date().toISOString(),
            },
            {
              id: 'seed-5',
              english: 'Where is the gate for my connecting flight to San Francisco?',
              japanese: 'サンフランシスコ行きの乗り継ぎ便のゲートはどこですか？',
              notes: '海外旅行の空港で必須。「乗り継ぎ便」は connecting flight。',
              tags: ['旅行', '空港', '日常'],
              isBookmarked: true,
              reviewCount: 0,
              createdAt: new Date().toISOString(),
            },
          ];
          await db.phrases.bulkPut(initialSamples);
        }
        await refreshAppData();
      } catch (err) {
        console.error('App init error:', err);
      }
    };

    initApp();
  }, [refreshAppData]);

  // タブ切り替え時にトップへスクロール
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between selection:bg-blue-100">
      {/* トースト通知 */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* トップヘッダー */}
      <Header streakDays={streakDays} todayCount={todayRecords.length} />

      {/* メインコンテンツエリア（スマホ優先：max-w-md で見やすくセンタリング） */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-4 pb-20">
        {activeTab === 'home' && (
          <HomeView
            onNavigate={(tab) => handleTabChange(tab)}
            todayRecords={todayRecords}
            phraseCount={phraseCount}
            weakCount={weakCount}
          />
        )}

        {activeTab === 'quick' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-1 border border-slate-200 grid grid-cols-2 gap-1" aria-label="学習モード切り替え">
              <button type="button" onClick={() => setQuickMode('composition')}
                className={`rounded-xl py-2 text-sm font-bold ${quickMode === 'composition' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
                瞬間英作文
              </button>
              <button type="button" onClick={() => setQuickMode('response')}
                className={`rounded-xl py-2 text-sm font-bold ${quickMode === 'response' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>
                即答トレ
              </button>
            </div>
            {quickMode === 'composition' ? (
              <QuickPromptView onShowToast={showToast} onRecordSaved={learningChanged} />
            ) : (
              <QuickResponseView onShowToast={showToast} onDataChanged={learningChanged} />
            )}
          </div>
        )}

        {activeTab === 'repeat' && (
          <RepeatView
            onShowToast={showToast}
            onRecordSaved={learningChanged}
          />
        )}

        {activeTab === 'conversation' && (
          <ConversationView onShowToast={showToast} onDataChanged={learningChanged} />
        )}

        {activeTab === 'review' && (
          <ReviewView onShowToast={showToast} onRecordSaved={learningChanged} />
        )}

        {activeTab === 'phrasebook' && (
          <PhrasebookView
            onShowToast={showToast}
            onRefreshPhraseCount={learningChanged}
          />
        )}

        {activeTab === 'stats' && (
          <StatsDataView
            onShowToast={showToast}
            onRefreshData={refreshAppData}
          />
        )}
      </main>

      {/* スマホ下部固定ナビゲーション */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={handleTabChange}
        phraseCount={phraseCount}
      />
    </div>
  );
}

export default App;
