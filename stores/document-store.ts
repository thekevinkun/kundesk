// Zustand store for in-flight upload progress state
// Only tracks files currently being uploaded — not the full documents list
// The documents list (server state) is handled by TanStack Query

import { create } from "zustand";

// Represents a single file currently being uploaded
export interface UploadingFile {
  id: string; // local UUID — not the DB documentId yet
  filename: string; // display name shown in the UI
  progress: number; // 0–100 upload percentage
  error: string | null; // set if upload fails
}

interface DocumentStore {
  // Map of id → UploadingFile — keyed for O(1) updates
  uploadingFiles: Map<string, UploadingFile>;

  // Adds a new file to the uploading map when upload starts
  addUploadingFile: (id: string, filename: string) => void;

  // Updates the progress of an in-flight upload (0–100)
  setUploadProgress: (id: string, progress: number) => void;

  // Marks an upload as failed with an error message
  setUploadError: (id: string, error: string) => void;

  // Removes a file from the map — called on success or after error is shown
  removeUploadingFile: (id: string) => void;
}

export const useDocumentStore = create<DocumentStore>((set) => ({
  uploadingFiles: new Map(),

  addUploadingFile: (id, filename) =>
    set((state) => {
      // Create a new Map to trigger React re-render — Maps are reference types
      const next = new Map(state.uploadingFiles);
      next.set(id, { id, filename, progress: 0, error: null });
      return { uploadingFiles: next };
    }),

  setUploadProgress: (id, progress) =>
    set((state) => {
      const next = new Map(state.uploadingFiles);
      const file = next.get(id);
      // Guard — file may have been removed before progress event fires
      if (!file) return state;
      next.set(id, { ...file, progress });
      return { uploadingFiles: next };
    }),

  setUploadError: (id, error) =>
    set((state) => {
      const next = new Map(state.uploadingFiles);
      const file = next.get(id);
      if (!file) return state;
      next.set(id, { ...file, error, progress: 0 });
      return { uploadingFiles: next };
    }),

  removeUploadingFile: (id) =>
    set((state) => {
      const next = new Map(state.uploadingFiles);
      next.delete(id);
      return { uploadingFiles: next };
    }),
}));
