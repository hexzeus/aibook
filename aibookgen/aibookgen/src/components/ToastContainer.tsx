import { createPortal } from 'react-dom';
import Toast, { ToastType } from './Toast';
import { useToastStore } from '../store/toastStore';

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return createPortal(
    <div className="fixed top-4 right-4 z-[9999] pointer-events-none">
      <div className="pointer-events-auto">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.message}
            duration={toast.duration}
            onClose={removeToast}
          />
        ))}
      </div>
    </div>,
    document.body
  );
}
