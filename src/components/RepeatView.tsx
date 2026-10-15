import { useState, useEffect, useRef, type FC } from 'react';
import {
  Volume2,
  Mic,
  MicOff,
  Eye,
  EyeOff,
  BookmarkPlus,
  BookmarkCheck,
  ArrowRight,
  Sparkles,
  Gauge,
  Headphones,
} from 'lucide-react';
import type { RepeatSentence, SelfRating, StudyRecord } from '../types';
import { INITIAL_REPEAT_SENTENCES } from '../data/initialRepeatSentences';
import { speakText, stopSpeaking, SpeechRecognizer, evaluateSimilarity } from '../services/speech';
import { db } from '../services/db';

interface RepeatViewProps {
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRecordSaved: () => void;
}

export const RepeatView: FC<RepeatViewProps> = ({
  onShowToast,
  onRecordSaved,
}) => {
  const [sentences] = useState<RepeatSentence[]>(INITIAL_REPEAT_SENTENCES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'business' | 'daily'>('all');

  // 再生設定
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // 表示モード（VERSANT風ブラインドモード：最初は英文を隠して耳で聴く）
  const [isMasked, setIsMasked] = useState<boolean>(true);

  // 回答状態
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [selectedRating, setSelectedRating] = useState<SelfRating | null>(null);
  const [isSavedToPhrasebook, setIsSavedToPhrasebook] = useState<boolean>(false);

  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const filteredSentences = sentences.filter((s) => {
    if (categoryFilter === 'all') return true;
    return s.category === categoryFilter;
  });

  const currentSentence: RepeatSentence | undefined =
    filteredSentences[currentIndex] || filteredSentences[0];

  useEffect(() => {
    recognizerRef.current = new SpeechRecognizer();
    return () => {
      stopSpeaking();
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
    };
  }, []);

  // 問題切り替え時のリセット
  useEffect(() => {
    setUserTranscript('');
    setIsListening(false);
    setSelectedRating(null);
    setIsMasked(true);
    setIsSavedToPhrasebook(false);
    startTimeRef.current = Date.now();

    if (currentSentence) {
      db.phrases.where('english').equals(currentSentence.english).first().then((found) => {
        setIsSavedToPhrasebook(!!found);
      });
    }
  }, [currentIndex, categoryFilter, currentSentence]);

  // 音声読み上げ
  const handlePlayAudio = () => {
    if (!currentSentence) return;
    setIsPlaying(true);
    speakText(currentSentence.english, speechRate, 1.0, () => {
      setIsPlaying(false);
    });
  };

  // 音声認識の開始・停止
  const toggleListening = () => {
    if (!recognizerRef.current) return;

    if (isListening) {
      recognizerRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      const ok = recognizerRef.current.start(
        (transcript, isFinal) => {
          setUserTranscript(transcript);
          if (isFinal) {
            setIsListening(false);
            // 音声入力完了時に自動でテキスト開示
            setIsMasked(false);
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

  // 自己評価を記録
  const handleRating = async (rating: SelfRating) => {
    if (!currentSentence) return;
    setSelectedRating(rating);

    const answerText = userTranscript.trim();
    const responseTime = Math.max(1000, Date.now() - startTimeRef.current);
    const { score } = evaluateSimilarity(answerText, currentSentence.english);

    const record: StudyRecord = {
      type: 'repeat',
      promptId: currentSentence.id,
      promptText: currentSentence.english,
      userResponse: answerText,
      modelAnswer: currentSentence.english,
      selfRating: rating,
      responseTimeMs: responseTime,
      similarityScore: score,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
    };

    try {
      await db.records.add(record);
      onRecordSaved();
      onShowToast(
        rating === 'perfect'
          ? '🎉 完璧なリピートです！'
          : rating === 'good'
          ? '👍 意味と構造がよく取れています！'
          : '💪 復習リストに追加しました',
        'success'
      );
    } catch (err) {
      console.error('Failed to save repeat record:', err);
    }
  };

  // フレーズ帳に追加
  const handleTogglePhrasebook = async () => {
    if (!currentSentence) return;

    try {
      if (isSavedToPhrasebook) {
        const existing = await db.phrases.where('english').equals(currentSentence.english).first();
        if (existing) {
          await db.phrases.delete(existing.id);
          setIsSavedToPhrasebook(false);
          onShowToast('フレーズ帳から解除しました', 'info');
        }
      } else {
        await db.phrases.put({
          id: `phrase-${Date.now()}`,
          english: currentSentence.english,
          japanese: currentSentence.japanese,
          notes: currentSentence.audioTip,
          tags: currentSentence.tags,
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

  // 次・前へ
  const handleNext = () => {
    if (currentIndex < filteredSentences.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0);
      onShowToast('全30問完了しました！先頭に戻ります', 'info');
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  if (!currentSentence) {
    return <div className="p-4 text-center text-slate-500">問題がありません</div>;
  }

  // 参考類似度（採点と断定せず、単語一致率の目安として表示）
  const similarity = userTranscript.trim()
    ? evaluateSimilarity(userTranscript.trim(), currentSentence.english)
    : null;

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-300">
      {/* 上部コントロール：カテゴリ＆速度調整 */}
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

        {/* 音声速度 */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <Gauge className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
          {[0.8, 1.0, 1.2].map((rate) => (
            <button
              key={rate}
              onClick={() => setSpeechRate(rate)}
              className={`px-2 py-0.5 rounded-lg font-medium transition-all ${
                speechRate === rate ? 'bg-blue-600 text-white font-bold' : 'text-slate-600'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>

      {/* 進行状況 & 語数バッジ */}
      <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
        <span>問 {currentIndex + 1} / {filteredSentences.length}</span>
        <div className="flex items-center gap-1.5">
          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold text-[10px]">
            {currentSentence.wordCount}語
          </span>
          {currentSentence.tags.map((t) => (
            <span key={t} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium text-[10px]">
              #{t}
            </span>
          ))}
        </div>
      </div>

      {/* 音声再生カード（VERSANT風 リスニング＆リピート） */}
      <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl text-center relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-1 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs text-blue-200">
            <Headphones className="w-3.5 h-3.5" />
            <span>VERSANT形式 · 音声を聴いてリピート</span>
          </div>

          {/* 大きな再生ボタン */}
          <div>
            <button
              onClick={handlePlayAudio}
              className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center transition-all ${
                isPlaying
                  ? 'bg-amber-400 text-slate-900 scale-105 shadow-xl shadow-amber-400/40 ring-4 ring-amber-300/30'
                  : 'bg-white text-blue-900 hover:scale-105 active:scale-95 shadow-xl shadow-white/20'
              }`}
              title="英文を読み上げ (en-US)"
            >
              <Volume2 className={`w-9 h-9 ${isPlaying ? 'animate-bounce' : ''}`} />
            </button>
            <p className="text-xs text-blue-200 mt-2 font-medium">
              {isPlaying ? '再生中（en-US）...' : 'タップして音声を聴く（en-US）'}
            </p>
          </div>

          {/* 英文表示・非表示トグル（ブラインド練習用） */}
          <div className="pt-2">
            <button
              onClick={() => setIsMasked(!isMasked)}
              className="inline-flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white px-3.5 py-1.5 rounded-full transition-colors"
            >
              {isMasked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{isMasked ? '英文テキストを見る' : 'テキストを隠す'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 英文＆日本語訳の開示カード */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2.5 py-1 rounded-full">
            対象英文（{currentSentence.wordCount}語）
          </span>

          <button
            onClick={handleTogglePhrasebook}
            className={`p-2 rounded-xl transition-colors ${
              isSavedToPhrasebook
                ? 'bg-amber-100 text-amber-700 font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title="フレーズ帳に保存"
          >
            {isSavedToPhrasebook ? <BookmarkCheck className="w-5 h-5 text-amber-600" /> : <BookmarkPlus className="w-5 h-5" />}
          </button>
        </div>

        {isMasked ? (
          <div className="py-6 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-center">
            <p className="text-xs text-slate-500 font-medium">
              🎧 音声を聞いて、まずは何も見ずにリピートしてみましょう！
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              下のマイクで発声するか、「英文テキストを見る」で確認できます
            </p>
          </div>
        ) : (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <p className="text-base font-bold text-slate-900 leading-relaxed font-sans">
                {currentSentence.english}
              </p>
              <p className="text-xs text-slate-600 mt-2 font-medium">
                {currentSentence.japanese}
              </p>
            </div>

            {currentSentence.audioTip && (
              <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>発音・聞き取りのコツ:</strong> {currentSentence.audioTip}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 音声入力・リピート練習エリア */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800">
            あなたのリピート発話（マイク）
          </label>
          <span className="text-[10px] text-slate-400">※音声認識は参考表示用です</span>
        </div>

        {/* 録音ボタン */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleListening}
            className={`flex-1 py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-300'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-md shadow-indigo-500/20'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>録音中... もう一度タップで完了</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>マイクをオンにしてリピートする</span>
              </>
            )}
          </button>
        </div>

        {/* 認識結果の表示 */}
        {userTranscript && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-400 block text-[10px] mb-1 font-semibold">聞き取れた英語:</span>
            <p className="text-slate-800 font-medium">{userTranscript}</p>
            {similarity && (
              <p className="text-[11px] text-indigo-600 font-semibold mt-1">
                単語の一致度（目安）: {similarity.score}%
              </p>
            )}
          </div>
        )}

        {/* 自己評価ボタン */}
        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-800 text-center mb-2.5">
            リピートの出来栄えを評価（履歴に記録されます）:
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
              <span className="text-[10px] opacity-80">9〜15語スラスラ</span>
            </button>

            <button
              onClick={() => handleRating('good')}
              className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all ${
                selectedRating === 'good'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md font-bold'
                  : 'bg-indigo-50/60 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              <span className="text-base">👍</span>
              <span className="text-xs font-bold leading-tight">惜しい</span>
              <span className="text-[10px] opacity-80">後半が少し抜けた</span>
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
              <span className="text-[10px] opacity-80">聞き取れなかった</span>
            </button>
          </div>
        </div>

        {/* 前へ・次へ */}
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
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-1"
          >
            <span>次のセンテンス</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
