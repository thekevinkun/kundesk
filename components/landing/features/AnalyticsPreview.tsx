const AnalyticsPreview = () => {
  return (
    <div className="bg-[#1e1e1e] border border-[#333] rounded-xl p-4 max-lg:mb-6 max-lg:min-h-[148px]">
      {/* Top stats row */}
      <div className="flex justify-between mb-3">
        <div>
          <div className="text-[12px] text-[#9aa0a6] mb-0.5">
            Pesan Bulan Ini
          </div>
          <div className="text-[18px] font-extrabold text-white tracking-[-0.03em]">
            3,847
          </div>
        </div>
        <div>
          <div className="text-[12px] text-[#9aa0a6] mb-0.5">Terjawab Auto</div>
          <div className="text-[18px] text-(--color-brand) font-extrabold tracking-[-0.03em]">
            97.3%
          </div>
        </div>
        <div>
          <div className="text-[12px] text-[#9aa0a6] mb-0.5">Avg. Respons</div>
          <div className="text-[18px] font-extrabold text-white tracking-[-0.03em]">
            1.2s
          </div>
        </div>
      </div>

      {/* Sparkline with pulsing endpoint */}
      <div className="relative h-16 w-full overflow-visible mb-3">
        <svg
          viewBox="0 0 260 48"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="feat-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#069494" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#069494" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Area fill */}
          <path
            d="M0,38 C30,34 50,28 80,24 C110,20 130,30 160,20 C190,10 220,14 260,6 L260,48 L0,48 Z"
            fill="url(#feat-grad)"
          />
          {/* Line */}
          <path
            d="M0,38 C30,34 50,28 80,24 C110,20 130,30 160,20 C190,10 220,14 260,6"
            fill="none"
            stroke="#069494"
            strokeWidth="1.8"
          />
        </svg>

        {/* Pulsing dot at line endpoint — positioned at x=100% y≈6/48=12.5% of container */}
        <div
          className="absolute"
          style={{
            right: "0%",
            top: "12.5%",
            transform: "translate(50%, -50%)",
          }}
        >
          {/* Outer ripple 1 */}
          <span
            className="absolute rounded-full"
            style={{
              width: 20,
              height: 20,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(6,148,148,0.15)",
              animation: "ping-slow 2s cubic-bezier(0,0,0.2,1) infinite",
            }}
          />
          {/* Outer ripple 2 — offset delay */}
          <span
            className="absolute rounded-full"
            style={{
              width: 14,
              height: 14,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(6,148,148,0.25)",
              animation: "ping-slow 2s cubic-bezier(0,0,0.2,1) infinite 0.4s",
            }}
          />
          {/* Inner solid dot */}
          <span
            className="relative block rounded-full"
            style={{
              width: 8,
              height: 8,
              background: "var(--color-brand)",
              boxShadow: "0 0 8px rgba(6,148,148,0.8)",
            }}
          />
        </div>
      </div>

      {/* Bottom stat pills */}
      <div className="flex gap-2">
        <div className="flex-1 bg-[#242424] rounded-lg px-3 py-2">
          <div className="text-[10px] text-[#555] mb-0.5">Pelanggan Unik</div>
          <div className="text-[13px] font-bold text-white">621</div>
        </div>
        <div className="flex-1 bg-[#242424] rounded-lg px-3 py-2">
          <div className="text-[10px] text-[#555] mb-0.5">Jam Sibuk</div>
          <div className="text-[13px] font-bold text-white">19.00–21.00</div>
        </div>
        <div className="flex-1 bg-[#242424] rounded-lg px-3 py-2">
          <div className="text-[10px] text-[#555] mb-0.5">Pertumbuhan</div>
          <div className="text-[13px] font-bold" style={{ color: "#069494" }}>
            +12%
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPreview;
