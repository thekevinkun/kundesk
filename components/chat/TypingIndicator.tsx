interface TypingIndicatorProps {
  accentColor: string;
}

const TypingIndicator = ({ accentColor }: TypingIndicatorProps) => {
  return (
    <div className="flex items-end gap-2 mb-4">
      {/* Bot avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1"
        style={{ background: accentColor }}
        aria-hidden="true"
      >
        AI
      </div>

      {/* Animated dots */}
      <div
        className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-bl-sm"
        style={{ background: "#f0f2f4" }}
        role="status"
        aria-label="Asisten sedang mengetik"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-[6px] h-[6px] rounded-full animate-bounce"
            style={{
              background: "#9ca3af",
              animationDelay: `${i * 0.15}s`,
              animationDuration: "0.8s",
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default TypingIndicator;
