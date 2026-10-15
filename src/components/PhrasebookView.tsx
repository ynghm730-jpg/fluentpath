import { useState, useEffect, useRef, type FC, type FormEvent, type ChangeEvent } from 'react';
import {
  Search,
  Plus,
  Volume2,
  Bookmark,
  Trash2,
  Edit2,
  Download,
  Upload,
  CheckCircle2,
  X,
  FileText,
} from 'lucide-react';
import type { PhraseItem } from '../types';
import { db } from '../services/db';
import { speakText } from '../services/speech';
import { downloadCSV, exportPhrasesToCSV, parsePhrasesFromCSV } from '../utils/csv';

interface PhrasebookViewProps {
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshPhraseCount: () => void;
}

export const PhrasebookView: FC<PhrasebookViewProps> = ({
  onShowToast,
  onRefreshPhraseCount,
}) => {
  const [phrases, setPhrases] = useState<PhraseItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [onlyBookmarked, setOnlyBookmarked] = useState<boolean>(false);

  // モーダル状態
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPhrase, setEditingPhrase] = useState<PhraseItem | null>(null);

  // フォーム状態
  const [formEnglish, setFormEnglish] = useState<string>('');
  const [formJapanese, setFormJapanese] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formTags, setFormTags] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // フレーズの読み込み
  const loadPhrases = async () => {
    try {
      const items = await db.phrases.reverse().sortBy('createdAt');
      setPhrases(items);
      onRefreshPhraseCount();
    } catch (err) {
      console.error('Failed to load phrases:', err);
    }
  };

  useEffect(() => {
    loadPhrases();
  }, []);

  // タグ一覧の抽出
  const allTags = Array.from(
    new Set(phrases.flatMap((p) => p.tags || []))
  ).filter(Boolean);

  // フィルタリング処理
  const filteredPhrases = phrases.filter((p) => {
    const matchesSearch =
      p.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.japanese.includes(searchQuery) ||
      (p.notes && p.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTag =
      selectedTag === 'all' || (p.tags && p.tags.includes(selectedTag));

    const matchesBookmark = !onlyBookmarked || p.isBookmarked;

    return matchesSearch && matchesTag && matchesBookmark;
  });

  // 音声再生
  const handleSpeak = (text: string) => {
    speakText(text);
  };

  // 復習カウント増加
  const handleReviewed = async (phrase: PhraseItem) => {
    try {
      const updated: PhraseItem = {
        ...phrase,
        reviewCount: (phrase.reviewCount || 0) + 1,
        lastReviewedAt: new Date().toISOString(),
      };
      await db.phrases.put(updated);
      await loadPhrases();
      speakText(phrase.english);
      onShowToast('復習カウントを更新しました！', 'success');
    } catch (err) {
      console.error('Failed to update review:', err);
    }
  };

  // ブックマーク切り替え
  const handleToggleBookmark = async (phrase: PhraseItem) => {
    try {
      const updated: PhraseItem = {
        ...phrase,
        isBookmarked: !phrase.isBookmarked,
      };
      await db.phrases.put(updated);
      await loadPhrases();
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  };

  // 削除
  const handleDelete = async (id: string) => {
    if (confirm('このフレーズを削除しますか？')) {
      try {
        await db.phrases.delete(id);
        await loadPhrases();
        onShowToast('フレーズを削除しました', 'info');
      } catch (err) {
        console.error('Failed to delete phrase:', err);
      }
    }
  };

  // モーダルを開く（新規または編集）
  const handleOpenModal = (phrase?: PhraseItem) => {
    if (phrase) {
      setEditingPhrase(phrase);
      setFormEnglish(phrase.english);
      setFormJapanese(phrase.japanese);
      setFormNotes(phrase.notes || '');
      setFormTags(phrase.tags.join(', '));
    } else {
      setEditingPhrase(null);
      setFormEnglish('');
      setFormJapanese('');
      setFormNotes('');
      setFormTags('会議, 仕事');
    }
    setIsModalOpen(true);
  };

  // フォーム保存
  const handleSavePhrase = async (e: FormEvent) => {
    e.preventDefault();
    if (!formEnglish.trim() || !formJapanese.trim()) {
      onShowToast('英語と日本語の両方を入力してください', 'error');
      return;
    }

    const tagsArray = formTags
      .split(/[,、]/)
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (editingPhrase) {
        const updated: PhraseItem = {
          ...editingPhrase,
          english: formEnglish.trim(),
          japanese: formJapanese.trim(),
          notes: formNotes.trim(),
          tags: tagsArray,
        };
        await db.phrases.put(updated);
        onShowToast('フレーズを更新しました', 'success');
      } else {
        const newPhrase: PhraseItem = {
          id: `phrase-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          english: formEnglish.trim(),
          japanese: formJapanese.trim(),
          notes: formNotes.trim(),
          tags: tagsArray.length > 0 ? tagsArray : ['マイルール'],
          isBookmarked: true,
          reviewCount: 0,
          createdAt: new Date().toISOString(),
        };
        await db.phrases.add(newPhrase);
        onShowToast('新しいフレーズを登録しました！', 'success');
      }

      setIsModalOpen(false);
      await loadPhrases();
    } catch (err) {
      console.error('Failed to save phrase:', err);
      onShowToast('保存中にエラーが発生しました', 'error');
    }
  };

  // CSVエクスポート
  const handleExportCSV = () => {
    if (phrases.length === 0) {
      onShowToast('エクスポートするフレーズがありません', 'error');
      return;
    }
    const csvData = exportPhrasesToCSV(phrases);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCSV(`FluentPath_phrases_${dateStr}.csv`, csvData);
    onShowToast('CSVファイルをダウンロードしました', 'success');
  };

  // CSVインポート
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const { phrases: imported, errorCount } = parsePhrasesFromCSV(text);

        if (imported.length === 0) {
          onShowToast('インポート可能なフレーズが見つかりませんでした', 'error');
          return;
        }

        // IndexedDBに一括登録
        await db.phrases.bulkPut(imported);
        await loadPhrases();

        onShowToast(
          `${imported.length}件のフレーズをインポートしました！${
            errorCount > 0 ? ` (スキップ: ${errorCount}件)` : ''
          }`,
          'success'
        );
      } catch (err) {
        console.error('CSV import error:', err);
        onShowToast('CSVの読み込みに失敗しました。フォーマットを確認してください。', 'error');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-300">
      {/* 上部ヘッダー：タイトルとCSV・追加アクション */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">フレーズ帳</h2>
          <p className="text-xs text-slate-500">
            登録数: {phrases.length}件（表示中: {filteredPhrases.length}件）
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* CSVインポートボタン */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,text/csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1"
            title="CSVからインポート"
          >
            <Upload className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">インポート</span>
          </button>

          {/* CSVエクスポートボタン */}
          <button
            onClick={handleExportCSV}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1"
            title="CSVにエクスポート"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">エクスポート</span>
          </button>

          {/* 新規登録ボタン */}
          <button
            onClick={() => handleOpenModal()}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            <span>追加</span>
          </button>
        </div>
      </div>

      {/* 検索バー */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="英語・日本語・解説から検索..."
          className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-blue-500 outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* タグフィルター */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        <button
          onClick={() => setSelectedTag('all')}
          className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-all ${
            selectedTag === 'all'
              ? 'bg-slate-900 text-white font-bold'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          すべて
        </button>

        <button
          onClick={() => setOnlyBookmarked(!onlyBookmarked)}
          className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-all flex items-center gap-1 ${
            onlyBookmarked
              ? 'bg-amber-500 text-white font-bold'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Bookmark className="w-3 h-3 fill-current" />
          <span>お気に入り</span>
        </button>

        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => setSelectedTag(tag)}
            className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-all ${
              selectedTag === tag
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            #{tag}
          </button>
        ))}
      </div>

      {/* フレーズ一覧 */}
      {filteredPhrases.length === 0 ? (
        <div className="py-12 bg-white rounded-3xl border border-dashed border-slate-300 text-center px-4">
          <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-700">登録されたフレーズがありません</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
            瞬間英作文やリピート画面のブックマークボタンをタップするか、右上の「追加」から登録してください。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPhrases.map((phrase) => (
            <div
              key={phrase.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 leading-snug">
                      {phrase.english}
                    </p>
                  </div>
                  <p className="text-xs text-slate-600">{phrase.japanese}</p>
                </div>

                {/* 音声再生ボタン */}
                <button
                  onClick={() => handleSpeak(phrase.english)}
                  className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors flex-shrink-0"
                  title="音声を再生 (en-US)"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              {/* メモ */}
              {phrase.notes && (
                <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {phrase.notes}
                </p>
              )}

              {/* タグ & 復習回数 & アクション */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {phrase.tags.map((t) => (
                    <span key={t} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px]">
                      #{t}
                    </span>
                  ))}
                  <span className="text-[10px] text-blue-600 font-semibold ml-1">
                    復習 {phrase.reviewCount || 0}回
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {/* 声に出して復習完了 */}
                  <button
                    onClick={() => handleReviewed(phrase)}
                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="声に出して復習（カウント+1）"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>

                  {/* お気に入り切り替え */}
                  <button
                    onClick={() => handleToggleBookmark(phrase)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      phrase.isBookmarked
                        ? 'text-amber-500 hover:bg-amber-50'
                        : 'text-slate-400 hover:bg-slate-100'
                    }`}
                    title="お気に入り"
                  >
                    <Bookmark className={`w-4 h-4 ${phrase.isBookmarked ? 'fill-current' : ''}`} />
                  </button>

                  {/* 編集 */}
                  <button
                    onClick={() => handleOpenModal(phrase)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="編集"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* 削除 */}
                  <button
                    onClick={() => handleDelete(phrase.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* フレーズ登録・編集モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingPhrase ? 'フレーズの編集' : '新しいフレーズの追加'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePhrase} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">英語 *</label>
                <input
                  type="text"
                  required
                  value={formEnglish}
                  onChange={(e) => setFormEnglish(e.target.value)}
                  placeholder="例: I completely agree with your point."
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">日本語訳 *</label>
                <input
                  type="text"
                  required
                  value={formJapanese}
                  onChange={(e) => setFormJapanese(e.target.value)}
                  placeholder="例: その点についてあなたのご意見に完全に賛成です。"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">タグ（カンマ区切り）</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="例: 会議, 意見, 仕事"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">メモ・使い方のコツ（任意）</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="例: オンライン会議で即座に同意を伝えるときに使う"
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20"
                >
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
