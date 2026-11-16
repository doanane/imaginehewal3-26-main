import React, { createContext, useContext, useState, ReactNode } from 'react';
import { View } from 'react-native';
import Toast from '../components/Toast';

interface Toast {
  id: number;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
}

interface ToastContextType {
  showToast: (message: string | { message: string; type?: string; duration?: number }, type?: 'success' | 'error' | 'info' | 'warning') => void;
  toasts: Toast[];
  removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [toastId, setToastId] = useState(0);

  const showToast = (input: string | { message: string; type?: string; duration?: number }, kind: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const message = typeof input === 'string' ? input : input.message;
    const t = (typeof input === 'string' ? kind : (input.type as any) || kind) as 'success' | 'error' | 'info' | 'warning';
    const duration = typeof input === 'string' ? 3000 : input.duration ?? 3000;
    const id = toastId + 1;
    setToastId(id);
    
    setToasts(prev => [...prev, { id, message, type: t }]);
    
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast, toasts, removeToast }}>
      {children}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 60, left: 0, right: 0, zIndex: 9999, elevation: 9999 }}>
        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} visible onClose={() => removeToast(t.id)} />)}
      </View>
    </ToastContext.Provider>
  );
};