interface ServiceCardProps {
  name: string;
  role: string;
  country: string;
}

const ServiceCard = ({ name, role, country }: ServiceCardProps) => {
  return (
    <div className="card-base p-4 flex items-center justify-between gap-4">
      <div>
        <p className="font-semibold text-(--color-text-900) text-sm">{name}</p>

        <p className="text-xs text-(--color-text-500) mt-0.5">{role}</p>
      </div>

      <span className="text-xs text-(--color-text-400)">{country}</span>
    </div>
  );
};

export default ServiceCard;
