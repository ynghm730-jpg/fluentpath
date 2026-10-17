import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Headphones, Mic, MicOff, Play, RotateCcw, Volume2 } from 'lucide-react';
import { QUICK_RESPONSE_QUESTIONS, type QuickResponseCategory } from '../data/quickResponseQuestions';
import { db } from '../services/db';
import { isSpeechRecognitionSupported, speakText, SpeechRecognizer, stopSpeaking } from '../services/speech';
import type { QuickResponseAttempt, SelfRating } from '../types';

interface Props {
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

type CategoryFilter = 'all' | QuickResponseCategory;
type Phase = 'ready' | 'running' | 'review';
type Limit = 3 | 5 | 10;

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function seconds(ms: number): string {
  return (ms / 1000).toFixed(1);
}

export const QuickResponseView: FC<Props> = ({ onShowToast }) => {
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [limit, setLimit] = useState<Limit>(5);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [answer, setAnswer] = useState('');
  const [listening, setListening] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [firstInputMs, setFirstInputMs] = useState<number | null>(null);
  const [firstInputMode, setFirstInputMode] = useState<'voice' | 'text' | 'none'>('none');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<QuickResponseAttempt[]>([]);

  const questions = useMemo(
    () => QUICK_RESPONSE_QUESTIONS.filter(q => category === 'all' || q.category === category),
    [category]
  );
  const question = questions[index % questions.length];
  const canSpeak = isSpeechRecognitionSupported();

  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const sessionIdRef = useRef(createId('qr-session'));
  const runIdRef = useRef(0);
  const startedPerformanceRef = useRef(0);
  const startedAtRef = useRef('');
  const firstInputRef = useRef<number | null>(null);
  const inputModeRef = useRef<'voice' | 'text' | 'none'>('none');
  const elapsedFinalRef = useRef(0);
  const savedRef = useRef(false);

  async function loadHistory() {
    try {
      const items = await db.quickResponses.orderBy('timestamp').reverse().limit(20).toArray();
      setHistory(items);
    } catch (err) {
      console.error('Quick-response history failed to load:', err);
      onShowToast('即答練習の履歴を読み込めませんでした', 'error');
    }
  }

  useEffect(() => {
    recognizerRef.current = new SpeechRecognizer();
    void loadHistory();
    return () => {
      runIdRef.current += 1;
      recognizerRef.current?.stop();
      stopSpeaking();
    };
    // 初回だけ読み込む
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => {
      setElapsedMs(Math.max(0, performance.now() - startedPerformanceRef.current));
    }, 100);
    return () => window.clearInterval(id);
  }, [phase]);

  const firstInput = (mode: 'voice' | 'text') => {
    if (firstInputRef.current !== null || startedPerformanceRef.current === 0) return;
    const latency = Math.max(0, performance.now() - startedPerformanceRef.current);
    firstInputRef.current = latency;
    inputModeRef.current = mode;
    setFirstInputMs(latency);
    setFirstInputMode(mode);
  };

  const start = () => {
    stopSpeaking();
    recognizerRef.current?.stop();
    runIdRef.current += 1;
    setListening(false);
    setAnswer('');
    setFirstInputMs(null);
    setFirstInputMode('none');
    setElapsedMs(0);
    setSaved(false);
    savedRef.current = false;
    firstInputRef.current = null;
    inputModeRef.current = 'none';
    startedAtRef.current = new Date().toISOString();
    startedPerformanceRef.current = performance.now();
    setPhase('running');
  };

  const toggleMicrophone = () => {
    const recognizer = recognizerRef.current;
    if (!recognizer || phase !== 'running') return;
    if (listening) {
      recognizer.stop();
      setListening(false);
      return;
    }
    const activeRun = runIdRef.current;
    const ok = recognizer.start(
      (text) => {
        if (activeRun !== runIdRef.current || !text.trim()) return;
        firstInput('voice');
        setAnswer(text);
      },
      (msg) => {
        if (activeRun !== runIdRef.current) return;
        setListening(false);
        onShowToast(msg, 'error');
      },
      () => {
        if (activeRun === runIdRef.current) setListening(false);
      },
    );
    if (ok) setListening(true);
  };

  const finish = () => {
    if (phase !== 'running') return;
    elapsedFinalRef.current = Math.max(0, performance.now() - startedPerformanceRef.current);
    setElapsedMs(elapsedFinalRef.current);
    runIdRef.current += 1; // 終了後の遅延した音声認識結果を破棄
    recognizerRef.current?.stop();
    setListening(false);
    setPhase('review');
  };

