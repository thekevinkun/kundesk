interface RefundMethodCardProps {
  method: string;
  timeline: string;
  note: string;
}

// Shows payment method, refund timeline, and note in a clean row card
const RefundMethodCard = ({
  method,
  timeline,
  note,
}: RefundMethodCardProps) => {
  return (
    <div className="card-base p-4 flex items-center justify-between gap-4">
      <div>
        <p className="font-semibold text-(--color-text-900) text-sm">
          {method}
        </p>
        <p className="text-xs text-(--color-text-500) mt-0.5">{note}</p>
      </div>

      <span
        className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full"
        style={{
          background: "var(--color-brand-light)",
          color: "var(--color-brand-dark)",
        }}
      >
        {timeline}
      </span>
    </div>
  );
};

export default RefundMethodCard;
