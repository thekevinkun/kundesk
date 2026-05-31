import Image from "next/image";
import ReactMarkdown from "react-markdown";

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
}

const MessageBubble = ({
  role,
  content,
  isStreaming,
  accentColor,
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
        isHumanAgent ? (
          <span className="text-white mb-0.5" aria-hidden="true">👤</span>
        ) : (
          <Image
            src="/images/kun_logo.png"
            alt="KUN"
            width={22}
            height={22}
            className="object-contain brightness-85 mb-0.5"
            aria-hidden="true"
          />
        )
      )}

      {/* Bubble */}
      <div
        className={`max-w-[55%] px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "rounded-2xl rounded-br-sm text-white"
            : "rounded-2xl rounded-bl-sm text-gray-800"
        }`}
        style={{ background: isUser ? accentColor : "#f0f2f4" }}
        aria-label={`${isUser ? "Kamu" : isHumanAgent ? "Staff" : "KUN"}: ${content}`}
      >
        <div className="prose-bubble">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
        {isStreaming && <StreamingCursor />}
      </div>
    </div>
  );
};

export default MessageBubble;
