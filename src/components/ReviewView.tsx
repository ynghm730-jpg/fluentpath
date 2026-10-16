import { useEffect, useRef, useState, type FC } from 'react';
import { AlertCircle, BookOpenCheck, Clock3, Eye, Headphones, Mic, MicOff, Volume2 } from 'lucide-react';
import type { ReviewCard, SelfRating } from '../types';
import { completeReview, getDueReviews } from '../services/review';
import { db } from '../services/db';
import { SpeechRecognizer, speakText, stopSpeaking } from '../services/speech';

interface Props {
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRecordSaved: () => void;
}

export const ReviewView: FC<Props> = ({ onShowToast, onRecordSaved }) => {
  const [due, setDue] = useState<ReviewCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(0);
  const recognizer = useRef<SpeechRecognizer | null>(null);
  const startedAt = useRef(Date.now());
  const current = due[0];

  const reload = async () => {
    const [items, count] = await Promise.all([getDueReviews(), db.reviews.count()]);
    setDue(items); setTotal(count);
  };
  useEffect(() => {
    let active = true;
    recognizer.current = new SpeechRecognizer();
    Promise.all([getDueReviews(), db.reviews.count()]).then(([items, count]) => {
      if (active) { setDue(items); setTotal(count); setLoading(false); }
    }).catch(() => { if (active) { setError('復習データを読み込めませんでした。'); setLoading(false); } });
    return () => { active = false; recognizer.current?.stop(); stopSpeaking(); };
  }, []);

  useEffect(() => {
    startedAt.current = Date.now();
    setAnswer(''); setRevealed(false); setError(''); setListening(false);
    recognizer.current?.stop();
    stopSpeaking();
  }, [current?.id]);

  const toggleMic = () => {
    if (saving || !current) return;
    if (listening) { recognizer.current?.stop(); setListening(false); return; }
    stopSpeaking();
    const ok = recognizer.current?.start(
      transcript => setAnswer(transcript),
      msg => { setListening(false); onShowToast(msg, 'error'); },
      () => setListening(false),
    );
    if (ok) setListening(true);
  };

  const reveal = () => {
    recognizer.current?.stop(); setListening(false); setRevealed(true);
  };

  const mark = async (rating: SelfRating) => {
    if (!current || saving || !revealed) return;
    setSaving(true); setError('');
    try {
      await completeReview(current, answer.trim(), rating, Date.now() - startedAt.current);
      await reload();
      setCompleted(v => v + 1);
      onRecordSaved();
      onShowToast('復習を記録し、次回の出題日を更新しました', 'success');
    } catch (e) {
      setError(`保存に失敗しました：${e instanceof Error ? e.message : '不明なエラー'}`);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 pb-12">
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-700 p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 text-blue-100 text-xs font-bold"><BookOpenCheck className="w-4 h-4"/> FluentPath · Review</div>
        <h2 className="text-xl font-extrabold mt-1">弱点の自動復習</h2>
        <p className="mt-2 text-xs text-blue-100 leading-relaxed">以前「惜しい・要復習」と評価した問題を、間隔を空けて練習します。AI APIは使いません。</p>
        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div className="rounded-xl bg-white/15 p-2"><div className="text-xl font-extrabold">{due.length}</div><div className="text-[10px]">今日の残り</div></div>
          <div className="rounded-xl bg-white/15 p-2"><div className="text-xl font-extrabold">{completed}</div><div className="text-[10px]">今回の完了</div></div>
          <div className="rounded-xl bg-white/15 p-2"><div className="text-xl font-extrabold">{total}</div><div className="text-[10px]">復習対象</div></div>
        </div>
      </div>

      {error && <div role="alert" className="flex gap-2 items-start rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><AlertCircle className="w-4 h-4 shrink-0"/>{error}</div>}

      {loading ? (
        <div className="text-sm text-slate-500 text-center p-8">復習リストを読み込み中…</div>
      ) : !current ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center space-y-3">
          <BookOpenCheck className="mx-auto w-12 h-12 text-emerald-500"/>
          <h3 className="font-bold text-slate-800">今日の復習は完了です</h3>
          <p className="text-xs text-slate-600 leading-relaxed">瞬間英作文またはリピート練習で「惜しい・要復習」を選択すると、原則翌日から復習リストに追加されます。</p>
          <p className="text-xs text-slate-500">次の出題日まで無理に追加練習する必要はありません。</p>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex justify-between items-center gap-2">
            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{current.type === 'quick' ? '瞬間英作文' : 'リピート'}</span>
            <span className="flex items-center gap-1 text-xs text-slate-500"><Clock3 className="w-3.5 h-3.5"/> 復習 {current.reviewCount + 1}回目</span>
          </div>

          {current.type === 'quick' ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">次の日本語を英語で言ってください。</p>
              <p className="text-base font-bold text-slate-800 leading-relaxed">{current.promptText}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">お手本を聞き、同じ英文を言ってください。</p>
              <button onClick={() => speakText(current.modelAnswer, 0.9)} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold text-sm"><Headphones className="w-5 h-5"/> お手本の音声を再生</button>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="review-answer" className="block text-xs font-bold text-slate-700">あなたの回答（任意・音声入力可）</label>
            <textarea id="review-answer" rows={2} maxLength={1500} value={answer} onChange={e => setAnswer(e.target.value)} disabled={saving || revealed}
              placeholder="ここに英語を入力するか、マイクで話してください"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:ring-2 focus:ring-indigo-200 focus:outline-none"/>
            <button onClick={toggleMic} disabled={saving || revealed} className={`w-full rounded-xl border py-2.5 text-sm font-bold flex justify-center gap-2 items-center disabled:opacity-50 ${listening ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-slate-200 text-slate-700'}`}>
              {listening ? <MicOff className="w-4 h-4"/> : <Mic className="w-4 h-4"/>}
              {listening ? '録音を停止' : 'マイクで答える'}
            </button>
          </div>

          {!revealed ? (
            <button className="w-full bg-indigo-600 text-white font-bold rounded-xl py-3 flex items-center justify-center gap-2" onClick={reveal}><Eye className="w-4 h-4"/> 答えを見る</button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-blue-700">模範解答</span>
                  <button onClick={() => speakText(current.modelAnswer)} className="flex items-center gap-1 text-xs font-semibold text-blue-700"><Volume2 className="w-4 h-4"/>再生</button>
                </div>
                <p className="font-bold text-sm text-slate-800">{current.modelAnswer}</p>
                {current.lastResponse && <p className="text-xs text-slate-500">前回の回答：{current.lastResponse}</p>}
              </div>
              <p className="text-xs text-slate-700 font-bold">今回の出来を選んでください</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <button disabled={saving} onClick={() => mark('hard')} className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold py-3 disabled:opacity-50">もう一度<br/>1日後</button>
                <button disabled={saving} onClick={() => mark('good')} className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold py-3 disabled:opacity-50">少し考えた<br/>間隔を延長</button>
                <button disabled={saving} onClick={() => mark('perfect')} className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold py-3 disabled:opacity-50">すぐ言えた<br/>大きく延長</button>
              </div>
            </div>
          )}
        </div>
      )}
      <p className="text-[11px] text-slate-500 leading-relaxed px-1">復習間隔の目安：1 → 3 → 7 → 14 → 30 → 60 → 90 → 180 → 270 → 365日（最大1年）。評価が低い場合は短く、スムーズに言えた場合は長くします。記録はこの端末に保存されます。</p>
    </div>
  );
};
