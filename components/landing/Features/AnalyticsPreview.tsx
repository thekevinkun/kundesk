const AnalyticsPreview = () => {
  return (
    <div className="bg-[#1e1e1e] border border-[#333] rounded-xl p-4 mb-6 min-h-[148px]">
      <div className="flex justify-between mb-3">
        <div>
          <div className="text-[9.5px] text-[#555] mb-0.5">Pesan Bulan Ini</div>
          <div className="text-[18px] font-extrabold text-white tracking-[-0.03em]">
            3,847
          </div>
        </div>
        <div>
          <div className="text-[9.5px] text-[#555] mb-0.5">Terjawab Auto</div>
          <div
            className="text-[18px] font-extrabold tracking-[-0.03em]"
            style={{ color: "#069494" }}
          >
            97.3%
          </div>
        </div>
      </div>
      <div className="text-[9.5px] text-[#555] mb-1">Total Percakapan</div>
      <div className="text-[20px] font-extrabold text-white tracking-[-0.04em] mb-2">
        621
      </div>
      {/* Mini sparkline */}
      <div className="h-10 w-full overflow-hidden">
        <svg
          viewBox="0 0 260 40"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="feat-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#069494" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#069494" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,32 C30,28 50,22 80,18 C110,14 130,24 160,14 C190,4 220,8 260,3 L260,40 L0,40 Z"
            fill="url(#feat-grad)"
          />
          <path
            d="M0,32 C30,28 50,22 80,18 C110,14 130,24 160,14 C190,4 220,8 260,3"
            fill="none"
            stroke="#069494"
            strokeWidth="2"
          />
        </svg>
      </div>
    </div>
  );
};

export default AnalyticsPreview;
