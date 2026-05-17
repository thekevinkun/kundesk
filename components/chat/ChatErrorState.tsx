// Error states for the chat UI
// Two variants: quota_exceeded (intentional block) and generic (dismissible banner)

interface QuotaExceededProps {
  error: string;
  accentColor: string;
}

// Quota exceeded — shown as a centered block, not a red banner
// Feels intentional rather than broken — business limit, not a crash
export const QuotaExceededState = ({
  error,
  accentColor,
}: QuotaExceededProps) => {
  return (
    <div
      className="flex flex-col items-center text-center px-6 py-8 mb-4"
      role="status"
      aria-live="polite"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4"
        style={{ background: `${accentColor}18` }}
        aria-hidden="true"
      >
        🔒
      </div>
      <p className="text-gray-800 font-semibold text-sm mb-1">
        Batas pesan telah tercapai
      </p>
      <p className="text-gray-500 text-xs leading-relaxed max-w-[240px]">
        {error}
      </p>
    </div>
  );
};

interface GenericErrorProps {
  error: string;
  onDismiss: () => void;
}

// Generic error banner — rate limit, network issues, server errors
// Dismissible so the customer can try again
export const GenericErrorBanner = ({ error, onDismiss }: GenericErrorProps) => {
  return (
    <div
      className="flex items-center gap-2 px-4 py-3 mb-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm"
      role="alert"
    >
      <span aria-hidden="true">⚠️</span>
      <span className="flex-1">{error}</span>
      <button
        onClick={onDismiss}
        className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
        aria-label="Tutup pesan error"
      >
        ✕
      </button>
    </div>
  );
};

// Pending handoff — shown while customer waits for staff to take over
// Not an error — reassuring, not alarming
interface PendingHandoffProps {
  accentColor: string;
}

export const PendingHandoffState = ({ accentColor }: PendingHandoffProps) => {
  return (
    <div
      className="flex flex-col items-center text-center px-6 py-6 mb-4"
      role="status"
      aria-live="polite"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4 animate-pulse"
        style={{ background: `${accentColor}18` }}
        aria-hidden="true"
      >
        👤
      </div>
      <p className="text-gray-800 font-semibold text-sm mb-1">
        Menunggu staff kami
      </p>
      <p className="text-gray-500 text-xs leading-relaxed max-w-[240px]">
        Permintaanmu sudah diterima. Staff akan segera membalas pesanmu di sini.
      </p>
    </div>
  );
};
