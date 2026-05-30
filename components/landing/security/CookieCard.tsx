interface CookieCardProps {
  name: string;
  purpose: string;
}

const CookieCard = ({ name, purpose }: CookieCardProps) => {
  return (
    <div className="card-base p-4">
      <p className="font-semibold text-(--color-text-900) text-sm">{name}</p>

      <p className="text-xs text-(--color-text-500) mt-1">{purpose}</p>
    </div>
  );
};

export default CookieCard;
