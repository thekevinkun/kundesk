interface RetentionCardProps {
  label: string;
  retention: string;
  note: string;
  highlight?: boolean;
}

const RetentionCard = ({
  label,
  retention,
  note,
  highlight,
}: RetentionCardProps) => {
  return (
    <div
      className={`card-base p-4 flex items-center justify-between gap-4 ${
        highlight ? "border-2 border-(--color-brand)" : ""
      }`}
    >
      <div>
        <p className="font-semibold text-(--color-text-900) text-sm">{label}</p>

        <p className="text-xs text-(--color-text-500) mt-0.5">{note}</p>
      </div>

      <span
        className={`px-3 py-1.5 rounded-full text-sm font-bold ${
          highlight
            ? "bg-(--color-brand-light) text-(--color-brand-dark)"
            : "bg-(--color-bg-page) text-(--color-text-700)"
        }`}
      >
        {retention}
      </span>
    </div>
  );
};

export default RetentionCard;
