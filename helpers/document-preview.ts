// Decides how the original file can be shown in the preview dialog
export type PreviewKind = "pdf" | "other";

// Only PDFs display inside the dialog; TXT, MD and DOCX get a download button
export function getPreviewKind(filename: string): PreviewKind {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "other";
  return filename.slice(dot + 1).toLowerCase() === "pdf" ? "pdf" : "other";
}
