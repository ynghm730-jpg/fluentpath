import { useEffect, useMemo, useRef, useState, type FC, type FormEvent } from 'react';
import { ArrowRight, BookmarkPlus, Bot, CheckCircle2, Clock3, Headphones, Loader2, Mic, MicOff, Play, RotateCcw, Volume2, X } from 'lucide-react';
import { QUICK_RESPONSE_QUESTIONS, type QuickResponseCategory } from '../data/quickResponseQuestions';
import { db } from '../services/db';
import { getAiToken, requestAiReview, setAiToken } from '../services/ai';
import { addAiCorrectionToReviews } from '../services/review';
import { isSpeechRecognitionSupported, speakText, SpeechRecognizer, stopSpeaking } from '../services/speech';
import { loadStudyIndex, rememberStudyQuestion, readStudyCategory, writeStudyCategory } from '../services/studyProgress';
import type { AiReviewResult, QuickResponseAttempt, SelfRating } from '../types';

interface Props {
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onDataChanged?: () => void;
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

export const QuickResponseView: FC<Props> = ({ onShowToast, onDataChanged }) => {
  const [category, setCategory] = useState<CategoryFilter>(() => readStudyCategory('response'));
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
  // Phase 6A+: existing Gemini review Worker /api/review; no new Worker route.
  const [aiReview, setAiReview] = useState<AiReviewResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [rememberToken, setRememberToken] = useState(false);
  const [phraseSaving, setPhraseSaving] = useState(false);
  const [phraseSaved, setPhraseSaved] = useState(false);

  const questions = useMemo(
    () => QUICK_RESPONSE_QUESTIONS.filter(q => category === 'all' || q.category === category),
    [category]
  );
  const question = questions[index % questions.length];
  useEffect(() => {
    let alive = true;
    setIndex(0);
    void loadStudyIndex('response', category, questions).then(i => { if (alive) setIndex(i); })
      .catch(() => onShowToast('前回の問題番号を読み込めませんでした', 'error'));
    return () => { alive = false; };
  }, [category, questions, onShowToast]);
  const restartFromBeginning = () => {
    if (phase !== 'ready') { onShowToast('回答中はリセットできません。次の問題へ進んでから実行してください', 'info'); return; }
    if (!window.confirm('このカテゴリを第1問からやり直しますか？（過去の練習履歴は消えません）')) return;
    setIndex(0);
    if (questions[0]) void rememberStudyQuestion('response', category, questions[0].id).catch(console.error);
  };
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
  const aiGenerationRef = useRef(0); // ignore late results when the question changes/unmounts
  const aiRequestInFlightRef = useRef(false);
  const phraseSaveInFlightRef = useRef(false);

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
      aiGenerationRef.current += 1;
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
    aiGenerationRef.current += 1;
    setAiReview(null);
    setAiError('');
    setAiLoading(false);
    aiRequestInFlightRef.current = false;
    setPhraseSaved(false);
    setPhraseSaving(false);
    phraseSaveInFlightRef.current = false;
    setTokenModalOpen(false);
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
      if (questions.length > 0) {
        void rememberStudyQuestion('response', category, questions[(index + 1) % questions.length].id).catch(console.error);
      }
      onDataChanged?.();
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
    aiGenerationRef.current += 1;
    setAiReview(null);
    setAiError('');
    setAiLoading(false);
    aiRequestInFlightRef.current = false;
    setPhraseSaved(false);
    setPhraseSaving(false);
    phraseSaveInFlightRef.current = false;
    setTokenModalOpen(false);
    const nextIndex = (index + 1) % questions.length;
    setIndex(nextIndex);
    void rememberStudyQuestion('response', category, questions[nextIndex].id).catch(console.error);
    setPhase('ready');
    setAnswer('');
    setElapsedMs(0);
    setFirstInputMs(null);
    setFirstInputMode('none');
    setSaved(false);
  };

