import Image from "next/image";
import { Separator } from "@/components/ui/separator";

const DashboardCard = () => {
  return (
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10 px-4 md:px-28 w-full">
      <div
        className="w-full rounded-t-2xl overflow-hidden shadow-[0_-16px_60px_rgba(0,0,0,0.35)]"
        style={{ background: "#ffffff", fontFamily: "var(--font-body)" }}
      >
        {/* ── Topbar ── */}
        <div
          className="flex items-center gap-3 px-4 py-2.5 border-b"
          style={{ background: "#ffffff", borderColor: "#e8ecf0" }}
        >
          {/* Search bar */}
          <div
            className="flex items-center gap-1.5 flex-1 max-w-[200px] px-3 py-1.5 rounded-full text-[10px]"
            style={{
              background: "#f4f5f7",
              color: "#a0aec0",
              border: "1px solid #e8ecf0",
            }}
          >
            🔍 Cari percakapan...
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {/* Bell — red pulse dot */}
            <div
              className="relative w-7 h-7 rounded-lg flex items-center justify-center text-[13px]"
              style={{
                background: "#f4f5f7",
                border: "1px solid #e8ecf0",
              }}
            >
              🔔
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500 border border-white animate-pulse" />
            </div>

            {/* Chat — brand pulse dot */}
            <div
              className="relative w-7 h-7 rounded-lg flex items-center justify-center text-[13px]"
              style={{
                background: "#f4f5f7",
                border: "1px solid #e8ecf0",
              }}
            >
              💬
              <span
                className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full border border-white animate-pulse"
                style={{ background: "var(--color-brand)" }}
              />
            </div>

            <Separator
              orientation="vertical"
              className="h-5! bg-(--color-border)!"
            />

            <div
              className="relative w-7 h-7 rounded-lg flex items-center justify-center text-[13px]"
              style={{
                background: "#f4f5f7",
                border: "1px solid #e8ecf0",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </div>

            {/* Color swatch pill */}
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{
                background: "#f4f5f7",
                border: "1px solid #e8ecf0",
                color: "#718096",
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: "var(--color-brand)" }}
              />
              Warna Brand
            </div>

            <Separator
              orientation="vertical"
              className="h-5! bg-(--color-border)!"
            />

            {/* User pill */}
            <div
              className="flex items-center gap-1.5 px-1 py-1 rounded-full"
              style={{
                background: "var(--color-brand)",
                border: "1px solid #e8ecf0",
              }}
            >
              <div className="w-5 h-5 flex items-center justify-center text-white text-[8px] font-extrabold flex-shrink-0">
                KS
              </div>
            </div>
          </div>
        </div>

        {/* ── Dashboard body ── */}
        <div className="flex" style={{ height: "220px" }}>
          {/* Sidebar strip */}
          <div
            className="flex-shrink-0 w-[110px] flex flex-col py-3 px-2 gap-0.5 border-r"
            style={{ background: "#ffffff", borderColor: "#e8ecf0" }}
          >
            {/* Logo */}
            <div
              className="px-2 pb-2 mb-1 border-b"
              style={{ borderColor: "#f0f2f4" }}
            >
              <Image
                src="/images/logo_kundesk.png"
                alt="Kundesk"
                width={80}
                height={24}
                className="w-20 h-6 object-contain"
              />

              <h3 className="mt-2 ml-2 text-[9px] font-semibold">
                🍽️ Kedai Bu Sari
              </h3>
            </div>

            {/* Nav items */}
            {[
              { icon: "🏠", label: "Dashboard", active: true },
              {
                icon: "💬",
                label: "Percakapan",
                badge: "12",
                badgeRed: true,
              },
              { icon: "📊", label: "Analytics" },
              { icon: "⚙️", label: "Konfigurasi" },
              { icon: "📄", label: "Dokumen" },
            ].map(({ icon, label, active, badge, badgeRed }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[9.5px] font-medium relative"
                style={{
                  background: active
                    ? "var(--color-brand-light)"
                    : "transparent",
                  color: active ? "var(--color-brand)" : "#718096",
                }}
              >
                {active && (
                  <div
                    className="absolute left-0 top-[20%] bottom-[20%] w-0.5 rounded-r"
                    style={{
                      background: "var(--color-brand)",
                      marginLeft: "-8px",
                    }}
                  />
                )}
                <span>{icon}</span>
                <span className="truncate">{label}</span>
                {badge && (
                  <span
                    className="ml-auto text-[8px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: badgeRed
                        ? "#fee2e2"
                        : "var(--color-brand-light)",
                      color: badgeRed ? "#ef4444" : "var(--color-brand)",
                    }}
                  >
                    {badge}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Main content */}
          <div
            className="flex-1 p-3 overflow-hidden"
            style={{ background: "#f4f5f7" }}
          >
            {/* Stat cards row */}
            <div className="grid grid-cols-2 min-[610px]:grid-cols-4 gap-2 mb-2.5">
              {[
                {
                  icon: "💬",
                  label: "Total Pesan",
                  val: "3,847",
                  bg: "#e6f7f7",
                },
                {
                  icon: "✅",
                  label: "Terjawab",
                  val: "97.3%",
                  bg: "#d1fae5",
                },
                {
                  icon: "👥",
                  label: "Pengunjung",
                  val: "621",
                  bg: "#fef3c7",
                },
                {
                  icon: "⚡",
                  label: "Resp. Time",
                  val: "1.2s",
                  bg: "#fee2e2",
                },
              ].map(({ icon, label, val, bg }, index) => (
                <div
                  key={label}
                  className={`
                    rounded-xl p-2.5 flex items-center gap-2
                    ${index >= 2 ? "hidden min-[610px]:flex" : "flex"}
                  `}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e8ecf0",
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[14px] flex-shrink-0"
                    style={{ background: bg }}
                  >
                    {icon}
                  </div>
                  <div className="min-w-0">
                    <div
                      className="text-[9.5px] sm:text-[11px] font-extrabold tracking-[-0.03em]"
                      style={{ color: "#0f1117" }}
                    >
                      {val}
                    </div>
                    <div
                      className="text-[7px] sm:text-[8.5px] truncate"
                      style={{ color: "#718096" }}
                    >
                      {label}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts row 1 */}
            <div className="grid grid-cols-[1fr_1.4fr] gap-2 mb-2">
              {/* Donut chart card */}
              <div
                className="rounded-xl p-3"
                style={{
                  background: "#ffffff",
                  border: "1px solid #e8ecf0",
                }}
              >
                <div
                  className="text-[7px] sm:text-[9px] font-bold mb-2"
                  style={{ color: "#0f1117" }}
                >
                  Ringkasan Performa
                </div>
                <div className="flex items-center justify-around">
                  {[
                    {
                      pct: 97,
                      color: "var(--color-brand)",
                      label: "Terjawab",
                    },
                    { pct: 38, color: "#f59e0b", label: "Kuota" },
                    { pct: 96, color: "#60a5fa", label: "Rating" },
                  ].map(({ pct, color, label }) => (
                    <div
                      key={label}
                      className="flex flex-col items-center gap-1"
                    >
                      <svg width="36" height="36" viewBox="0 0 36 36">
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="#f0f2f4"
                          strokeWidth="4"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke={color}
                          strokeWidth="4"
                          strokeDasharray={`${pct * 0.88} 88`}
                          strokeLinecap="round"
                          transform="rotate(-90 18 18)"
                        />
                        <text
                          x="18"
                          y="22"
                          textAnchor="middle"
                          fontSize="7"
                          fontWeight="800"
                          fill="#0f1117"
                        >
                          {pct}%
                        </text>
                      </svg>
                      <span
                        className="text-[6.5px] sm:text-[7.5px]"
                        style={{ color: "#a0aec0" }}
                      >
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Area chart card */}
              <div
                className="rounded-xl p-3"
                style={{
                  background: "#ffffff",
                  border: "1px solid #e8ecf0",
                }}
              >
                <div
                  className="text-[7px] sm:text-[9px] font-bold mb-2"
                  style={{ color: "#0f1117" }}
                >
                  Tren Percakapan
                </div>
                <svg
                  viewBox="0 0 180 60"
                  preserveAspectRatio="none"
                  className="w-full h-[52px]"
                >
                  <defs>
                    <linearGradient id="dash-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#069494" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#069494" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,48 C20,44 35,32 55,26 C75,20 90,34 110,20 C130,6 150,10 180,4 L180,60 L0,60 Z"
                    fill="url(#dash-grad)"
                  />
                  <path
                    d="M0,48 C20,44 35,32 55,26 C75,20 90,34 110,20 C130,6 150,10 180,4"
                    fill="none"
                    stroke="#069494"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </div>

            {/* Charts row 2 — clipped at bottom, hints more content below */}
            <div
              className="grid grid-cols-[1fr_1.4fr] gap-2"
              style={{ maxHeight: "36px" }}
            >
              {/* Bar chart — Pesan per Hari */}
              <div
                className="rounded-xl p-2.5"
                style={{
                  background: "#ffffff",
                  border: "1px solid #e8ecf0",
                }}
              >
                <div
                  className="text-[9px] font-bold mb-1.5"
                  style={{ color: "#0f1117" }}
                >
                  Pesan per Hari
                </div>
                <div className="flex items-end gap-0.5 h-8">
                  {[40, 65, 50, 80, 60, 95, 72].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm"
                      style={{
                        height: `${h}%`,
                        background: i === 5 ? "var(--color-brand)" : "#e8ecf0",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Dual line chart — Monthly comparison */}
              <div
                className="rounded-xl p-2.5"
                style={{
                  background: "#ffffff",
                  border: "1px solid #e8ecf0",
                }}
              >
                <div
                  className="text-[9px] font-bold mb-1.5"
                  style={{ color: "#0f1117" }}
                >
                  Total Pesan Bulanan
                </div>
                <svg
                  viewBox="0 0 180 40"
                  preserveAspectRatio="none"
                  className="w-full h-8"
                >
                  <path
                    d="M0,32 C30,26 60,18 90,14 C120,10 150,16 180,8"
                    fill="none"
                    stroke="#069494"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M0,36 C30,32 60,26 90,22 C120,18 150,24 180,16"
                    fill="none"
                    stroke="#f87171"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeDasharray="3 2"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardCard;
