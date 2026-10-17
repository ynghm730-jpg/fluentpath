import { useMemo, useState, type FC, type ReactNode } from 'react';
import { AudioLines, BarChart3, CalendarClock, CircleHelp, Gauge, Mic2, MessagesSquare, Target } from 'lucide-react';
import type { ConversationSession, QuickResponseAttempt, ReviewCard } from '../types';
import { calculateSpeakingAnalytics, type SpeakingPeriod } from '../services/speakingAnalytics';

interface Props {
  quickResponses: QuickResponseAttempt[];
  conversations: ConversationSession[];
  reviews: ReviewCard[];
}

const periods: SpeakingPeriod[] = [7, 30, 90];
const percent = (a: number, b: number) => b > 0 ? `${Math.round(100 * a / b)}%` : '—';
const seconds = (ms: number | null) => ms === null ? '—' : `${(ms / 1000).toFixed(1)}秒`;

const Metric: FC<{ label: string; value: string; detail: string; icon: ReactNode }> = ({ label, value, detail, icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
    <div className="flex items-start justify-between gap-1 text-slate-500"><span className="text-[11px] font-semibold">{label}</span>{icon}</div>
    <p className="mt-2 text-2xl font-extrabold text-slate-900 tabular-nums">{value}</p>
    <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{detail}</p>
  </div>
);

export const SpeakingDashboard: FC<Props> = ({ quickResponses, conversations, reviews }) => {
  const [period, setPeriod] = useState<SpeakingPeriod>(30);
  const [today] = useState(() => new Date());
  const data = useMemo(() => calculateSpeakingAnalytics(quickResponses, conversations, reviews, period, today),
    [quickResponses, conversations, reviews, period, today]);
  const quick = data.current;
  const previous = data.previous;
  const absoluteDelta = quick.averageMs !== null && previous.averageMs !== null
    ? quick.averageMs - previous.averageMs : null;
  const previousDetail = absoluteDelta === null ? '前の同期間との比較：データ不足'
    : `前の${period}日間比 ${absoluteDelta > 0 ? '+' : ''}${(absoluteDelta / 1000).toFixed(1)}秒（短いほど速い）`;
  const maxLatency = Math.max(1000, ...data.quickTrend.map(b => b.averageMs ?? 0));
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="rounded-2xl bg-gradient-to-r from-indigo-700 to-blue-700 p-4 text-white">
        <div className="flex items-center gap-2 text-sm font-extrabold"><Mic2 className="h-5 w-5"/> スピーキング成長分析</div>
        <p className="mt-1 text-[11px] leading-relaxed text-indigo-100">この端末の即答トレ・英語会議・AI復習カードの保存記録を集計します。Gemini APIは使用しません。</p>
      </div>
      <div className="grid grid-cols-3 rounded-xl bg-slate-200/70 p-1 gap-1" aria-label="集計期間">
        {periods.map(p => <button key={p} type="button" onClick={() => setPeriod(p)} aria-pressed={p === period}
          className={`rounded-lg py-2 text-xs font-bold ${p === period ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}>{p}日</button>)}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Metric label="最初の入力まで（参考）" value={seconds(quick.averageMs)} icon={<Gauge className="h-4 w-4 flex-shrink-0"/>}
          detail={`${quick.measured}/${quick.attempts}件で測定。${previousDetail}`} />
        <Metric label="時間内回答率" value={percent(quick.onTime, quick.attempts)} icon={<Target className="h-4 w-4 flex-shrink-0"/>}
          detail={`${quick.onTime}/${quick.attempts}件。無回答は未達成として集計`} />
        <Metric label="すぐ言えた割合" value={percent(quick.perfect, quick.attempts)} icon={<BarChart3 className="h-4 w-4 flex-shrink-0"/>}
          detail={`自己評価：すぐ言えた ${quick.perfect}件 / 全${quick.attempts}件`} />
        <Metric label="英語会議の練習回数" value={`${data.meetings.total}回`} icon={<MessagesSquare className="h-4 w-4 flex-shrink-0"/>}
          detail={`AI会議 ${data.meetings.ai}回 / 無料会議 ${data.meetings.script}回`} />
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3" aria-label="即答時間の推移">
        <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-extrabold text-slate-800">最初の入力までの時間</h3><AudioLines className="h-4 w-4 text-indigo-600"/></div>
        <p className="text-[10px] leading-relaxed text-slate-500">音声は「最初の認識結果」、文字入力は「最初の入力」まで。無回答の時間は平均に含みません。サンプル数も併記します。</p>
        {quick.measured === 0 ? <p className="py-4 text-center text-xs text-slate-500">選択した期間には時間を測定できた回答がありません。</p> : (
          <div className="grid grid-flow-col auto-cols-fr items-end gap-1" role="img" aria-label={data.quickTrend.map(b => `${b.label}: ${seconds(b.averageMs)}、${b.measured}件`).join('、')}>
            {data.quickTrend.map(bucket => <div key={bucket.key} className="flex min-w-0 flex-col items-center gap-1">
              <span className="text-[10px] font-bold tabular-nums text-slate-600">{bucket.averageMs === null ? '—' : `${(bucket.averageMs / 1000).toFixed(1)}s`}</span>
              <div className="h-28 w-full flex items-end justify-center rounded-md bg-slate-50">
                {bucket.averageMs === null
                  ? <div className="h-0.5 w-full max-w-8 bg-slate-200"/>
                  : <div className="w-full max-w-8 rounded-t-md bg-gradient-to-t from-indigo-600 to-blue-400"
                    style={{ height: `${Math.max(5, (bucket.averageMs / maxLatency) * 100)}%` }} />}
              </div>
              <span className="text-[9px] tabular-nums text-slate-500">{bucket.measured}件</span>
              <span className="break-all text-center text-[9px] leading-tight text-slate-500">{bucket.label}</span>
            </div>)}
          </div>
        )}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-extrabold text-slate-800">制限時間別の達成率</h3>
        {data.limits.map(item => <div key={item.limit} className="space-y-1.5">
          <div className="flex justify-between text-xs"><span className="font-bold text-slate-700">{item.limit}秒</span><span className="text-slate-600">{percent(item.onTime, item.attempts)} <span className="text-[10px]">({item.onTime}/{item.attempts}件)</span></span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${item.attempts ? item.onTime / item.attempts * 100 : 0}%` }} /></div>
        </div>)}
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2 text-center text-[10px]">
          <div>音声入力<strong className="block text-base">{quick.voice}</strong></div>
          <div>文字入力<strong className="block text-base">{quick.text}</strong></div>
          <div>未回答<strong className="block text-base">{quick.noInput}</strong></div>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2"><MessagesSquare className="h-4 w-4 text-indigo-600"/><h3 className="text-sm font-extrabold text-slate-800">英語会議の練習分析</h3></div>
        <p className="text-[11px] text-slate-600">{period}日間の回答を含む保存済み会議：<strong>{data.meetings.total}回</strong>、発言<strong>{data.meetings.userReplies}回</strong></p>
        {data.meetings.total === 0 ? <p className="text-xs text-slate-500">期間内の会議練習はまだありません。</p> : <>
          <div className="rounded-xl bg-indigo-50 p-3 text-[11px] text-indigo-900">
            自己評価あり {data.meetings.rated}/{data.meetings.total}回：すぐ言えた {data.meetings.perfect}・少し考えた {data.meetings.good}・難しかった {data.meetings.hard}
          </div>
          <div className="space-y-2">{data.meetings.scenarios.map(s => <div key={s.id} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
            <div className="min-w-0"><p className="text-xs font-bold text-slate-700">{s.label}</p><p className="text-[10px] text-slate-500">自己評価あり {s.rated}回 / 発言 {s.replies}回</p></div>
            <span className="shrink-0 text-sm font-extrabold text-indigo-700">{s.sessions}回</span>
          </div>)}</div>
        </>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-indigo-600"/><h3 className="text-sm font-extrabold text-slate-800">AI添削からの復習状況</h3></div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-indigo-50 p-3"><p className="text-2xl font-extrabold text-indigo-900">{data.aiReview.total}</p><p className="text-[10px] text-slate-600">現在のAI復習カード</p></div>
          <div className="rounded-xl bg-amber-50 p-3"><p className="text-2xl font-extrabold text-amber-900">{data.aiReview.due}</p><p className="text-[10px] text-slate-600">今日までの復習待ち</p></div>
        </div>
        <p className="text-[11px] text-slate-600">未復習 {data.aiReview.newCards}件 / 1回以上復習 {data.aiReview.practiced}件</p>
        <p className="text-[11px] text-slate-600">段階1〜5：{data.aiReview.intermediate}件 / 段階6以上：{data.aiReview.advanced}件</p>
        <p className="text-[10px] leading-relaxed text-slate-500">表示は現時点の復習カードの状態です。過去の段階変更履歴は保存されていないため、習得度の時系列推移やAI添削の点数は推測しません。</p>
      </section>
      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
        <CircleHelp className="mt-0.5 h-4 w-4 shrink-0"/>
        <p>音声認識の遅延や手入力が混在するため、測定値は厳密な「話し始めるまでの時間」ではありません。AI返答の初文字・音声開始時刻は会話履歴に保存されていないため、この分析には含めていません。MacBookとPixelの結果は自動同期されません。</p>
      </div>
    </div>
  );
};
