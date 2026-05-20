import type { ReactNode } from "react";

interface MarketingLayoutProps {
  children: ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="min-h-screen bg-white text-(--color-text-900) antialiased">
      {children}
    </div>
  );
}
