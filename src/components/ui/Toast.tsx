import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}
interface ToastValue {
  show: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (message: string, tone: Tone = 'info') => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-2), { id, message, tone }]);
      setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
        aria-live="polite"
        role="status"
      >
        {items.map((item) => {
          const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? AlertCircle : Info;
          const tone =
            item.tone === 'success'
              ? 'text-success'
              : item.tone === 'error'
                ? 'text-danger'
                : 'text-info';
          return (
            <div
              key={item.id}
              className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm shadow-card"
            >
              <Icon className={`mt-0.5 size-5 shrink-0 ${tone}`} aria-hidden />
              <p className="flex-1">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-lg p-0.5 text-muted hover:text-ink"
                aria-label="Lukk"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
