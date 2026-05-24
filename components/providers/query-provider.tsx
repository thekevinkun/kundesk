// TanStack Query client provider — wraps the dashboard layout
// Must be a Client Component — QueryClient lives in the browser, not the server

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // useState ensures each browser session gets its own QueryClient
  // Never create QueryClient outside useState — causes shared state between requests
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Keep data fresh for 30 seconds before refetching in background
            staleTime: 60 * 1000,
            // Retry failed queries once before showing error
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
