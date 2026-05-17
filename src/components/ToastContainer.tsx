import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { SHOW_TOAST_EVENT } from '../utils/toast';
import type { ToastEventDetail } from '../utils/toast';

interface ToastMessage extends ToastEventDetail {
  id: string;
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<ToastEventDetail>;
      const newToast: ToastMessage = {
        ...customEvent.detail,
        id: Date.now().toString() + Math.random().toString(),
      };

      setToasts(prev => [...prev, newToast]);

      // Auto dismiss after 4 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, 4000);
    };

    window.addEventListener(SHOW_TOAST_EVENT, handleToast);
    return () => window.removeEventListener(SHOW_TOAST_EVENT, handleToast);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div style={{
      position: 'absolute',
      top: '48px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: '90%',
      maxWidth: '360px',
      pointerEvents: 'none'
    }}>
      {toasts.map(toast => {
        let bgColor = 'var(--charcoal-deep)';
        let borderColor = 'var(--charcoal-border)';
        let Icon = Info;
        let iconColor = 'var(--accent-blue)';

        if (toast.type === 'success') {
          borderColor = 'var(--electric-mint)';
          Icon = CheckCircle2;
          iconColor = 'var(--electric-mint)';
        } else if (toast.type === 'error') {
          borderColor = 'var(--danger)';
          Icon = AlertCircle;
          iconColor = 'var(--danger)';
        }

        return (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: bgColor,
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: `1px solid ${borderColor}`,
              padding: '12px 16px',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              pointerEvents: 'auto',
              animation: 'slideDownFade 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Icon size={18} strokeWidth={2.5} style={{ color: iconColor, flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                {toast.message}
              </span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}

      <style>{`
        @keyframes slideDownFade {
          0% { opacity: 0; transform: translateY(-20px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};
