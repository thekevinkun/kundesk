// Skeleton shown while billing data loads — matches BillingPage layout
export default function BillingLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="skeleton h-7 w-32 rounded-(--radius-sm)" />
        <div className="skeleton h-4 w-64 rounded-(--radius-sm)" />
      </div>

      {/* Current plan card skeleton */}
      <div className="card-base p-6 space-y-4">
        <div className="skeleton h-5 w-28 rounded-(--radius-sm)" />
        <div className="flex items-center gap-4">
          <div className="skeleton h-14 w-14 rounded-(--radius-md)" />
          <div className="space-y-2">
            <div className="skeleton h-7 w-24 rounded-(--radius-sm)" />
            <div className="skeleton h-4 w-40 rounded-(--radius-sm)" />
          </div>
        </div>
        <div className="skeleton h-2 w-full rounded-(--radius-full)" />
      </div>

      {/* Plan cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card-base p-6 space-y-4">
            <div className="skeleton h-5 w-20 rounded-(--radius-sm)" />
            <div className="skeleton h-8 w-28 rounded-(--radius-sm)" />
            <div className="skeleton h-10 w-full rounded-(--radius-full)" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((j) => (
                <div
                  key={j}
                  className="skeleton h-4 w-full rounded-(--radius-sm)"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
