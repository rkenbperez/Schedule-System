// components/shared/ToastContext.tsx
import { createContext } from 'react';
import type { ToastType } from './Toast';

export const ToastContext = createContext<{
  addToast: (toast: { type: ToastType; title: string; description?: string }) => void;
} | null>(null);
