interface RefundStatusCardProps {
  title: string;
  items: string[];
  // "eligible" = green, "ineligible" = red
  variant: "eligible" | "ineligible";
}

// Two-variant card for refund conditions — green for eligible, red for not
const RefundStatusCard = ({ title, items, variant }: RefundStatusCardProps) => {
  const isEligible = variant === "eligible";

  return (
    <div
      className={`card-base p-5 border-l-4 ${
        isEligible
          ? "border-emerald-400 bg-emerald-50/50"
          : "border-red-400 bg-red-50/50"
      }`}
    >
      <p
        className={`font-bold text-sm mb-3 ${
          isEligible ? "text-emerald-700" : "text-red-600"
        }`}
      >
        {isEligible ? "✓" : "✕"} {title}
      </p>

      <ul className="list-none space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <span
              className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                isEligible ? "bg-emerald-400" : "bg-red-400"
              }`}
            >
              {isEligible ? "✓" : "✕"}
            </span>
            <span className="text-(--color-text-700) text-sm">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RefundStatusCard;
