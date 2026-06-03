interface TermsProhibitedCardProps {
  items: string[];
}

// Red-tinted card for prohibited actions in Syarat & Ketentuan
const TermsProhibitedCard = ({ items }: TermsProhibitedCardProps) => {
  return (
    <div className="card-base p-5 border-l-4 border-red-400 bg-red-50/50 mt-3">
      <ul className="list-none space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <span className="mt-1 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white bg-red-400">
              ✕
            </span>
            <span className="text-(--color-text-700)">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TermsProhibitedCard;
