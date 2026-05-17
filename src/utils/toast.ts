export type ToastType = 'success' | 'error' | 'info';

export interface ToastEventDetail {
  message: string;
  type: ToastType;
}

export const SHOW_TOAST_EVENT = 'onz-show-toast';

export const toast = (message: string, type: ToastType = 'info') => {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent<ToastEventDetail>(SHOW_TOAST_EVENT, {
      detail: { message, type },
    });
    window.dispatchEvent(event);
    
  }
};
