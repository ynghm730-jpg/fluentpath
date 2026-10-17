import { useState, useEffect, useRef, type ChangeEvent, type FC } from 'react';
import {
  Trash2,
  Download,
  Upload,
  FileArchive,
  Key,
  ShieldCheck,
  CheckCircle,
  Volume2,
} from 'lucide-react';
import type { StudyRecord, ReviewCard, ConversationSession } from '../types';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { db, getWeakRecords } from '../services/db';
import { speakText } from '../services/speech';
import { downloadCSV } from '../utils/csv';
import { createBackup, downloadBackup, readBackupFile, mergeBackup } from '../services/backup';

interface StatsDataViewProps {
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshData: () => void;
}

export const StatsDataView: FC<StatsDataViewProps> = ({
  onShowToast,
  onRefreshData,
}) => {
  const [records, setRecords] = useState<StudyRecord[]>([]);
  const [reviewCards, setReviewCards] = useState<ReviewCard[]>([]);
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [weakRecords, setWeakRecords] = useState<StudyRecord[]>([]);
  const [hasLegacyKey, setHasLegacyKey] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'stats' | 'weak' | 'settings'>('analysis');
  const backupFileRef = useRef<HTMLInputElement>(null);
  const [backupBusy, setBackupBusy] = useState(false);

  // データロード
  const loadData = async () => {
    try {
      const [allRecords, allReviews, allConversations] = await Promise.all([
        db.records.reverse().toArray(), db.reviews.toArray(), db.conversations.toArray(),
      ]);
      setRecords(allRecords);
      setReviewCards(allReviews);
      setConversations(allConversations);
      setLoadError(false);

      const weaks = await getWeakRecords();
      setWeakRecords(weaks);

      setHasLegacyKey(Boolean(await db.settings.get('gemini_api_key')));
    } catch (err) {
      setLoadError(true);
      console.error('Failed to load stats:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 統計値の計算
  const totalSessions = records.length;
  const quickRecords = records.filter((r) => r.type === 'quick');
  const repeatRecords = records.filter((r) => r.type === 'repeat');

  const avgQuickTime =
    quickRecords.length > 0
      ? (
          quickRecords.reduce((acc, r) => acc + (r.responseTimeMs || 0), 0) /
          quickRecords.length /
          1000
        ).toFixed(1)
      : '0.0';

  const perfectCount = records.filter((r) => r.selfRating === 'perfect').length;
  const goodCount = records.filter((r) => r.selfRating === 'good').length;
  const hardCount = records.filter((r) => r.selfRating === 'hard').length;

  const perfectRate =
    totalSessions > 0 ? Math.round((perfectCount / totalSessions) * 100) : 0;

  const deleteLegacyApiKey = async () => {
    await db.settings.delete('gemini_api_key');
    setHasLegacyKey(false);
    onShowToast('古い端末内APIキーを削除しました', 'success');
  };

  // 全履歴のバックアップダウンロード（CSV）
  const handleExportHistory = () => {
    if (records.length === 0) {
      onShowToast('出力可能な学習履歴がありません', 'error');
      return;
    }

    const headers = [
      'id',
      'type',
      'date',
      'promptText',
      'userResponse',
      'modelAnswer',
      'selfRating',
      'responseTimeMs',
      'similarityScore',
      'timestamp',
    ];

    const rows = records.map((r) => [
      r.id || '',
      r.type,
      r.date,
      `"${(r.promptText || '').replace(/"/g, '""')}"`,
      `"${(r.userResponse || '').replace(/"/g, '""')}"`,
      `"${(r.modelAnswer || '').replace(/"/g, '""')}"`,
      r.selfRating,
      r.responseTimeMs,
      r.similarityScore || 0,
      r.timestamp,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const today = new Date().toISOString().split('T')[0];
    downloadCSV(`FluentPath_History_${today}.csv`, csvContent);
    onShowToast('学習履歴CSVをダウンロードしました', 'success');
  };

  // Full JSON backup includes records, phrases, conversations, and review cards,
  // but never auth tokens, API keys, or browser settings.
  const handleBackup = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      downloadBackup(await createBackup());
      onShowToast('学習データのJSONバックアップを保存しました', 'success');
    } catch (e) {
      onShowToast(`バックアップに失敗しました：${e instanceof Error ? e.message : '不明なエラー'}`, 'error');
    } finally { setBackupBusy(false); }
  };

  const handleImportBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || backupBusy) return;
    setBackupBusy(true);
    try {
      const payload = await readBackupFile(file);
      const { phrases, records, conversations, reviews, quickResponses } = payload.data;
      const approved = window.confirm(
        `バックアップ日時：${payload.exportedAt}\n` +
        `フレーズ${phrases.length}件、練習${records.length}件、英会話${conversations.length}件、復習${reviews.length}件、即答${quickResponses.length}件\n\n` +
        '既存データは削除せず、重複を除いて追加・統合します。復元しますか？'
      );
      if (!approved) return;
      const added = await mergeBackup(payload);
      await loadData();
      onRefreshData();
      onShowToast(`統合完了：フレーズ${added.phrases}・練習${added.records}・英会話${added.conversations}・復習${added.reviews}・即答${added.quickResponses}件を追加`, 'success');
    } catch (e) {
      onShowToast(`復元に失敗しました（元のデータは維持されます）：${e instanceof Error ? e.message : '不明なエラー'}`, 'error');
    } finally {
      if (backupFileRef.current) backupFileRef.current.value = '';
      setBackupBusy(false);
    }
  };

  // 履歴のリセット
  const handleClearHistory = async () => {
    if (
      confirm(
        'これまでの学習履歴ログをすべて削除しますか？\n（※フレーズ帳・英会話履歴・復習予定は削除されません）'
      )
    ) {
      try {
        await db.records.clear();
        await loadData();
        onRefreshData();
        onShowToast('学習履歴を初期化しました', 'info');
      } catch (err) {
        console.error('Failed to clear history:', err);
      }
    }
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-300">
      {loadError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3">学習データを読み込めませんでした。端末のストレージ設定をご確認ください。</p>}
      {/* 既存の履歴・設定を残して、分析タブを新設 */}
      <div className="flex bg-slate-200/80 p-1 rounded-2xl text-[11px] font-semibold">
        <button onClick={() => setActiveTab('analysis')}
          className={`flex-1 py-2 rounded-xl transition-all ${activeTab === 'analysis' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}>
          分析
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 py-2 rounded-xl transition-all ${
            activeTab === 'stats'
              ? 'bg-white text-blue-600 shadow-sm font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          履歴
        </button>
        <button
          onClick={() => setActiveTab('weak')}
          className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
            activeTab === 'weak'
              ? 'bg-white text-rose-600 shadow-sm font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>苦手</span>
          {weakRecords.length > 0 && (
            <span className="bg-rose-100 text-rose-600 text-[10px] px-1.5 py-0.2 rounded-full">
              {weakRecords.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-2 rounded-xl transition-all ${
            activeTab === 'settings'
              ? 'bg-white text-slate-900 shadow-sm font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          設定
        </button>
      </div>

      {activeTab === 'analysis' && (
        <AnalyticsDashboard records={records} reviews={reviewCards} conversations={conversations} />
      )}

      {/* 1. 学習統計タブ */}
      {activeTab === 'stats' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* サマリーカード */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 block">総練習回数</span>
              <p className="text-2xl font-extrabold text-blue-600 mt-1">
                {totalSessions} <span className="text-xs font-normal text-slate-500">回</span>
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                作文: {quickRecords.length} / リピート: {repeatRecords.length}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 block">平均回答速度</span>
              <p className="text-2xl font-extrabold text-indigo-600 mt-1">
                {avgQuickTime} <span className="text-xs font-normal text-slate-500">秒</span>
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                目標: 5秒以内の即答
              </span>
            </div>
          </div>

          {/* 自己評価の分布 */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800">自己評価の割合</h3>
              <span className="text-xs text-emerald-600 font-bold">即答率: {perfectRate}%</span>
            </div>

            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{ width: `${totalSessions ? (perfectCount / totalSessions) * 100 : 0}%` }}
                title={`言えた: ${perfectCount}`}
              />
              <div
                className="bg-blue-400 h-full transition-all"
                style={{ width: `${totalSessions ? (goodCount / totalSessions) * 100 : 0}%` }}
                title={`惜しい: ${goodCount}`}
              />
              <div
                className="bg-rose-400 h-full transition-all"
                style={{ width: `${totalSessions ? (hardCount / totalSessions) * 100 : 0}%` }}
                title={`要復習: ${hardCount}`}
              />
            </div>

            <div className="grid grid-cols-3 text-center text-xs pt-1">
              <div>
                <span className="block text-[11px] text-emerald-700 font-bold">🎉 言えた</span>
                <span className="font-extrabold text-slate-800">{perfectCount}回</span>
              </div>
              <div>
                <span className="block text-[11px] text-blue-700 font-bold">👍 惜しい</span>
                <span className="font-extrabold text-slate-800">{goodCount}回</span>
              </div>
              <div>
                <span className="block text-[11px] text-rose-700 font-bold">💪 要復習</span>
                <span className="font-extrabold text-slate-800">{hardCount}回</span>
              </div>
            </div>
          </div>

          {/* 最近の履歴ログ */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-800">最近の学習履歴（直近10件）</h3>
            {records.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">まだ履歴がありません</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {records.slice(0, 10).map((r, i) => (
                  <div
                    key={r.id || i}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5 max-w-[70%]">
                      <span className="text-[10px] font-bold text-blue-600 block">
                        {r.type === 'quick' ? '瞬間英作文' : r.type === 'ai' ? 'AI添削の復習' : 'リピート'} · {r.date}
                      </span>
                      <p className="text-slate-800 font-medium truncate">{r.promptText}</p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md inline-block ${
                          r.selfRating === 'perfect'
                            ? 'bg-emerald-100 text-emerald-700'
                            : r.selfRating === 'good'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {r.selfRating === 'perfect' ? '言えた' : r.selfRating === 'good' ? '惜しい' : '要復習'}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {(r.responseTimeMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. 苦手問題タブ */}
      {activeTab === 'weak' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-800">要復習マークされた問題</h3>
            <span className="text-xs text-slate-500">{weakRecords.length}件</span>
          </div>

          {weakRecords.length === 0 ? (
            <div className="py-12 bg-white rounded-3xl border border-dashed border-slate-300 text-center px-4">
              <CheckCircle className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
              <p className="text-sm font-bold text-slate-800">現在、苦手問題はありません！</p>
              <p className="text-xs text-slate-500 mt-1">
                練習で「要復習」を選択した問題がここに集まり、重点復習できます。
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {weakRecords.map((r, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-rose-200 rounded-2xl p-4 shadow-sm space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                      {r.type === 'quick' ? '瞬間英作文' : r.type === 'ai' ? 'AI添削の復習' : 'リピート'}
                    </span>
                    <button
                      onClick={() => speakText(r.modelAnswer)}
                      className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      title="音声を再生"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-800">{r.promptText}</p>
                    <p className="text-xs text-blue-700 font-semibold mt-1 bg-blue-50/60 p-2 rounded-lg">
                      模範: {r.modelAnswer}
                    </p>
                  </div>

                  {r.userResponse && (
                    <p className="text-[11px] text-slate-500">
                      前回のあなたの回答: <span className="text-slate-700">{r.userResponse}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. データ＆設定タブ */}
      {activeTab === 'settings' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* データ保存とプライバシー説明 */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2 text-xs">
            <div className="flex items-center gap-2 text-blue-600 font-bold">
              <ShieldCheck className="w-5 h-5" />
              <span>完全ローカル・プライバシー保証</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              練習履歴とフレーズ帳は原則この端末に保存されます。AI添削・AI英会話モードの
              テキストはCloudflare Worker経由でGeminiに送信されます。音声入力はブラウザの
              音声認識サービスを利用する場合があります。機密情報は入力しないでください。
            </p>
          </div>

          {/* APIキーはCloudflareのみ。旧バージョンの端末保存キーは任意に削除 */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Key className="w-4 h-4 text-amber-500" />
              <span>AIの接続方法</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Gemini APIキーはCloudflare WorkerのSecretにのみ登録してください。
              このブラウザにはGemini APIキーを入力・保存しないでください。
              AI添削とAI英会話には個人専用のAUTH_TOKENを使用します。
            </p>
            {hasLegacyKey && (
              <button onClick={deleteLegacyApiKey}
                className="w-full py-2.5 rounded-xl bg-rose-50 text-rose-700 font-bold border border-rose-200">
                過去に端末に保存したAPIキーを削除する
              </button>
            )}
          </div>

          {/* バックアップとデータ管理 */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2.5 text-xs">
            <h3 className="font-bold text-slate-800">データバックアップ & メンテナンス</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              JSONバックアップはフレーズ帳・学習記録・AI英会話履歴・復習予定をまとめて保存します。
              復元は既存データを消さない統合方式です。認証トークンとAPIキーは含みません。
            </p>
            <button disabled={backupBusy} onClick={handleBackup}
              className="w-full py-3 px-3 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 rounded-xl font-bold text-indigo-700 flex items-center justify-center gap-2 transition-colors">
              <FileArchive className="w-4 h-4" />
              <span>全学習データをJSONでバックアップ</span>
            </button>
            <input ref={backupFileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportBackup} aria-label="バックアップJSONファイルを選択" />
            <button disabled={backupBusy} onClick={() => backupFileRef.current?.click()}
              className="w-full py-3 px-3 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 rounded-xl font-bold text-emerald-700 flex items-center justify-center gap-2 transition-colors">
              <Upload className="w-4 h-4" />
              <span>バックアップJSONから復元（追加・統合）</span>
            </button>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              JSONには練習英文や会話内容が含まれます。クラウドなどで公開せず、大切に保管してください。
              旧バージョンのCSVは引き続き個別に使用できますが、完全復元はこのJSONを使ってください。
            </p>

            <button
              onClick={handleExportHistory}
              className="w-full py-2.5 px-3 border border-slate-200 hover:bg-slate-50 rounded-xl font-semibold text-slate-700 flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>学習履歴をCSVでバックアップ</span>
            </button>

            <button
              onClick={handleClearHistory}
              className="w-full py-2.5 px-3 border border-rose-200 hover:bg-rose-50 rounded-xl font-semibold text-rose-600 flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>学習履歴ログをクリア</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
