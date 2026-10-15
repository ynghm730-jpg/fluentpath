import { useEffect, type FC } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-11/12 max-w-md pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const bgStyle =
    toast.type === 'success'
      ? 'bg-emerald-600 text-white'
      : toast.type === 'error'
      ? 'bg-rose-600 text-white'
      : 'bg-blue-600 text-white';

  const Icon =
    toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? AlertCircle : Info;

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl shadow-lg transition-all animate-in fade-in slide-in-from-top duration-200 ${bgStyle}`}
    >
      <div className="flex items-center gap-2.5 text-sm font-medium">
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span>{toast.message}</span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 hover:bg-white/20 rounded-lg transition-colors ml-2"
        aria-label="閉じる"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
