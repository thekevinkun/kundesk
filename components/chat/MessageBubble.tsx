// Animated cursor shown at the end of a streaming assistant message
const StreamingCursor = () => (
  <span
    aria-hidden="true"
    className="inline-block w-[2px] h-[1em] ml-[2px] align-middle animate-pulse"
    style={{ background: "currentColor", opacity: 0.6 }}
  />
);

interface MessageBubbleProps {
  role: "user" | "assistant" | "human_agent";
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
  // human_agent renders on the left like assistant but with a different avatar
  const isHumanAgent = role === "human_agent";

  return (
    <div
      className={`flex items-end gap-2 mb-4 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar — AI bot or human staff, only for non-user messages */}
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1"
          style={{ background: isHumanAgent ? "#6b7280" : accentColor }}
          aria-hidden="true"
        >
          {isHumanAgent ? "👤" : "AI"}
        </div>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[55%] px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "rounded-2xl rounded-br-sm text-white"
            : "rounded-2xl rounded-bl-sm text-gray-800"
        }`}
        style={{ background: isUser ? accentColor : "#f0f2f4" }}
        aria-label={`${isUser ? "Kamu" : isHumanAgent ? "Staff" : botName}: ${content}`}
      >
        {content.split("\n").map((line, i, arr) => (
          <span key={i}>
            {line}
            {i < arr.length - 1 && <br />}
          </span>
        ))}
        {isStreaming && <StreamingCursor />}
      </div>
    </div>
  );
};

export default MessageBubble;
