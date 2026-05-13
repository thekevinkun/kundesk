"use client";

import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";

interface UploadingRowProps {
  filename: string;
  progress: number;
  error: string | null;
}

const UploadingRow = ({ filename, progress, error }: UploadingRowProps) => {
  const ext = filename.split(".").pop()?.toLowerCase();
  const isPdf = ext === "pdf";
  const isDocx = ext === "docx";

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-center gap-3 px-5 py-3.5 border-b border-(--color-border-sm) bg-(--color-brand-light)/40"
    >
      {/* File icon — same logic as DocumentRow, inlined to avoid prop drilling */}
      <div
        className={`w-10 h-10 rounded-[10px] flex items-center justify-center text-lg flex-shrink-0 ${
          isPdf
            ? "bg-(--color-danger-bg)"
            : isDocx
              ? "bg-(--color-warning-bg)"
              : "bg-(--color-info-bg)"
        }`}
      >
        {isPdf ? "📄" : isDocx ? "📘" : "📝"}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-(--color-text-900) truncate mb-1.5">
          {filename}
        </div>
        {error ? (
          // Error message replaces progress bar on failure
          <div className="text-[11.5px] text-(--color-danger)">{error}</div>
        ) : (
          <div className="flex items-center gap-2">
            <Progress value={progress} className="h-1.5 flex-1" />
            <span className="text-[11px] text-(--color-text-400) w-8 text-right tabular-nums">
              {progress}%
            </span>
          </div>
        )}
      </div>

      <span className={`badge-base ${error ? "badge-danger" : "badge-brand"}`}>
        {error ? "Gagal" : "Upload"}
      </span>
    </motion.div>
  );
};

export default UploadingRow;
