import type { FC, ComponentType } from 'react';
import { Home, Zap, Repeat, BookMarked, BarChart3, MessagesSquare } from 'lucide-react';

export type TabType = 'home' | 'quick' | 'repeat' | 'conversation' | 'phrasebook' | 'stats';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  phraseCount?: number;
}

interface NavItem {
  id: TabType;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
}

export const BottomNav: FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  phraseCount = 0,
}) => {
  const navItems: NavItem[] = [
    { id: 'home', label: 'ホーム', icon: Home },
    { id: 'quick', label: '瞬間英作文', icon: Zap },
    { id: 'repeat', label: 'リピート', icon: Repeat },
    { id: 'conversation', label: '英会話', icon: MessagesSquare },
    { id: 'phrasebook', label: 'フレーズ帳', icon: BookMarked, badge: phraseCount > 0 ? phraseCount : undefined },
    { id: 'stats', label: '履歴・設定', icon: BarChart3 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg safe-bottom">
      <div className="max-w-md mx-auto px-1 flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id as TabType)}
              className={`flex-1 flex flex-col items-center justify-center py-1 transition-all relative ${
                isActive
                  ? 'text-blue-600 font-bold scale-105'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-6 h-6 transition-transform ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 leading-none tracking-tight">{item.label}</span>
              {isActive && (
                <span className="absolute bottom-1 w-6 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
