// API request/response types and Server Action return types
// All Server Actions return ActionResult<T> — never throw to the client

// Standard Server Action return type — success carries data, error carries message
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// Standard API route response envelope
export type ApiResponse<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

// Pagination params — reused across list endpoints
export interface PaginationParams {
  page: number;
  limit: number;
  cursor?: string;
}

// Paginated response wrapper
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}
