"use client";

import { useEffect, useState } from "react";

interface ChatHeaderProps {
  name: string;
  orgName: string;
  accentColor: string;
}

const ChatHeader = ({ name, orgName, accentColor }: ChatHeaderProps) => {
  // Detect iframe AFTER mount — avoids SSR/client hydration mismatch
  // Server always renders the header; client hides it post-mount if embedded
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    // window.self !== window.top means we're inside an iframe
    setIsEmbedded(window.self !== window.top);
  }, []);

  // Hidden when embedded — widget provides its own header
  if (isEmbedded) return null;

  return (
    <header
      className="flex items-center gap-3 px-4 py-3 shadow-sm flex-shrink-0"
      style={{ background: accentColor }}
    >
      {/* Bot avatar — first letter of bot name */}
      <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        {name.charAt(0).toUpperCase()}
      </div>

      <div>
        <h1 className="text-white text-sm font-semibold leading-tight">
          {name}
        </h1>
        <p className="text-white/75 text-xs">{orgName}</p>
      </div>

      {/* Live indicator */}
      <div className="ml-auto flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full bg-white animate-pulse"
          aria-hidden="true"
        />
        <span className="text-white/80 text-xs">Online</span>
      </div>
    </header>
  );
};

export default ChatHeader;
