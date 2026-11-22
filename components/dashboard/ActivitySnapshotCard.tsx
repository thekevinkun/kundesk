"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getDashboardChartData } from "@/lib/actions/dashboard";
import type { DashboardChartData } from "@/types/dashboard";

interface ActivitySnapshotCardProps {
  orgId: string;
  initialDashboardCharts: DashboardChartData;
}

const ActivitySnapshotCard = ({
  orgId,
  initialDashboardCharts,
}: ActivitySnapshotCardProps) => {
  const { data: chartData } = useQuery({
    queryKey: ["dashboard", orgId, "charts"],
    queryFn: getDashboardChartData,
    initialData: initialDashboardCharts,
    initialDataUpdatedAt: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const weeklyTotal = chartData.weeklyMessages.reduce(
    (total, count) => total + count,
    0,
  );
  const weeklyAverage = Math.round(weeklyTotal / chartData.weeklyMessages.length);
  const monthlyTotal = chartData.monthlyCurrent[chartData.currentMonth] ?? 0;
  const highestDay = Math.max(...chartData.weeklyMessages, 1);
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <Link
      href="/dashboard/analytics"
      className="card-base card-hover block overflow-hidden p-4 focus:outline-none focus:ring-2 focus:ring-(--color-brand)"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-(--color-text-400)">
            Ringkasan aktivitas
          </p>
          <h2 className="mt-1 text-[15px] font-bold text-(--color-text-900)">
            {weeklyTotal.toLocaleString("id-ID")} pesan minggu ini
          </h2>
        </div>
        <span className="pt-0.5 text-[10.5px] font-semibold text-(--color-brand)">
          Analytics →
        </span>
      </div>

      <div className="mt-4" aria-label={`${weeklyTotal} pesan pelanggan minggu ini`}>
        <div className="flex h-13 items-end gap-1">
          {chartData.weeklyMessages.map((count, index) => (
            <span
              key={index}
              className="flex-1 rounded-t-[3px] bg-(--color-brand)"
              style={{ height: `${Math.max((count / highestDay) * 100, 8)}%` }}
              title={`${count} pesan`}
            >
              <span className="sr-only">{count} pesan</span>
            </span>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1 text-center text-[8.5px] font-medium text-(--color-text-400)">
          {weekdays.map((day) => (
            <span key={day} className="flex-1">{day}</span>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-(--color-border-sm) pt-3">
        <div>
          <p className="text-[10px] text-(--color-text-400)">Rata-rata/hari</p>
          <p className="mt-0.5 text-[16px] font-extrabold tracking-[-0.03em] text-(--color-text-900)">
            {weeklyAverage.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="border-l border-(--color-border-sm) pl-3">
          <p className="text-[10px] text-(--color-text-400)">Bulan ini</p>
          <p className="mt-0.5 text-[16px] font-extrabold tracking-[-0.03em] text-(--color-text-900)">
            {monthlyTotal.toLocaleString("id-ID")}
          </p>
        </div>
      </div>
    </Link>
  );
};

export default ActivitySnapshotCard;
