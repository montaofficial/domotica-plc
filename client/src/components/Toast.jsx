import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

// Lightweight toast system. A module-level bridge lets non-React code (e.g. the
// React Query MutationCache) push toasts via `toast(...)`, while components use
// the `useToast()` hook.

let emit = null;
export function toast(message, type = 'info') {
  if (emit) emit({ message, type });
}

const ToastContext = createContext(() => {});
export function useToast() {
  return useContext(ToastContext);
}

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info
};
const STYLES = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  error: 'border-red-500/40 bg-red-500/10 text-red-200',
  info: 'border-dark-600 bg-dark-700 text-dark-100'
};

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(({ message, type = 'info', duration = 4000 }) => {
    if (!message) return;
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => remove(id), duration);
  }, [remove]);

  // Expose the imperative bridge for non-React callers.
  useEffect(() => {
    emit = push;
    return () => { emit = null; };
  }, [push]);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div
              key={t.id}
              role="status"
              className={`flex items-start gap-2 p-3 rounded-lg border shadow-lg backdrop-blur-sm text-sm ${STYLES[t.type] || STYLES.info}`}
            >
              <Icon className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="flex-1 break-words">{t.message}</span>
              <button onClick={() => remove(t.id)} className="shrink-0 opacity-60 hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
