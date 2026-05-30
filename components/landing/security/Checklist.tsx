interface ChecklistProps {
  items: string[];
}

const Checklist = ({ items }: ChecklistProps) => {
  return (
    <ul className="list-none space-y-2 mt-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <span
            className="mt-1 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: "var(--color-brand)" }}
          >
            ✓
          </span>

          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
};

export default Checklist;
