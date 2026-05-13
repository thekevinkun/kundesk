// Animated cursor shown at the end of a streaming assistant message
const StreamingCursor = () => (
  <span
    aria-hidden="true"
    className="inline-block w-[2px] h-[1em] ml-[2px] align-middle animate-pulse"
    style={{ background: "currentColor", opacity: 0.6 }}
  />
);

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean | undefined;
  accentColor: string;
  botName: string;
}

const MessageBubble = ({
  role,
  content,
  isStreaming,
  accentColor,
  botName,
}: MessageBubbleProps) => {
  const isUser = role === "user";

  return (
    <div
      className={`flex items-end gap-2 mb-4 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Bot avatar — only shown for assistant messages */}
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1"
          style={{ background: accentColor }}
          aria-hidden="true"
        >
          AI
        </div>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[75%] px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "rounded-2xl rounded-br-sm text-white"
            : "rounded-2xl rounded-bl-sm text-gray-800"
        }`}
        style={{ background: isUser ? accentColor : "#f0f2f4" }}
        aria-label={`${isUser ? "Kamu" : botName}: ${content}`}
      >
        {/* Preserve line breaks from AI response */}
        {content.split("\n").map((line, i, arr) => (
          <span key={i}>
            {line}
            {i < arr.length - 1 && <br />}
          </span>
        ))}
        {/* Streaming cursor — only on the last assistant message while streaming */}
        {isStreaming && <StreamingCursor />}
      </div>
    </div>
  );
};

export default MessageBubble;