  const rateAndSave = async (rating: SelfRating) => {
    if (phase !== 'review' || savedRef.current || saving) return;
    savedRef.current = true; // 連続タップで重複保存しない
    setSaving(true);
    const now = new Date();
    const item: QuickResponseAttempt = {
      id: createId('qr'),
      sessionId: sessionIdRef.current,
      questionId: question.id,
      category: question.category,
      question: question.english,
      answer: answer.trim(),
      inputMode: inputModeRef.current,
      limitSeconds: limit,
      startLatencyMs: firstInputRef.current,
      responseTimeMs: Math.round(elapsedFinalRef.current),
      withinLimit: firstInputRef.current !== null && firstInputRef.current <= limit * 1000,
      selfRating: rating,
      date: localDate(now),
      timestamp: now.toISOString(),
    };
    try {
      await db.quickResponses.put(item);
      setSaved(true);
      await loadHistory();
      onShowToast('即答トレーニングの結果を保存しました', 'success');
    } catch (err) {
      savedRef.current = false;
      console.error('Quick-response result could not be saved:', err);
      onShowToast('結果を保存できませんでした。空き容量を確認して再度お試しください。', 'error');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (!saved || phase !== 'review') return;
    setIndex(current => (current + 1) % questions.length);
    setPhase('ready');
    setAnswer('');
    setElapsedMs(0);
    setFirstInputMs(null);
    setFirstInputMode('none');
    setSaved(false);
  };

  const resetCategory = (nextCategory: CategoryFilter) => {
    if (phase !== 'ready') return;
    setCategory(nextCategory);
    setIndex(0);
  };

  const reachedLimit = phase !== 'ready' && elapsedMs >= limit * 1000;
  const lastTen = history.slice(0, 10);
  const measured = lastTen.filter(h => h.startLatencyMs !== null);
  const averageLatency = measured.length
    ? seconds(measured.reduce((sum, h) => sum + (h.startLatencyMs ?? 0), 0) / measured.length)
    : null;
  const successes = lastTen.filter(h => h.withinLimit).length;

  return (
    <div className="space-y-4 pb-8">
      <header className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
        <div className="flex items-center gap-2 text-indigo-700 font-extrabold text-lg">
          <Clock3 className="w-5 h-5" /> クイックレスポンス
        </div>
        <p className="text-sm text-slate-600">英語の質問に、考えすぎず素早く答える練習です。Gemini APIは使いません。</p>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <p className="text-xs font-bold text-slate-600">問題の種類</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            ['all', 'すべて'], ['business', '仕事'], ['daily', '日常'],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" disabled={phase !== 'ready'} onClick={() => resetCategory(id)}
              className={`rounded-xl border py-2 text-sm font-semibold ${category === id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 border-slate-200'} disabled:opacity-60`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs font-bold text-slate-600">目標：質問が表示されてから最初の入力・認識結果まで</p>
        <div className="grid grid-cols-3 gap-2">
          {([3, 5, 10] as const).map(sec => (
            <button key={sec} type="button" disabled={phase !== 'ready'} onClick={() => setLimit(sec)}
              className={`rounded-xl border py-2 text-sm font-semibold ${limit === sec ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 border-slate-200'} disabled:opacity-60`}>
              {sec}秒
            </button>
          ))}
        </div>
      </div>

      <section className="rounded-2xl bg-white border border-slate-200 p-4 space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{category === 'all' ? '全問題' : category === 'business' ? '仕事' : '日常'}：{index + 1} / {questions.length}</span>
          <span className="font-bold text-indigo-600">目標 {limit} 秒</span>
        </div>

        {phase === 'ready' ? (
          <>
            <div className="rounded-2xl bg-indigo-50 p-6 min-h-40 flex flex-col items-center justify-center text-center gap-2">
              <Play className="w-8 h-8 text-indigo-600" />
              <p className="font-bold text-slate-800">準備はできましたか？</p>
              <p className="text-sm text-slate-600">開始すると質問が表示され、計測が始まります。</p>
            </div>
            <button type="button" onClick={start} className="w-full rounded-2xl bg-indigo-600 text-white font-bold py-3 shadow-sm">
              問題を表示してスタート
            </button>
          </>
        ) : (
          <>
            <div className="rounded-2xl bg-indigo-50 p-4 space-y-2">
              <p className="text-xs text-indigo-600 font-bold">英語で答えてください</p>
              <p className="text-lg font-bold leading-relaxed text-slate-900">{question.english}</p>
              <p className="text-sm text-slate-600">{question.japanese}</p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] text-slate-500">経過時間</p>
                <p role="timer" className={`text-3xl font-extrabold tabular-nums ${reachedLimit ? 'text-rose-600' : 'text-indigo-700'}`}>
                  {seconds(elapsedMs)}<span className="text-base ml-1">秒</span>
                </p>
              </div>
              <div className="text-right text-xs text-slate-500 max-w-40">
                {firstInputMs === null ? '最初の入力を待っています' : `最初の${firstInputMode === 'voice' ? '認識結果' : '文字入力'}：${seconds(firstInputMs)}秒`}
                {reachedLimit && <p className="mt-1 text-rose-600 font-bold">目標時間を超過</p>}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="quick-response-answer" className="text-sm font-bold text-slate-700">あなたの回答</label>
                {phase === 'running' && (
                  <button type="button" disabled={!canSpeak} onClick={toggleMicrophone}
                    className={`flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold ${listening ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'} disabled:opacity-40`}>
                    {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {listening ? '録音を終了' : 'マイクで回答'}
                  </button>
                )}
              </div>
              <textarea id="quick-response-answer" rows={3} value={answer} readOnly={phase === 'review'}
                onChange={e => {
                  if (phase !== 'running') return;
                  if (e.target.value.trim()) firstInput('text');
                  setAnswer(e.target.value);
                }}
                placeholder={phase === 'running' ? 'マイクまたはキーボードで英語を入力' : '回答なし'}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none resize-y disabled:bg-slate-50" />
              {!canSpeak && phase === 'running' && <p className="text-xs text-amber-700">このブラウザでは音声認識が使えません。文字入力をご利用ください。</p>}
            </div>

            {phase === 'running' ? (
              <button type="button" onClick={finish} className="w-full rounded-2xl bg-indigo-600 text-white font-bold py-3">
                回答を終了してお手本を見る
              </button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-emerald-800 text-sm">回答例（唯一の正解ではありません）</p>
                    <button type="button" onClick={() => speakText(question.sampleAnswer, 0.95)} aria-label="回答例を読み上げる" className="p-2 rounded-lg text-emerald-800 bg-white">
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{question.sampleAnswer}</p>
                  <p className="text-sm text-slate-600">{question.sampleJapanese}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
                  <p>最初の入力・認識結果：<strong>{firstInputMs === null ? '記録なし' : `${seconds(firstInputMs)}秒`}</strong></p>
                  <p>目標 {limit} 秒：<strong>{firstInputMs === null ? '未達成' : firstInputMs <= limit * 1000 ? '達成' : '未達成'}</strong></p>
                  <p>終了までの時間：{seconds(elapsedMs)}秒</p>
                </div>
                <p className="text-sm font-bold text-slate-700">今回の自己評価を選んで保存</p>
                <div className="grid grid-cols-1 gap-2">
                  <button type="button" disabled={saving || saved} onClick={() => rateAndSave('perfect')}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 py-2 font-semibold text-sm text-emerald-900 disabled:opacity-50">すぐ言えた</button>
                  <button type="button" disabled={saving || saved} onClick={() => rateAndSave('good')}
                    className="rounded-xl border border-amber-200 bg-amber-50 py-2 font-semibold text-sm text-amber-900 disabled:opacity-50">少し考えた</button>
                  <button type="button" disabled={saving || saved} onClick={() => rateAndSave('hard')}
                    className="rounded-xl border border-rose-200 bg-rose-50 py-2 font-semibold text-sm text-rose-900 disabled:opacity-50">言えなかった</button>
                </div>
                {saved && <div className="flex items-center gap-2 text-emerald-700 text-sm font-bold"><CheckCircle2 className="w-4 h-4" />保存しました</div>}
                <button type="button" disabled={!saved} onClick={next}
                  className="w-full rounded-2xl bg-indigo-600 text-white font-bold py-3 flex items-center justify-center gap-2 disabled:bg-slate-300">
                  次の問題 <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 text-slate-800 font-bold"><Headphones className="w-5 h-5" /> 最近の練習記録</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-50 rounded-xl p-2"><p className="text-[11px] text-slate-500">直近の記録</p><p className="font-extrabold text-lg">{lastTen.length}件</p></div>
          <div className="bg-slate-50 rounded-xl p-2"><p className="text-[11px] text-slate-500">制限内に開始</p><p className="font-extrabold text-lg">{successes}件</p></div>
          <div className="bg-slate-50 rounded-xl p-2"><p className="text-[11px] text-slate-500">平均の目安</p><p className="font-extrabold text-lg">{averageLatency === null ? '—' : `${averageLatency}秒`}</p></div>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">まだ練習記録がありません。1問回答して自己評価を保存すると表示されます。</p>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 5).map(attempt => (
              <div key={attempt.id} className="border-t border-slate-100 pt-2 text-xs">
                <p className="font-semibold text-slate-800">{attempt.question}</p>
                <p className="text-slate-500 mt-1">{attempt.date} ・ 初回入力 {attempt.startLatencyMs === null ? 'なし' : `${seconds(attempt.startLatencyMs)}秒`} ・ {attempt.withinLimit ? '時間内' : '時間超過／未回答'} ・ {attempt.selfRating === 'perfect' ? 'すぐ言えた' : attempt.selfRating === 'good' ? '少し考えた' : '言えなかった'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800 space-y-2">
        <div className="flex gap-2 items-center font-bold"><RotateCcw className="w-4 h-4" />計測上の注意</div>
        <p>音声の場合は「最初の音声認識結果を受信した時刻」を計測します。マイクの起動時間、通信状況、認識処理に影響されるため、実際に話し始めるまでの正確な時間ではありません。</p>
        <p>制限時間を超えても練習は継続できます。回答例は一例であり、文法の自動採点は行いません。</p>
      </div>
    </div>
  );
};
