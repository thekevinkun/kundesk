const DataPill = ({ children }: { children: React.ReactNode }) => {
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium 
        bg-(--color-brand-light) text-(--color-brand-dark) mr-2 mb-2"
    >
      {children}
    </span>
  );
};

export default DataPill;