  // AI review is optional and intentionally not part of quick-response timing or self-rating.
  // The fixed example is a reference, NOT the only acceptable answer.
  const requestQuickReview = async () => {
    if (phase !== 'review' || aiRequestInFlightRef.current) return;
    const userEnglish = answer.trim();
    if (!userEnglish) {
      setAiError('回答がありません。Gemini添削には英文を入力してください。');
      return;
    }
    if (userEnglish.length > 500) {
      setAiError('AI添削できる回答は500文字までです。');
      return;
    }
    if (!getAiToken()) {
      setTokenInput('');
      setTokenModalOpen(true);
      return;
    }

    const generation = aiGenerationRef.current;
    aiRequestInFlightRef.current = true;
    setAiLoading(true);
    setAiError('');
    setAiReview(null);
    setPhraseSaved(false);
    try {
      const result = await requestAiReview({
        userEnglish,
        japanesePrompt: `英語の質問への即答練習です。質問への答えとして適切かを確認し、文法と自然さを添削してください。質問: ${question.english}（${question.japanese}）`,
        modelAnswer: question.sampleAnswer,
      });
      if (generation !== aiGenerationRef.current) return;
      setAiReview(result);
      setPhraseSaved(false);
      try {
        const added = await addAiCorrectionToReviews({
          sourceId: `quickresponse:${question.id}`,
          prompt: `英語で質問に答えてください：${question.english}`,
          original: userEnglish,
          corrected: result.revised,
          needsReview: result.needsReview,
        });
        onShowToast(added ? 'AIが指摘した誤りを翌日からの復習に登録しました' : 'クイックレスポンスのAI添削が完了しました', 'success');
      } catch (saveError) {
        console.error('Could not save AI review card', saveError);
        onShowToast('AI添削は完了しましたが復習への登録に失敗しました', 'error');
      }
    } catch (error: unknown) {
      if (generation !== aiGenerationRef.current) return;
      const message = error instanceof Error ? error.message : 'AI添削に失敗しました。';
      setAiError(message);
      if (message.includes('401') || message.includes('NO_TOKEN')) {
        setTokenInput('');
        setTokenModalOpen(true);
      }
    } finally {
      if (generation === aiGenerationRef.current) {
        aiRequestInFlightRef.current = false;
        setAiLoading(false);
      }
    }
  };

