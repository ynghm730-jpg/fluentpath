import { useState, useEffect, useRef, type FC, type FormEvent } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  BookmarkPlus,
  BookmarkCheck,
  ArrowRight,
  Clock,
  Sparkles,
  Bot,
  Loader2,
  CheckCircle2,
  Key,
  X,
} from 'lucide-react';
import type { QuickPrompt, SelfRating, StudyRecord, AiReviewResult } from '../types';
import { INITIAL_PROMPTS } from '../data/initialPrompts';
import { speakText, stopSpeaking, SpeechRecognizer, evaluateSimilarity } from '../services/speech';
import { db } from '../services/db';
import { saveStudyRecord, localDateKey, addAiCorrectionToReviews } from '../services/review';
import { requestAiReview, getAiToken, setAiToken } from '../services/ai';

interface QuickPromptViewProps {
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRecordSaved: () => void;
}

export const QuickPromptView: FC<QuickPromptViewProps> = ({
  onShowToast,
  onRecordSaved,
}) => {
  const [prompts] = useState<QuickPrompt[]>(INITIAL_PROMPTS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'business' | 'daily'>('all');

  // タイマー設定（5秒, 10秒, なし）
  const [timerDuration, setTimerDuration] = useState<number>(5);
  const [timeLeft, setTimeLeft] = useState<number>(5);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // 回答状態
  const [userSpeech, setUserSpeech] = useState<string>('');
  const [textInput, setTextInput] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [hasRevealed, setHasRevealed] = useState<boolean>(false);
  const [isSavedToPhrasebook, setIsSavedToPhrasebook] = useState<boolean>(false);

  // 自己評価
  const [selectedRating, setSelectedRating] = useState<SelfRating | null>(null);

  // AI添削状態
  const [aiReview, setAiReview] = useState<AiReviewResult | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState<string>('');
  const [rememberToken, setRememberToken] = useState<boolean>(false);
  const [isAiSavedToPhrasebook, setIsAiSavedToPhrasebook] = useState<boolean>(false);

  // 回答時間計測
  const startTimeRef = useRef<number>(Date.now());
  const recognizerRef = useRef<SpeechRecognizer | null>(null);

  // フィルタリングされた問題リスト
  const filteredPrompts = prompts.filter((p) => {
    if (categoryFilter === 'all') return true;
    return p.category === categoryFilter;
  });

  const currentPrompt: QuickPrompt | undefined = filteredPrompts[currentIndex] || filteredPrompts[0];

  // 音声認識の初期化
  useEffect(() => {
    recognizerRef.current = new SpeechRecognizer();
    return () => {
      stopSpeaking();
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
    };
  }, []);

  // 問題切り替え時の初期化
  useEffect(() => {
    setHasRevealed(false);
    setUserSpeech('');
    setTextInput('');
    setSelectedRating(null);
    setIsSavedToPhrasebook(false);
    setAiReview(null);
    setAiError(null);
    setIsAiSavedToPhrasebook(false);
    startTimeRef.current = Date.now();

    if (timerDuration > 0) {
      setTimeLeft(timerDuration);
      setIsTimerRunning(true);
    } else {
      setIsTimerRunning(false);
    }

    // 既にフレーズ帳に入っているか確認
    if (currentPrompt) {
      db.phrases.where('english').equals(currentPrompt.english).first().then((found) => {
        setIsSavedToPhrasebook(!!found);
      });
    }
  }, [currentIndex, categoryFilter, timerDuration, currentPrompt]);

  // カウントダウンタイマー
  useEffect(() => {
    if (!isTimerRunning || timeLeft <= 0 || hasRevealed) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsTimerRunning(false);
          // 時間切れでも強制回答ではなく、自動で模範解答をオープン
          setHasRevealed(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft, hasRevealed]);

  // 音声入力の開始/停止
  const toggleListening = () => {
    if (!recognizerRef.current) return;

    if (isListening) {
      recognizerRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      const ok = recognizerRef.current.start(
        (transcript, isFinal) => {
          setUserSpeech(transcript);
          setTextInput(transcript);
          if (isFinal) {
            setIsListening(false);
          }
        },
        (errorMsg) => {
          setIsListening(false);
          onShowToast(errorMsg, 'error');
        },
        () => {
          setIsListening(false);
        }
      );
      if (!ok) {
        setIsListening(false);
      }
    }
  };

  // 答えを見る
  const handleReveal = () => {
    setHasRevealed(true);
    setIsTimerRunning(false);
    if (isListening && recognizerRef.current) {
      recognizerRef.current.stop();
      setIsListening(false);
    }
  };

  // 模範音声を再生
  const handlePlayModelAudio = () => {
    if (!currentPrompt) return;
    speakText(currentPrompt.english);
  };

  // 自己評価を記録して保存
  const handleRating = async (rating: SelfRating) => {
    if (!currentPrompt) return;
    setSelectedRating(rating);

    const answerText = textInput.trim() || userSpeech.trim();
    const responseTime = Math.max(1000, Date.now() - startTimeRef.current);

    const { score } = evaluateSimilarity(
      answerText,
      currentPrompt.english,
      currentPrompt.acceptableAnswers
    );

    const record: StudyRecord = {
      type: 'quick',
      promptId: currentPrompt.id,
      promptText: currentPrompt.japanese,
      userResponse: answerText,
      modelAnswer: currentPrompt.english,
      selfRating: rating,
      responseTimeMs: responseTime,
      similarityScore: score,
      timestamp: new Date().toISOString(),
      date: localDateKey(),
    };

    try {
      await saveStudyRecord(record);
      onRecordSaved();
      onShowToast(
        rating === 'perfect' ? '🎉 素晴らしい即答です！' : rating === 'good' ? '👍 惜しい！次回は完璧に！' : '💪 復習リストに追加しました',
        'success'
      );
    } catch (err) {
      console.error('Failed to save study record:', err);
    }
  };

  // フレーズ帳へワンタップ追加
  const handleTogglePhrasebook = async () => {
    if (!currentPrompt) return;

    try {
      if (isSavedToPhrasebook) {
        // 削除
        const existing = await db.phrases.where('english').equals(currentPrompt.english).first();
        if (existing) {
          await db.phrases.delete(existing.id);
          setIsSavedToPhrasebook(false);
          onShowToast('フレーズ帳から解除しました', 'info');
        }
      } else {
        // 追加
        await db.phrases.put({
          id: `phrase-${Date.now()}`,
          english: currentPrompt.english,
          japanese: currentPrompt.japanese,
          notes: currentPrompt.notes,
          tags: currentPrompt.tags,
          isBookmarked: true,
          reviewCount: 0,
          createdAt: new Date().toISOString(),
        });
        setIsSavedToPhrasebook(true);
        onShowToast('フレーズ帳に保存しました！', 'success');
      }
    } catch (err) {
      console.error('Failed to toggle phrasebook:', err);
      onShowToast('保存中にエラーが発生しました', 'error');
    }
  };

  // AI添削リクエスト実行
  const handleRequestAiReview = async () => {
    if (!currentPrompt) return;
    const answerText = textInput.trim() || userSpeech.trim();
    if (!answerText) {
      onShowToast('添削する英文がありません。声に出すか、入力してください。', 'info');
      return;
    }

    const token = getAiToken();
    if (!token) {
      setTokenInput('');
      setIsTokenModalOpen(true);
      return;
    }

    const reviewPrompt = currentPrompt;
    setIsAiLoading(true);
    setAiError(null);

    try {
      const result = await requestAiReview({
        userEnglish: answerText,
        japanesePrompt: currentPrompt.japanese,
        modelAnswer: currentPrompt.english,
      });
      setAiReview(result);
      try {
        const added = await addAiCorrectionToReviews({
          sourceId: `quick:${reviewPrompt.id}`,
          prompt: reviewPrompt.japanese,
          original: answerText,
          corrected: result.revised,
          needsReview: result.needsReview,
        });
        onShowToast(added ? 'AI添削の誤りを翌日からの復習に登録しました' : 'AI添削が完了しました！', 'success');
      } catch (saveError) {
        console.error('Could not save AI review', saveError);
        onShowToast('AI添削は完了しましたが復習への登録に失敗しました', 'error');
      }
    } catch (err: any) {
      console.error('AI Review Error:', err);
      const errMsg = err.message || 'AI添削中にエラーが発生しました。';
      setAiError(errMsg);
      if (errMsg.includes('401') || errMsg.includes('NO_TOKEN')) {
        setIsTokenModalOpen(true);
      }
      onShowToast(errMsg, 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  // トークン保存と添削の再実行
  const handleSaveTokenAndReview = (e: FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      onShowToast('アクセストークンを入力してください', 'error');
      return;
    }
    setAiToken(tokenInput.trim(), rememberToken);
    setIsTokenModalOpen(false);
    onShowToast('トークンを設定しました。AI添削を開始します...', 'info');
    setTimeout(() => {
      handleRequestAiReview();
    }, 100);
  };

  // AI修正版をフレーズ帳に追加
  const handleSaveAiRevisedToPhrasebook = async () => {
    if (!aiReview || !currentPrompt) return;
    try {
      await db.phrases.put({
        id: `phrase-ai-${Date.now()}`,
        english: aiReview.revised,
        japanese: aiReview.revisedJapanese || currentPrompt.japanese,
        notes: `【AI解説】${aiReview.grammarExplanation}\n【表現】${aiReview.naturalPhrasing}`,
        tags: ['AI添削', ...currentPrompt.tags],
        isBookmarked: true,
        reviewCount: 0,
        createdAt: new Date().toISOString(),
      });
      setIsAiSavedToPhrasebook(true);
      onShowToast('AI修正版をフレーズ帳に保存しました！', 'success');
    } catch (err) {
      console.error('Failed to save AI revised phrase:', err);
      onShowToast('保存中にエラーが発生しました', 'error');
    }
  };

  // 次の問題へ
  const handleNext = () => {
    if (currentIndex < filteredPrompts.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0);
      onShowToast('最後の問題に到達しました。先頭に戻ります！', 'info');
    }
  };

  // 前の問題へ
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  if (!currentPrompt) {
    return <div className="p-4 text-center text-slate-500">問題がありません</div>;
  }

  // 一致度算出（参考情報として表示し、不正解断定はしない）
  const currentAnswer = textInput.trim() || userSpeech.trim();
  const similarity = currentAnswer
    ? evaluateSimilarity(currentAnswer, currentPrompt.english, currentPrompt.acceptableAnswers)
    : null;

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-300">
      {/* 上部コントロール：カテゴリ絞り込みとタイマー設定 */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
        {/* カテゴリ */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => { setCategoryFilter('all'); setCurrentIndex(0); }}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              categoryFilter === 'all' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-600'
            }`}
          >
            すべて (30)
          </button>
          <button
            onClick={() => { setCategoryFilter('business'); setCurrentIndex(0); }}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              categoryFilter === 'business' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-600'
            }`}
          >
            仕事 (15)
          </button>
          <button
            onClick={() => { setCategoryFilter('daily'); setCurrentIndex(0); }}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              categoryFilter === 'daily' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-600'
            }`}
          >
            日常 (15)
          </button>
        </div>

        {/* タイマー秒数選択 */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <Clock className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
          {[5, 10, 0].map((sec) => (
            <button
              key={sec}
              onClick={() => setTimerDuration(sec)}
              className={`px-2 py-0.5 rounded-lg font-medium transition-all ${
                timerDuration === sec ? 'bg-blue-600 text-white font-bold' : 'text-slate-600'
              }`}
            >
              {sec === 0 ? '無制限' : `${sec}秒`}
            </button>
          ))}
        </div>
      </div>

      {/* 問題進行カウンター & タイマーゲージ */}
      <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
        <span>問 {currentIndex + 1} / {filteredPrompts.length}</span>
        <div className="flex gap-1.5">
          {currentPrompt.tags.map((t) => (
            <span key={t} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-semibold text-[10px]">
              #{t}
            </span>
          ))}
        </div>
      </div>

      {/* タイマーバー */}
      {timerDuration > 0 && (
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${
              timeLeft <= 2 ? 'bg-rose-500' : 'bg-blue-600'
            }`}
            style={{ width: `${(timeLeft / timerDuration) * 100}%` }}
          />
        </div>
      )}

      {/* 日本語のお題カード */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2.5 py-1 rounded-full">
            日本語 → 英語で即答
          </span>
          {timerDuration > 0 && !hasRevealed && (
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${timeLeft <= 2 ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-slate-100 text-slate-600'}`}>
              残り {timeLeft}秒
            </span>
          )}
        </div>

        <h3 className="text-lg font-bold text-slate-900 leading-snug my-2">
          {currentPrompt.japanese}
        </h3>

        {/* 思考のヒント（キーポイント） */}
        {currentPrompt.keyPoints && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span>着眼点: <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded">{currentPrompt.keyPoints}</code></span>
          </div>
        )}
      </div>

      {/* 回答エリア（音声認識またはテキスト入力） */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700">あなたの英語回答（発話または入力）</label>
          <span className="text-[11px] text-slate-400">マイクボタンで声でも入力可能</span>
        </div>

        <div className="relative">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="声に出すか、ここに入力..."
            className="w-full text-sm px-4 py-3 pr-12 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
          />
          {/* 音声入力ボタン */}
          <button
            onClick={toggleListening}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-300'
                : 'text-slate-500 hover:text-blue-600 hover:bg-slate-200/60'
            }`}
            title="音声入力（マイク）"
            aria-label="音声入力"
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>

        {isListening && (
          <p className="text-xs text-rose-600 font-medium animate-pulse flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            聞いています... 英語で話してください
          </p>
        )}

        {/* 答えを見るボタン */}
        {!hasRevealed && (
          <button
            onClick={handleReveal}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
          >
            <span>模範解答と解説を確認する</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 模範解答＆解説エリア（表示後） */}
      {hasRevealed && (
        <div className="bg-white border-2 border-blue-500/30 rounded-3xl p-5 shadow-lg space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2.5 py-1 rounded-full">
              模範解答（アメリカ英語）
            </span>

            <div className="flex items-center gap-1.5">
              {/* 音声再生ボタン */}
              <button
                onClick={handlePlayModelAudio}
                className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors"
                title="アメリカ英語で読み上げ"
              >
                <Volume2 className="w-5 h-5" />
              </button>

              {/* フレーズ帳追加ボタン */}
              <button
                onClick={handleTogglePhrasebook}
                className={`p-2 rounded-xl transition-colors ${
                  isSavedToPhrasebook
                    ? 'bg-amber-100 text-amber-700 font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title={isSavedToPhrasebook ? 'フレーズ帳に保存済み' : 'フレーズ帳に保存'}
              >
                {isSavedToPhrasebook ? <BookmarkCheck className="w-5 h-5 text-amber-600" /> : <BookmarkPlus className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* 模範英文 */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <p className="text-base font-bold text-slate-900 leading-relaxed font-sans">
              {currentPrompt.english}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {currentPrompt.japanese}
            </p>
          </div>

          {/* 別解（acceptable answers） */}
          {currentPrompt.acceptableAnswers && currentPrompt.acceptableAnswers.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                他の自然な言い回し:
              </span>
              <ul className="text-xs text-slate-700 space-y-1 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                {currentPrompt.acceptableAnswers.map((alt, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-blue-500 font-bold">•</span>
                    <span>{alt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 解説メモ */}
          {currentPrompt.notes && (
            <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-amber-900 leading-relaxed">
              <strong>💡 解説・ポイント:</strong> {currentPrompt.notes}
            </div>
          )}

          {/* AI添削トリガーボタン */}
          <div className="pt-1">
            <button
              onClick={handleRequestAiReview}
              disabled={isAiLoading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-blue-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-60"
            >
              {isAiLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                  <span>Gemini AIがあなたの回答を添削中...</span>
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4 text-amber-300" />
                  <span>{aiReview ? 'AI添削をもう一度実行する' : 'あなたの回答をAI添削する（Gemini）'}</span>
                </>
              )}
            </button>
          </div>

          {/* AI添削エラー表示 */}
          {aiError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1 animate-in fade-in">
              <div className="font-bold flex items-center gap-1.5 text-rose-900">
                <span>⚠️ AI添削エラー</span>
              </div>
              <p className="text-[11px] leading-relaxed">{aiError}</p>
              <div className="pt-1">
                <button
                  onClick={() => setIsTokenModalOpen(true)}
                  className="text-[11px] font-bold text-blue-600 hover:underline"
                >
                  アクセストークンを再設定する →
                </button>
              </div>
            </div>
          )}

          {/* AI添削結果カード */}
          {aiReview && (
            <div className="bg-gradient-to-br from-indigo-50/90 via-blue-50/50 to-white border-2 border-indigo-200 rounded-3xl p-4 shadow-md space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-900">
                  <Bot className="w-4 h-4 text-indigo-600" />
                  <span>AI英文添削レポート</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.2 rounded-full">
                    Gemini
                  </span>
                </div>

                {/* 修正版をフレーズ帳に追加ボタン */}
                <button
                  onClick={handleSaveAiRevisedToPhrasebook}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                    isAiSavedToPhrasebook
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                  }`}
                  title="修正版をフレーズ帳に保存"
                >
                  {isAiSavedToPhrasebook ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>保存済み</span>
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      <span>修正版を保存</span>
                    </>
                  )}
                </button>
              </div>

              {/* 1. 元の英文 */}
              <div className="text-xs space-y-0.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  あなたの元の英文:
                </span>
                <p className="text-slate-700 font-medium bg-white/80 p-2 rounded-xl border border-slate-200/60 font-mono text-xs">
                  {aiReview.original}
                </p>
              </div>

              {/* 2. 修正版（Revised）＆ 日本語訳 */}
              <div className="bg-white p-3 rounded-2xl border-2 border-indigo-300 shadow-sm space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                      ✨ おすすめ修正英文（アメリカ英語）:
                    </span>
                    <p className="text-sm font-extrabold text-slate-900 mt-0.5 leading-snug">
                      {aiReview.revised}
                    </p>
                  </div>
                  <button
                    onClick={() => speakText(aiReview.revised)}
                    className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors flex-shrink-0"
                    title="修正英文を読み上げ (en-US)"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 font-medium pt-1 border-t border-slate-100">
                  {aiReview.revisedJapanese}
                </p>
              </div>

              {/* 3. 良かった点 */}
              {aiReview.positiveFeedback && (
                <div className="p-2.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-xs text-emerald-950 space-y-0.5">
                  <span className="font-bold text-emerald-800 text-[11px] block">
                    🎉 伝わっている点・良かった点:
                  </span>
                  <p className="text-[11px] leading-relaxed">{aiReview.positiveFeedback}</p>
                </div>
              )}

              {/* 4. 文法・語法の解説 */}
              {aiReview.grammarExplanation && (
                <div className="p-2.5 bg-blue-50/80 border border-blue-200/80 rounded-xl text-xs text-blue-950 space-y-0.5">
                  <span className="font-bold text-blue-800 text-[11px] block">
                    💡 文法・語法のポイント:
                  </span>
                  <p className="text-[11px] leading-relaxed whitespace-pre-wrap">{aiReview.grammarExplanation}</p>
                </div>
              )}

              {/* 5. より自然な英語表現 */}
              {aiReview.naturalPhrasing && (
                <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-950 space-y-0.5">
                  <span className="font-bold text-amber-800 text-[11px] block">
                    💬 会議・日常で即戦力の別表現:
                  </span>
                  <p className="text-[11px] leading-relaxed">{aiReview.naturalPhrasing}</p>
                </div>
              )}
            </div>
          )}

          {/* 参考類似度（断定はせず参考目安として表示） */}
          {similarity && currentAnswer && (
            <div className="flex items-center justify-between text-xs px-1 text-slate-500">
              <span>模範解答との語彙一致率（参考値）:</span>
              <span className="font-bold text-blue-600">{similarity.score}%</span>
            </div>
          )}

          {/* 自己評価ボタン（固定解と一致しなくてもユーザー自身が納得して選べる） */}
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-800 text-center mb-2.5">
              自分の回答を振り返りましょう（履歴に保存されます）:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleRating('perfect')}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  selectedRating === 'perfect'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md font-bold'
                    : 'bg-emerald-50/60 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <span className="text-base">🎉</span>
                <span className="text-xs font-bold leading-tight">言えた！</span>
                <span className="text-[10px] opacity-80">即答できた</span>
              </button>

              <button
                onClick={() => handleRating('good')}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  selectedRating === 'good'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md font-bold'
                    : 'bg-blue-50/60 text-blue-800 border-blue-200 hover:bg-blue-100'
                }`}
              >
                <span className="text-base">👍</span>
                <span className="text-xs font-bold leading-tight">惜しい</span>
                <span className="text-[10px] opacity-80">詰まった・別表現</span>
              </button>

              <button
                onClick={() => handleRating('hard')}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  selectedRating === 'hard'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-md font-bold'
                    : 'bg-rose-50/60 text-rose-800 border-rose-200 hover:bg-rose-100'
                }`}
              >
                <span className="text-base">💪</span>
                <span className="text-xs font-bold leading-tight">要復習</span>
                <span className="text-[10px] opacity-80">言えなかった</span>
              </button>
            </div>
          </div>

          {/* 前へ・次へナビゲーションボタン */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-700 font-bold text-xs hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              前へ
            </button>
            <button
              onClick={handleNext}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-1"
            >
              <span>次の問題</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* AI添削アクセストークン設定モーダル */}
      {isTokenModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                <Key className="w-4 h-4 text-amber-500" />
                <span>AI添削アクセストークン</span>
              </div>
              <button
                onClick={() => setIsTokenModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              APIキーはCloudflare Worker（サーバー側）に安全に秘匿されています。
              Workerに設定した<strong>個人専用アクセストークン（AUTH_TOKEN）</strong>を入力してください。
            </p>

            <form onSubmit={handleSaveTokenAndReview} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  アクセストークン
                </label>
                <input
                  type="password"
                  required
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="fp_sec_..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rememberToken"
                  checked={rememberToken}
                  onChange={(e) => setRememberToken(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <label htmlFor="rememberToken" className="text-[11px] text-slate-600 select-none cursor-pointer">
                  次回以降も保存する（共有端末では選ばない）
                </label>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsTokenModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20"
                >
                  保存して添削する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
