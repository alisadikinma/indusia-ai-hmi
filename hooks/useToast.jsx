'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((input) => {
    // Accept both string shorthand and object format
    const { title, description, variant = 'info' } = typeof input === 'string'
      ? { title: input, description: undefined, variant: 'info' }
      : input;
    const id = Date.now() + Math.random();

    setToasts((prev) => [
      ...prev,
      { id, title, description, variant },
    ]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  // Listen for custom notification events (from realtime subscriptions, etc.)
  useEffect(() => {
    const handleNotificationEvent = (event) => {
      const { title, description, variant } = event.detail || {};
      if (title || description) {
        showToast({ title, description, variant });
      }
    };

    window.addEventListener('indusia-notification', handleNotificationEvent);
    return () => {
      window.removeEventListener('indusia-notification', handleNotificationEvent);
    };
  }, [showToast]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[10000] flex flex-col gap-3 w-96">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  const getStyles = () => {
    switch (toast.variant) {
      case 'success':
        return 'bg-indusia-pass/10 border-indusia-pass';
      case 'error':
        return 'bg-indusia-fail/10 border-indusia-fail';
      case 'warning':
        return 'bg-indusia-warning/10 border-indusia-warning';
      case 'info':
      default:
        return 'bg-indusia-primary/10 border-indusia-primary';
    }
  };

  return (
    <div
      className={`
        rounded-lg border-l-4 bg-indusia-surface shadow-lg p-4
        animate-slide-down
        ${getStyles()}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {toast.title && (
            <p className="font-semibold text-sm text-indusia-text mb-1">
              {toast.title}
            </p>
          )}
          {toast.description && (
            <p className="text-sm text-indusia-textMuted">
              {toast.description}
            </p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="text-indusia-textMuted hover:text-indusia-text transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