  const saveTokenAndReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tokenInput.trim()) return;
    setAiToken(tokenInput, rememberToken);
    setTokenInput('');
    setTokenModalOpen(false);
    void requestQuickReview();
  };

  const saveRevisedPhrase = async () => {
    if (!aiReview || phraseSaved || phraseSaveInFlightRef.current) return;
    const generation = aiGenerationRef.current;
    phraseSaveInFlightRef.current = true;
    setPhraseSaving(true);
    try {
      await db.phrases.put({
        id: createId('phrase-quick-response-ai'),
        english: aiReview.revised,
        japanese: aiReview.revisedJapanese,
        notes: `即答トレの質問: ${question.english}\n元の回答: ${answer.trim()}\n${aiReview.grammarExplanation}`,
        tags: ['即答トレ', 'AI添削', question.category === 'business' ? '仕事' : '日常'],
        isBookmarked: true,
        reviewCount: 0,
        createdAt: new Date().toISOString(),
      });
      if (generation === aiGenerationRef.current) {
        setPhraseSaved(true);
        onShowToast('AI修正版をフレーズ帳に保存しました', 'success');
      }
    } catch (error) {
      console.error('Could not save AI phrase:', error);
      if (generation === aiGenerationRef.current) onShowToast('フレーズ帳への保存に失敗しました', 'error');
    } finally {
      if (generation === aiGenerationRef.current) {
        phraseSaveInFlightRef.current = false;
        setPhraseSaving(false);
      }
    }
  };

  const resetCategory = (nextCategory: CategoryFilter) => {
    if (phase !== 'ready') return;
    writeStudyCategory('response', nextCategory);
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
        <p className="text-sm text-slate-600">英語の質問に素早く答える練習です。基本練習は無料・API不要。回答後に任意でGemini AI添削も利用できます。</p>
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

      <div className="flex items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs">
        <span className="text-indigo-800">続きから：第{index + 1}問 / {questions.length}問</span>
        <button type="button" disabled={phase !== 'ready'} onClick={restartFromBeginning} className="font-bold text-indigo-700 underline disabled:opacity-40">最初からやり直す</button>
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
                {/* Phase 6A+: optional Gemini review after the timed response is complete. */}
                <div className="border-2 border-indigo-100 bg-indigo-50/50 rounded-2xl p-3 space-y-3">
                  <div className="flex items-center gap-2 font-extrabold text-indigo-900 text-sm">
                    <Bot className="w-5 h-5" /> GeminiによるAI添削（任意）
                  </div>
                  <p className="text-xs text-slate-600">質問への答え方・文法・自然なアメリカ英語を確認します。回答時間と自己評価には影響しません。</p>
                  <button type="button" disabled={aiLoading || !answer.trim()} onClick={() => void requestQuickReview()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white font-bold text-sm py-3 disabled:opacity-50">
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                    {aiLoading ? 'Geminiで添削中…' : aiReview ? 'もう一度AI添削する' : 'この回答をAI添削する'}
                  </button>
                  {!answer.trim() && <p className="text-xs text-slate-500">回答が空欄のためAI添削は利用できません。</p>}
                  {aiError && (
                    <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 space-y-2">
                      <p className="font-bold">AI添削エラー</p>
                      <p className="break-words">{aiError}</p>
                      {(aiError.includes('401') || aiError.includes('NO_TOKEN')) && (
                        <button type="button" onClick={() => { setTokenInput(''); setTokenModalOpen(true); }} className="text-indigo-700 font-bold underline">アクセストークンを再設定</button>
                      )}
                    </div>
                  )}
                  {aiReview && (
                    <div className="bg-white border border-indigo-200 rounded-2xl p-3 space-y-3 text-sm">
                      <div className="border-b border-indigo-100 pb-2 font-bold text-indigo-900">AI英文添削レポート</div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-500">あなたの回答</p>
                        <p className="text-slate-800 whitespace-pre-wrap break-words">{aiReview.original}</p>
                      </div>
                      <div className="rounded-xl bg-indigo-50 p-3 space-y-1">
                        <div className="flex justify-between gap-2 items-start">
                          <p className="text-xs font-bold text-indigo-800">修正版（アメリカ英語）</p>
                          <button type="button" onClick={() => speakText(aiReview.revised)} aria-label="AI修正版を読み上げる" className="text-indigo-700 p-1 rounded-lg bg-white"><Volume2 className="w-4 h-4" /></button>
                        </div>
                        <p className="font-bold text-slate-900 whitespace-pre-wrap break-words">{aiReview.revised}</p>
                        <p className="text-xs text-slate-600 whitespace-pre-wrap">{aiReview.revisedJapanese}</p>
                      </div>
                      <div className="space-y-1"><p className="font-bold text-xs text-emerald-800">良かった点</p><p className="text-slate-700 whitespace-pre-wrap">{aiReview.positiveFeedback}</p></div>
                      <div className="space-y-1"><p className="font-bold text-xs text-slate-800">文法・語法の解説</p><p className="text-slate-700 whitespace-pre-wrap">{aiReview.grammarExplanation}</p></div>
                      <div className="space-y-1"><p className="font-bold text-xs text-slate-800">さらに自然な表現</p><p className="text-slate-700 whitespace-pre-wrap">{aiReview.naturalPhrasing}</p></div>
                      <button type="button" disabled={phraseSaving || phraseSaved} onClick={() => void saveRevisedPhrase()}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white font-bold text-xs py-2.5 disabled:bg-emerald-100 disabled:text-emerald-900">
                        {phraseSaved ? <CheckCircle2 className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
                        {phraseSaved ? 'フレーズ帳に保存済み' : phraseSaving ? '保存中…' : '修正版をフレーズ帳に保存'}
                      </button>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500">実行時のみ回答をGeminiへ送信します。無料枠と回数制限の対象です。AI添削結果そのものは履歴に残りません。必要な表現はフレーズ帳に保存してください。</p>
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
        <p>制限時間を超えても練習は継続できます。回答例は一例です。AI添削は任意で実行でき、時間や自己評価の記録とは独立しています。</p>
      </div>
      {tokenModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="qr-token-title">
          <form onSubmit={saveTokenAndReview} className="w-full max-w-sm rounded-2xl bg-white p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h2 id="qr-token-title" className="font-bold text-slate-900">AI添削アクセストークン</h2>
              <button type="button" aria-label="閉じる" onClick={() => { setTokenModalOpen(false); setTokenInput(''); }} className="rounded-lg p-1 text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-600">瞬間英作文・AI英会話と同じAUTH_TOKENを入力してください。Gemini APIキーは入力しないでください。</p>
            <input type="password" autoComplete="off" value={tokenInput} onChange={e => setTokenInput(e.target.value)}
              placeholder="アクセストークン" aria-label="アクセストークン" required className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
            <label className="flex items-start gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={rememberToken} onChange={e => setRememberToken(e.target.checked)} className="mt-0.5" />
              <span>次回以降も保存する（自分専用の端末のみ）</span>
            </label>
            <button type="submit" disabled={!tokenInput.trim()} className="w-full bg-indigo-600 text-white font-bold rounded-xl py-3 disabled:opacity-50">保存してAI添削する</button>
          </form>
        </div>
      )}
    </div>
  );
};
