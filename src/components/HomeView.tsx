import type { FC } from 'react';
import { Play, CheckCircle2, Circle, ArrowRight, Sparkles, Clock, Target, Calendar } from 'lucide-react';
import type { TabType } from './BottomNav';
import type { StudyRecord } from '../types';

interface HomeViewProps {
  onNavigate: (tab: TabType, filter?: string) => void;
  todayRecords: StudyRecord[];
  phraseCount: number;
  weakCount: number;
}

export const HomeView: FC<HomeViewProps> = ({
  onNavigate,
  todayRecords,
  phraseCount,
  weakCount,
}) => {
  // 今日の完了度チェック
  const quickCount = todayRecords.filter((r) => r.type === 'quick').length;
  const repeatCount = todayRecords.filter((r) => r.type === 'repeat').length;
  const phraseCountReviewed = todayRecords.filter((r) => r.type === 'phrase').length;

  const quickDone = quickCount >= 5;
  const repeatDone = repeatCount >= 5;
  const phraseDone = phraseCountReviewed >= 3 || (phraseCount > 0 && phraseCountReviewed > 0);

  const completedSteps = (quickDone ? 1 : 0) + (repeatDone ? 1 : 0) + (phraseDone ? 1 : 0);
  const progressPercent = Math.round((completedSteps / 3) * 100);

  return (
    <div className="space-y-5 pb-8 animate-in fade-in duration-300">
      {/* ヒーローカード: 目標と今日の15分進捗 */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-3xl p-5 text-white shadow-xl shadow-blue-500/15">
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium">
            <Target className="w-3.5 h-3.5 text-blue-200" />
            <span>目標: 会議即答 & VERSANT 60</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-blue-100 font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>15分/日</span>
          </div>
        </div>

        <h2 className="text-xl font-bold tracking-tight">今日の15分ルーティン</h2>
        <p className="text-xs text-blue-100 mt-1 leading-relaxed">
          瞬間英作文で脳の英語回路を回し、リピートで会議のリズムと数字を定着させましょう。
        </p>

        {/* プログレスバー */}
        <div className="mt-4 pt-3 border-t border-white/15">
          <div className="flex justify-between text-xs font-semibold mb-1.5">
            <span>達成度: {completedSteps} / 3 ステップ</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full h-2.5 bg-black/20 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(progressPercent, 4)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 今日の3ステップカード */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>本日の推奨メニュー</span>
          </h3>
          <span className="text-xs text-slate-500">合計 15分</span>
        </div>

        <div className="space-y-3">
          {/* Step 1: 瞬間英作文 */}
          <div
            onClick={() => onNavigate('quick')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
              quickDone
                ? 'bg-emerald-50/60 border-emerald-200'
                : 'bg-white border-slate-200 hover:border-blue-400 shadow-sm active:scale-[0.99]'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {quickDone ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 fill-emerald-100" />
                  ) : (
                    <Circle className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      Step 1 · 5分
                    </span>
                    <span className="text-xs text-slate-500">（進捗: {quickCount}/5問）</span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mt-1">瞬間英作文で瞬発力を鍛える</h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    日本語を見て5〜10秒で発話。仕事会議や数字・期限の表現を即答！
                  </p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0 ml-2">
                <Play className="w-4 h-4 ml-0.5 fill-blue-600" />
              </div>
            </div>
          </div>

          {/* Step 2: リピート練習 */}
          <div
            onClick={() => onNavigate('repeat')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
              repeatDone
                ? 'bg-emerald-50/60 border-emerald-200'
                : 'bg-white border-slate-200 hover:border-blue-400 shadow-sm active:scale-[0.99]'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {repeatDone ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 fill-emerald-100" />
                  ) : (
                    <Circle className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                      Step 2 · 5分
                    </span>
                    <span className="text-xs text-slate-500">（進捗: {repeatCount}/5問）</span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mt-1">9〜15語の文をリピート</h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    アメリカ英語（en-US）の音声を聴き取り、息継ぎ・イントネーションを完全再現。
                  </p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0 ml-2">
                <Play className="w-4 h-4 ml-0.5 fill-indigo-600" />
              </div>
            </div>
          </div>

          {/* Step 3: フレーズ復習 */}
          <div
            onClick={() => onNavigate('phrasebook')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
              phraseDone
                ? 'bg-emerald-50/60 border-emerald-200'
                : 'bg-white border-slate-200 hover:border-blue-400 shadow-sm active:scale-[0.99]'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {phraseDone ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 fill-emerald-100" />
                  ) : (
                    <Circle className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                      Step 3 · 5分
                    </span>
                    <span className="text-xs text-slate-500">（登録: {phraseCount}件）</span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mt-1">苦手フレーズの復習</h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    間違えた問題やストックした重要表現を総復習して脳に定着。
                  </p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0 ml-2">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 苦手復習クイックバナー（苦手問題がある場合） */}
      {weakCount > 0 && (
        <div
          onClick={() => onNavigate('stats')}
          className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-rose-100/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center font-bold text-sm">
              {weakCount}
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-900">要復習の苦手問題があります</h4>
              <p className="text-xs text-rose-700">「言えなかった」とマークした問題を確認する</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-rose-600" />
        </div>
      )}

      {/* スピーキング上達のワンポイントTips */}
      <div className="p-4 bg-slate-100/80 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider mb-1">
          <Sparkles className="w-4 h-4" />
          <span>B1→VERSANT 60へのTips</span>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          完璧な文法を目指して沈黙するよりも、<strong>"In my opinion..."</strong> や <strong>"Could you give us a quick update..."</strong> のような文頭の決まり文句で即座に口火を切り、話し始める瞬発力が最も評価されます。
        </p>
      </div>

      {/* スマホPWA案内 */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/70 rounded-2xl text-xs text-slate-700 space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-blue-800">
          <span>📲 Pixel 8 Pro等でアプリとして使うには</span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Chromeの右上メニュー（<strong>︙</strong>）をタップし、<strong>「ホーム画面に追加」</strong>または<strong>「アプリをインストール」</strong>を選ぶと、アドレスバーなしの全画面アプリとして毎日サクサク起動できます。
        </p>
      </div>
    </div>
  );
};
