interface PrivacySectionProps {
  number: string;
  title: string;
  children: React.ReactNode;
}

const PrivacySection = ({ number, title, children }: PrivacySectionProps) => {
  return (
    <section className="mb-12">
      <div className="flex items-baseline gap-4 mb-4">
        <span
          className="text-4xl font-black tabular-nums leading-none"
          style={{ color: "var(--color-brand)" }}
        >
          {number}
        </span>

        <h2 className="text-xl font-bold text-(--color-text-900)">{title}</h2>
      </div>

      <div className="pl-14 text-(--color-text-700) leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
};

export default PrivacySection;
