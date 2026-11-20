// components/shared/ToastProvider.tsx
import { useState, type ReactNode } from 'react';
import { ToastItem, type ToastType } from './Toast';
import { ToastContext } from './ToastContext';

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: ToastType;
    title: string;
    description?: string;
  }>>([]);

  const addToast = (toast: { type: ToastType; title: string; description?: string }) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className='fixed top-4 right-4 z-[100] pointer-events-none'>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            id={toast.id}
            type={toast.type}
            title={toast.title}
            description={toast.description}
            onDismiss={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
