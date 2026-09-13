// Shown in place of a full dashboard page when org:member hits an admin-only route.
// Same URL, no redirect — renders calmly instead of the page, with a way back.
// Not a security boundary by itself — the real enforcement is the caller checking
// orgRole before deciding to render this vs. the real page (see each page.tsx).

import Link from "next/link";

interface AccessRestrictedProps {
  // Optional — lets each page customize what feature is being gated,
  // falls back to a generic message if omitted
  featureName?: string;
}

const AccessRestricted = ({ featureName }: AccessRestrictedProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-4xl mb-4">🔒</div>
      <h1 className="text-[18px] font-bold text-(--color-text-900) mb-1.5">
        Akses Terbatas
      </h1>
      <p className="text-[13px] text-(--color-text-500) max-w-md leading-relaxed">
        {featureName
          ? `Hanya admin yang dapat mengakses ${featureName}.`
          : "Hanya admin yang dapat mengakses halaman ini."}{" "}
      </p>
      <p className="text-[13px] text-(--color-text-500) max-w-md leading-relaxed">
        Hubungi admin organisasi kamu jika kamu memerlukan akses.
      </p>
      <Link
        href="/dashboard"
        className="inline-block mt-5 px-5 py-2.5 bg-(--color-brand) text-white text-[13px] font-semibold rounded-[10px] hover:bg-(--color-brand-dark) transition-colors"
      >
        Kembali ke Dashboard
      </Link>
    </div>
  );
};

export default AccessRestricted;
