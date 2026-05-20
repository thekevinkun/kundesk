const TenantPreview = () => {
  return (
    <div className="bg-[#1e1e1e] border border-[#333] rounded-xl p-4 mb-6 min-h-[148px]">
      <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#555] mb-3">
        🏢 Tenant Workspace
      </div>
      {[
        {
          emoji: "🍜",
          bg: "linear-gradient(135deg,#069494,#0891b2)",
          name: "Kedai Bu Sari",
          badge: "Pro",
          badgeColor: "#069494",
          badgeBg: "rgba(6,148,148,0.15)",
        },
        {
          emoji: "🏥",
          bg: "linear-gradient(135deg,#f59e0b,#d97706)",
          name: "Klinik Sehat Mandiri",
          badge: "Starter",
          badgeColor: "#fbbf24",
          badgeBg: "rgba(251,191,36,0.15)",
        },
        {
          emoji: "🏡",
          bg: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
          name: "Properti Borneo",
          badge: "Pro",
          badgeColor: "#069494",
          badgeBg: "rgba(6,148,148,0.15)",
        },
      ].map(({ emoji, bg, name, badge, badgeColor, badgeBg }) => (
        <div
          key={name}
          className="flex items-center gap-2.5 bg-[#242424] rounded-lg px-3 py-2 mb-1.5 last:mb-0"
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] flex-shrink-0"
            style={{ background: bg }}
          >
            {emoji}
          </div>
          <span className="text-[12px] text-[#ccc] font-medium flex-1 truncate">
            {name}
          </span>
          <span
            className="text-[9.5px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ color: badgeColor, background: badgeBg }}
          >
            {badge}
          </span>
        </div>
      ))}
    </div>
  );
};

export default TenantPreview;
