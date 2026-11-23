// Shapes returned by the document preview routes

export type ChunksPage = {
  chunks: { id: number; content: string }[];
  page: number;
  hasMore: boolean;
};

// available=false means the original file is gone (old AWS uploads) or mock mode
export type FileLinkData =
  | { available: false }
  | { available: true; url: string };
