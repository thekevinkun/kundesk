"use client";

import { useState, useCallback, useRef } from "react";

interface UploadZoneProps {
  onFiles: (files: File[]) => void;
}

const UploadZone = ({ onFiles }: UploadZoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    // Must preventDefault to allow drop — without this, browser rejects the drop
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // If the mouse is still inside the zone (moving over a child element),
    // don't clear drag state — prevents flickering on the text/icon inside
    const currentTarget = e.currentTarget as HTMLElement;
    const relatedTarget = e.relatedTarget as Node | null;
    if (relatedTarget && currentTarget.contains(relatedTarget)) return;
    setIsDragging(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) onFiles(files);
      // Reset so the same file can be re-selected after removal
      e.target.value = "";
    },
    [onFiles],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload dokumen — klik atau drag dan drop file PDF, TXT, MD, atau DOCX"
      className={`mx-5 my-3 border-2 border-dashed rounded-[10px] p-5 text-center
        cursor-pointer transition-all duration-200 group
        ${
          isDragging
            ? "border-(--color-brand) bg-(--color-brand-light) scale-[1.01]"
            : "border-(--color-border) hover:border-(--color-brand) hover:bg-(--color-brand-light)/30"
        }`}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      {/* Icon — scales up when dragging */}
      <div
        className={`text-2xl mb-2 transition-transform duration-200
          ${isDragging ? "scale-125" : "group-hover:scale-110"}`}
      >
        {isDragging ? "📂" : "☁️"}
      </div>

      {/* Text — changes when dragging */}
      <p className="text-[13px] text-(--color-text-500)">
        {isDragging ? (
          <span className="text-(--color-brand) font-semibold">
            Lepaskan untuk upload
          </span>
        ) : (
          <>
            <span className="text-(--color-brand) font-semibold">
              Klik untuk upload
            </span>{" "}
            atau drag &amp; drop
          </>
        )}
      </p>
      <p className="text-[11px] text-(--color-text-400) mt-1">
        PDF, TXT, MD, DOCX — maks 10MB
      </p>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md,.docx,application/pdf,text/plain,text/markdown,text/x-markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        multiple
        className="hidden"
        onChange={handleChange}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
};

export default UploadZone;
