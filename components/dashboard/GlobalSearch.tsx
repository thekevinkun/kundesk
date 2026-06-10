"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getConversationPageAction } from "@/lib/actions/dashboard";
import { dropdownVariants } from "@/lib/animations";
import { formatRelativeTime } from "@/helpers/format";
import { cn } from "@/lib/utils";

interface ConversationResult {
  conversationId: number;
  sessionId: string;
  preview: string;
  handoffStatus: string;
  createdAt: string;
}

interface DocumentResult {
  id: number;
  name: string;
  status: string;
  chunkCount: number;
}

interface SearchResults {
  conversations: ConversationResult[];
  documents: DocumentResult[];
}

interface GlobalSearchProps {
  compactMode?: boolean;
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

const GlobalSearch = ({
  compactMode = false,
  isExpanded = false,
  onExpandedChange,
}: GlobalSearchProps) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Debounce timer ref — cleared on each keystroke
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const collapseCompactSearch = useCallback(() => {
    if (compactMode) {
      onExpandedChange?.(false);
    }
  }, [compactMode, onExpandedChange]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults(null);
    setIsOpen(false);
    collapseCompactSearch();
    inputRef.current?.blur();
  }, [collapseCompactSearch]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as {
        ok: boolean;
        data: SearchResults;
      };
      if (json.ok) {
        setResults(json.data);
        setIsOpen(true);
      }
    } catch {
      // Non-critical — search just shows nothing
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounce — wait 300ms after last keystroke before hitting API
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (compactMode && val.length > 0) {
      onExpandedChange?.(true);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void search(val), 300);
  };

  // Close on Escape
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (compactMode && query.length > 0) {
        return;
      }
      setIsOpen(false);
      setQuery("");
      collapseCompactSearch();
      inputRef.current?.blur();
    }
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (compactMode && query.length > 0) {
        return;
      }
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
        collapseCompactSearch();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [collapseCompactSearch, compactMode, query.length]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handleNativeSearch = () => {
      if (compactMode && input.value === "") {
        clearSearch();
      }
    };

    input.addEventListener("search", handleNativeSearch);
    return () => input.removeEventListener("search", handleNativeSearch);
  }, [clearSearch, compactMode]);

  const handleConversationClick = async (conversationId: number) => {
    setIsOpen(false);
    setQuery("");
    collapseCompactSearch();

    // Find which page this conversation is on — prevents highlight landing on wrong page
    try {
      const page = await getConversationPageAction(conversationId);
      router.push(
        `/dashboard/conversations?page=${page}&highlight=${conversationId}`,
      );
    } catch {
      router.push(`/dashboard/conversations?highlight=${conversationId}`);
    }
  };

  const handleDocumentClick = () => {
    setIsOpen(false);
    setQuery("");
    collapseCompactSearch();
    router.push("/dashboard/documents");
  };

  const hasResults =
    results &&
    (results.conversations.length > 0 || results.documents.length > 0);

  const isEmpty =
    results &&
    results.conversations.length === 0 &&
    results.documents.length === 0;

  return (
    <motion.div
      layout
      className={cn(
        "relative min-w-0 flex-1",
        compactMode
          ? isExpanded
            ? "max-w-none"
            : "max-w-[180px]"
          : "max-w-[400px]",
      )}
    >
      {/* Search input */}
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-400) text-sm pointer-events-none">
        {isLoading ? "⏳" : "🔍"}
      </span>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (compactMode && query.length === 0) {
            collapseCompactSearch();
          }
        }}
        onFocus={() => {
          if (compactMode) onExpandedChange?.(true);
          // Reopen panel if there are existing results
          if (results && query.length >= 2) setIsOpen(true);
        }}
        placeholder="Cari percakapan, dokumen..."
        className={cn(
          "w-full bg-(--color-bg-page) border border-(--color-border) rounded-full py-1.5 pl-9 pr-4 text-[16px]! text-(--color-text-700) placeholder:text-(--color-text-400) outline-none focus:border-(--color-brand) focus:bg-(--color-bg-card) focus:ring-2 focus:ring-(--color-brand-light) transition-all",
        )}
        aria-label="Cari percakapan dan dokumen"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        role="combobox"
        aria-autocomplete="list"
      />

      {/* Results dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute top-[calc(100%+8px)] left-0 right-0 bg-(--color-bg-card) border border-(--color-border) rounded-[14px] shadow-lg z-50 overflow-hidden"
            role="listbox"
          >
            {/* Empty state */}
            {isEmpty && (
              <div className="py-8 text-center">
                <div className="text-2xl mb-2">🔍</div>
                <div className="text-[13px] text-(--color-text-500)">
                  Tidak ada hasil untuk &ldquo;{query}&rdquo;
                </div>
              </div>
            )}

            {hasResults && (
              <>
                {/* Conversations section */}
                {results.conversations.length > 0 && (
                  <div>
                    <div className="px-4 pt-3 pb-1.5 text-[10.5px] font-bold tracking-[0.08em] uppercase text-(--color-text-400)">
                      Percakapan
                    </div>
                    {results.conversations.map((item) => (
                      <button
                        key={item.conversationId}
                        onClick={() =>
                          handleConversationClick(item.conversationId)
                        }
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-(--color-bg-page) transition-colors text-left"
                        role="option"
                      >
                        <span className="text-base mt-0.5 flex-shrink-0">
                          💬
                        </span>
                        <div className="flex-1 min-w-0">
                          {/* Message preview with query highlighted */}
                          <div className="text-[13px] text-(--color-text-700) truncate">
                            {item.preview}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-(--color-text-400) font-mono">
                              #{item.sessionId.slice(0, 8)}
                            </span>
                            <span className="text-[11px] text-(--color-text-400)">
                              · {formatRelativeTime(new Date(item.createdAt))}
                            </span>
                          </div>
                        </div>
                        {/* Handoff status pill */}
                        <span
                          className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${
                            item.handoffStatus === "human"
                              ? "bg-(--color-warning-bg) text-(--color-warning)"
                              : item.handoffStatus === "pending_handoff"
                                ? "bg-(--color-danger-bg) text-(--color-danger)"
                                : "bg-(--color-success-bg) text-(--color-success)"
                          }`}
                        >
                          {item.handoffStatus === "human"
                            ? "Manual"
                            : item.handoffStatus === "pending_handoff"
                              ? "Pending"
                              : "AI"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Divider between sections */}
                {results.conversations.length > 0 &&
                  results.documents.length > 0 && (
                    <div className="border-t border-(--color-border-sm) mx-4" />
                  )}

                {/* Documents section */}
                {results.documents.length > 0 && (
                  <div>
                    <div className="px-4 pt-3 pb-1.5 text-[10.5px] font-bold tracking-[0.08em] uppercase text-(--color-text-400)">
                      Dokumen
                    </div>
                    {results.documents.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={handleDocumentClick}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-(--color-bg-page) transition-colors text-left"
                        role="option"
                      >
                        <span className="text-base flex-shrink-0">
                          {doc.name.endsWith(".pdf") ? "📄" : "📝"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-(--color-text-700) truncate font-medium">
                            {doc.name}
                          </div>
                          <div className="text-[11px] text-(--color-text-400) mt-0.5">
                            {doc.status === "ready"
                              ? `${doc.chunkCount} chunks`
                              : doc.status === "processing"
                                ? "Memproses..."
                                : "Gagal"}
                          </div>
                        </div>
                        <span
                          className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                            doc.status === "ready"
                              ? "bg-(--color-success-bg) text-(--color-success)"
                              : doc.status === "processing"
                                ? "bg-(--color-warning-bg) text-(--color-warning)"
                                : "bg-(--color-danger-bg) text-(--color-danger)"
                          }`}
                        >
                          {doc.status === "ready"
                            ? "Ready"
                            : doc.status === "processing"
                              ? "Proses"
                              : "Gagal"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Footer hint */}
                <div className="px-4 py-2.5 border-t border-(--color-border-sm) flex items-center gap-1">
                  <span className="text-[10.5px] text-(--color-text-400)">
                    Tekan
                  </span>
                  <kbd className="text-[10px] font-mono bg-(--color-bg-page) border border-(--color-border) px-1.5 py-0.5 rounded-[4px] text-(--color-text-500)">
                    Esc
                  </kbd>
                  <span className="text-[10.5px] text-(--color-text-400)">
                    untuk menutup
                  </span>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default GlobalSearch;
