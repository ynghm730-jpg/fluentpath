import { useState, useEffect, type FC } from 'react';
import { Compass, Flame, Volume2, Download } from 'lucide-react';
import { speakText } from '../services/speech';
import { promptPwaInstall, isPwaInstallable } from '../registerSW';

interface HeaderProps {
  streakDays: number;
  todayCount: number;
}

export const Header: FC<HeaderProps> = ({ streakDays, todayCount }) => {
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handleInstallable = () => setCanInstall(true);
    window.addEventListener('pwa-installable', handleInstallable);
    if (isPwaInstallable()) setCanInstall(true);

    return () => {
      window.removeEventListener('pwa-installable', handleInstallable);
    };
  }, []);

  const handleInstallClick = async () => {
    const installed = await promptPwaInstall();
    if (installed) setCanInstall(false);
  };

  const handleTestAudio = () => {
    speakText('Welcome to FluentPath. Ready to speak today?');
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/30">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">FluentPath</h1>
            <p className="text-[10px] text-slate-500 leading-none">Instant Speaking Coach</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* PWAインストールボタン（インストール可能な場合に表示） */}
          {canInstall && (
            <button
              onClick={handleInstallClick}
              className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-all animate-pulse"
              title="ホーム画面にアプリを追加"
              aria-label="アプリをインストール"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">追加</span>
            </button>
          )}

          {/* 音声テストボタン */}
          <button
            onClick={handleTestAudio}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="音声読み上げのテスト"
            aria-label="音声テスト"
          >
            <Volume2 className="w-4 h-4" />
          </button>

          {/* ストリーク（連続日数） */}
          <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-xs font-semibold border border-amber-200/60">
            <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>{streakDays}日連続</span>
          </div>

          {/* 今日の学習問数 */}
          <div className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-semibold border border-blue-200/60">
            今日: {todayCount}問
          </div>
        </div>
      </div>
    </header>
  );
};
