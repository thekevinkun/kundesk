"use client";

import Link from "next/link";

interface LockedFeatureOverlayProps {
  message?: string;
}

// Sits absolutely over a blurred/placeholder card body. Card headers (title +
// subtitle) render outside this component's reach — always visible regardless
// of plan — only the data underneath gets obscured.
const LockedFeatureOverlay = ({ message }: LockedFeatureOverlayProps) => {
  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 
        rounded-[10px] bg-(--color-bg-card)/60 backdrop-blur-[1px] text-center px-4"
    >
      <span className="text-[22px]" aria-hidden="true">
        🔒
      </span>
      <p className="text-[12.5px] font-semibold text-(--color-text-700)">
        {message ?? "Fitur ini tersedia di plan Starter & Pro"}
      </p>
      <Link
        href="/dashboard/billing"
        className="text-[11.5px] font-bold text-white bg-(--color-brand) px-4 py-1.5 rounded-full 
            hover:bg-(--color-brand-dark) transition-colors"
      >
        Lihat Plan
      </Link>
    </div>
  );
};

export default LockedFeatureOverlay;
