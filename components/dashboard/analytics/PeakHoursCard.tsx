"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { staggerItem } from "@/lib/animations";
import { HOUR_LABELS, DAY_PERIODS } from "./constants";

// Heavy Chart.js — dynamic import, not SSR
const HourlyBarChart = dynamic(
  () => import("@/components/dashboard/charts/HourlyBarChart"),
  { ssr: false },
);

interface PeakHoursCardProps {
  // 24-element array — index = hour (0=midnight)
  data: number[];
}

const PeakHoursCard = ({ data }: PeakHoursCardProps) => {
  const total = data.reduce((sum, n) => sum + n, 0);
  const peakIndex = data.indexOf(Math.max(...data));
  const peakLabel = HOUR_LABELS[peakIndex] ?? "—";
  const peakCount = data[peakIndex] ?? 0;

  // Volume per period — sum hours in each period range
  const periodVolumes = DAY_PERIODS.map((period) => ({
    label: period.label,
    count: data
      .slice(period.start, period.end + 1)
      .reduce((sum, n) => sum + n, 0),
  }));

  return (
    <motion.div variants={staggerItem} className="card-base p-6 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-bold text-(--color-text-900)">
            Jam Tersibuk
          </h2>
          <p className="text-[12px] text-(--color-text-400) mt-0.5">
            Kapan pelanggan paling aktif mengirim pesan
          </p>
        </div>

        {/* Peak hour callout */}
        {total > 0 && (
          <div className="text-right">
            <div className="text-[20px] font-extrabold tracking-[-0.04em] text-(--color-text-900) leading-none">
              {peakLabel}
            </div>
            <div className="text-[11px] text-(--color-text-400) mt-0.5">
              {peakCount.toLocaleString("id-ID")} pesan
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <span className="text-[32px] mb-3">🕐</span>
          <p className="text-[13px] text-(--color-text-500) font-medium">
            Belum ada data aktivitas
          </p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0">
            <HourlyBarChart data={data} />
          </div>

          {/* Period breakdown — 4 summary chips below chart — pinned to bottom */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {periodVolumes.map((period) => {
              const pct =
                total > 0 ? Math.round((period.count / total) * 100) : 0;

              return (
                <div
                  key={period.label}
                  className="rounded-[8px] bg-(--color-bg-page) border border-(--color-border) px-3 py-2 text-center"
                >
                  <div className="text-[13px] font-bold text-(--color-text-900)">
                    {pct}%
                  </div>
                  <div className="text-[10.5px] text-(--color-text-400) font-medium mt-0.5">
                    {period.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default PeakHoursCard;
