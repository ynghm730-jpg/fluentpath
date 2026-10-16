import { useMemo, useState, type FC } from 'react';
import { CalendarCheck2, ChartNoAxesColumn, Clock3, Flame, MessagesSquare, Target, TrendingUp } from 'lucide-react';
import type { ConversationSession, ReviewCard, StudyRecord } from '../types';
import { buildTrend, calculateAnalytics, type AnalyticsPeriod } from '../services/analytics';

interface Props {
  records: StudyRecord[];
  reviews: ReviewCard[];
  conversations: ConversationSession[];
}

const periods: { id: AnalyticsPeriod; label: string }[] = [
  { id: 'daily', label: '日別・7日' },
  { id: 'weekly', label: '週別・8週' },
  { id: 'monthly', label: '月別・6か月' },
];

export const AnalyticsDashboard: FC<Props> = ({ records, reviews, conversations }) => {
  const [period, setPeriod] = useState<AnalyticsPeriod>('daily');
  const [snapshotDate] = useState(() => new Date());
  const summary = useMemo(() => calculateAnalytics(records, reviews, conversations, snapshotDate),
    [records, reviews, conversations, snapshotDate]);
  const buckets = useMemo(() => buildTrend(records, period, snapshotDate), [records, period, snapshotDate]);
  const maximum = Math.max(1, ...buckets.map(b => b.count));
  const totalRated = summary.perfect + summary.good + summary.hard;
  const items = [
    { label: '直近7日間の回答', value: `${summary.weekAnswers}問`, icon: ChartNoAxesColumn, detail: '復習の回答も含む' },
    { label: '連続回答日数', value: `${summary.currentStreak}日`, icon: Flame, detail: `最長 ${summary.longestStreak}日` },
    { label: '今日までの復習待ち', value: `${summary.dueReviews}問`, icon: CalendarCheck2, detail: `復習カード総数 ${summary.scheduledReviews}問` },
    { label: '復習完了（累計）', value: `${summary.reviewTotal}回`, icon: Target, detail: 'カードの復習回数を集計' },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 p-4 text-white">
        <div className="flex items-center gap-2 text-sm font-extrabold"><TrendingUp className="h-5 w-5" /> 学習分析ダッシュボード</div>
        <p className="mt-1 text-[11px] leading-relaxed text-blue-100">この端末に記録された回答・復習・英会話のデータを集計しています。</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {items.map(({ label, value, icon: Icon, detail }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-1 text-slate-500"><span className="text-[11px] font-semibold">{label}</span><Icon className="h-4 w-4 flex-shrink-0" /></div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{detail}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="学習回数の推移">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-slate-800">回答数の推移</h3>
          <span className="text-[10px] text-slate-500">復習を含む</span>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" aria-label="集計期間を選択">
          {periods.map(option => (
            <button key={option.id} type="button" onClick={() => setPeriod(option.id)} aria-pressed={period === option.id}
              className={`rounded-lg px-1 py-2 text-[11px] font-bold ${period === option.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>
              {option.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-flow-col auto-cols-fr items-end gap-1.5" role="img" aria-label={buckets.map(b => `${b.label}: ${b.count}問`).join('、')}>
          {buckets.map(bucket => (
            <div key={bucket.key} className="flex min-w-0 flex-col items-center gap-1">
              <span className="text-[10px] font-bold tabular-nums text-slate-600">{bucket.count}</span>
              <div className="flex h-32 w-full items-end justify-center rounded-md bg-slate-50/80">
                <div className={`w-full max-w-8 rounded-t-md ${bucket.count ? 'bg-gradient-to-t from-blue-600 to-indigo-400' : 'bg-slate-200'}`}
                  style={{ height: bucket.count ? `${Math.max(5, bucket.count / maximum * 100)}%` : '2px' }} />
              </div>
              <span className="whitespace-nowrap text-[10px] text-slate-500">{bucket.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-600">
          この期間の回答：<strong>{buckets.reduce((sum, b) => sum + b.count, 0)}問</strong>
        </p>
        <div className="mt-4 border-t border-slate-100 pt-3">
          <h4 className="text-xs font-bold text-slate-800">「言えた」の割合の推移</h4>
          <p className="mt-1 text-[10px] text-slate-500">各期間内の回答に占める自己評価「言えた」の割合。回答がない期間は「—」で表示します。</p>
          <div className="mt-3 grid grid-flow-col auto-cols-fr items-end gap-1.5" role="img" aria-label={buckets.map(b => `${b.label}: ${b.count ? Math.round(b.perfect / b.count * 100) + '%' : '回答なし'}`).join('、')}>
            {buckets.map(bucket => (
              <div key={bucket.key} className="flex min-w-0 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold tabular-nums text-slate-600">{bucket.count ? `${Math.round(bucket.perfect / bucket.count * 100)}%` : '—'}</span>
                <div className="flex h-12 w-full items-end justify-center rounded-md bg-slate-50/80">
                  {bucket.count > 0 && <div className="w-full max-w-8 rounded-t-md bg-emerald-500" style={{ height: `${bucket.perfect / bucket.count * 100}%` }} />}
                </div>
                <span className="whitespace-nowrap text-[10px] text-slate-500">{bucket.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-slate-800">自己評価の内訳（累計）</h3>
          <span className="text-xs font-extrabold text-emerald-700">すぐ言えた {totalRated ? Math.round(summary.perfect / totalRated * 100) : 0}%</span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" aria-label="言えた・惜しい・要復習の割合">
          {totalRated > 0 && <>
            <div className="bg-emerald-500" style={{ width: `${summary.perfect / totalRated * 100}%` }} />
            <div className="bg-blue-400" style={{ width: `${summary.good / totalRated * 100}%` }} />
            <div className="bg-rose-400" style={{ width: `${summary.hard / totalRated * 100}%` }} />
          </>}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
          <div><p className="font-bold text-emerald-700">言えた</p><p className="font-extrabold">{summary.perfect}回</p></div>
          <div><p className="font-bold text-blue-700">惜しい</p><p className="font-extrabold">{summary.good}回</p></div>
          <div><p className="font-bold text-rose-700">要復習</p><p className="font-extrabold">{summary.hard}回</p></div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-extrabold text-slate-800">繰り返し苦手だった問題</h3>
        {summary.weakPrompts.length ? summary.weakPrompts.map(item => (
          <div key={item.key} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex justify-between gap-2 text-[10px] font-bold text-slate-500">
              <span>{item.type === 'quick' ? '瞬間英作文' : 'リピート'}</span>
              <span className="text-rose-700">要復習 {item.hardCount}/{item.attempts}回</span>
            </div>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-800">{item.promptText}</p>
            {item.latestRating === 'perfect' && <p className="mt-1 text-[10px] text-emerald-700">直近は「言えた」</p>}
          </div>
        )) : <p className="py-3 text-center text-xs text-slate-500">まだ要復習の記録がありません。</p>}
        <p className="text-[10px] leading-relaxed text-slate-500">これまでの「要復習」評価が多い順です。直近に克服した問題も含まれます。</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
        <div className="flex items-center gap-2"><MessagesSquare className="h-4 w-4 text-blue-600" /><h3 className="text-sm font-extrabold text-slate-800">そのほかの記録</h3></div>
        <p className="text-[11px] text-slate-600">総回答 <strong>{summary.totalAnswers}問</strong> ・ 回答履歴のある日 <strong>{summary.activeDays}日</strong></p>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-blue-50 p-3"><p className="text-2xl font-extrabold text-blue-800">{summary.conversationSessions}</p><p className="text-[11px] text-slate-600">保存済みの英会話</p></div>
          <div className="rounded-xl bg-indigo-50 p-3"><p className="text-2xl font-extrabold text-indigo-800">{summary.quickAverageSeconds === null ? '—' : `${summary.quickAverageSeconds}秒`}</p><p className="text-[11px] text-slate-600">瞬間英作文の平均回答時間</p></div>
        </div>
        <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-500"><Clock3 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />回答時間は記録済みの問題ごとの所要時間です。総学習時間ではありません。</p>
        <p className="text-[10px] leading-relaxed text-slate-500">継続日数は回答履歴のある日を基準に計算します。英会話のみ行った日は含みません。MacとPixelのデータは自動同期されません。</p>
      </section>
    </div>
  );
};
