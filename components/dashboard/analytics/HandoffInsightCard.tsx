"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { Chart, DoughnutController, ArcElement, Tooltip } from "chart.js";
import { staggerItem } from "@/lib/animations";
import { getHandoffInsightCopy, SENTIMENT_COLORS } from "./constants";

// HandoffTrendChart pattern reused for the handoff trend line
const HandoffTrendLine = dynamic(
  () => import("@/components/dashboard/charts/HandoffTrendChart"),
  { ssr: false },
);

Chart.register(DoughnutController, ArcElement, Tooltip);

interface HandoffInsightCardProps {
  aiCount: number;
  handoffCount: number;
  handoffRate: number;
  trend: { date: string; count: number }[];
}

// ── Inner donut — AI vs Handoff split ──
// Inline because it's small and only used here
const SplitDonut = ({
  aiCount,
  handoffCount,
}: {
  aiCount: number;
  handoffCount: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const style = getComputedStyle(document.documentElement);
    const brandColor =
      style.getPropertyValue("--color-brand").trim() || "#069494";
    const mutedColor =
      style.getPropertyValue("--color-border").trim() || "#e8ecf0";
    const tooltipBg =
      style.getPropertyValue("--color-bg-card").trim() || "#ffffff";
    const tooltipTitle =
      style.getPropertyValue("--color-text-900").trim() || "#0f1117";
    const borderColor =
      style.getPropertyValue("--color-border").trim() || "#e8ecf0";

    chartRef.current?.destroy();

    // If both are 0 — show a neutral full ring so chart doesn't render empty
    const hasData = aiCount + handoffCount > 0;

    chartRef.current = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: ["Diselesaikan AI", "Minta Admin"],
        datasets: [
          {
            data: hasData ? [aiCount, handoffCount] : [1, 0],
            backgroundColor: hasData ? [brandColor, "#f87171"] : [mutedColor],
            borderWidth: 0,
            // Cutout makes it a donut — consistent with existing DonutCharts
            hoverOffset: 4,
          },
        ],
      },
      options: {
        cutout: "72%",
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: hasData,
            callbacks: {
              label: (ctx) => ` ${ctx.parsed} percakapan`,
            },
            backgroundColor: tooltipBg,
            titleColor: tooltipTitle,
            bodyColor: "#718096",
            borderColor,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 10,
          },
        },
        animation: { duration: 1000 },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [aiCount, handoffCount, resolvedTheme]);

  const total = aiCount + handoffCount;
  const aiPct = total > 0 ? Math.round((aiCount / total) * 100) : 0;

  return (
    <div className="relative w-[120px] h-[120px] flex-shrink-0">
      <canvas ref={canvasRef} />
      {/* Center label — AI % */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[20px] font-extrabold tracking-[-0.04em] text-(--color-text-900) leading-none">
          {aiPct}%
        </span>
        <span className="text-[10px] text-(--color-text-400) font-medium mt-0.5">
          AI
        </span>
      </div>
    </div>
  );
};

const HandoffInsightCard = ({
  aiCount,
  handoffCount,
  handoffRate,
  trend,
}: HandoffInsightCardProps) => {
  const insight = getHandoffInsightCopy(handoffRate);
  const sentiment = SENTIMENT_COLORS[insight.sentiment];

  return (
    <motion.div variants={staggerItem} className="card-base p-6">
      {/* Card header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-bold text-(--color-text-900)">
            Kepuasan & Handoff
          </h2>
          <p className="text-[12px] text-(--color-text-400) mt-0.5">
            Seberapa sering pelanggan meminta bantuan admin
          </p>
        </div>
        {/* Live handoff rate badge */}
        <span className="text-[12px] font-bold px-3 py-1 rounded-full bg-(--color-bg-page) border border-(--color-border) text-(--color-text-500)">
          {handoffRate}% handoff
        </span>
      </div>

      {/* Two visuals side by side */}
      <div className="flex items-center gap-6 mb-5">
        {/* Donut — satisfaction split */}
        <SplitDonut aiCount={aiCount} handoffCount={handoffCount} />

        {/* Legend + trend line */}
        <div className="flex-1 min-w-0">
          {/* Legend */}
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-(--color-brand) flex-shrink-0" />
              <span className="text-[12px] text-(--color-text-500) font-medium">
                AI ({aiCount.toLocaleString("id-ID")})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#f87171] flex-shrink-0" />
              <span className="text-[12px] text-(--color-text-500) font-medium">
                Admin ({handoffCount.toLocaleString("id-ID")})
              </span>
            </div>
          </div>

          {/* Handoff trend line — 30 days */}
          <p className="text-[11px] text-(--color-text-400) mb-2 font-medium uppercase tracking-wider">
            Tren Handoff 30 Hari
          </p>
          {trend.length > 0 ? (
            <HandoffTrendLine data={trend} />
          ) : (
            <div className="h-[140px] flex items-center justify-center">
              <p className="text-[12px] text-(--color-text-400)">
                Belum ada data handoff
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Insight copy — threshold-based messaging */}
      <div
        className={`rounded-[10px] border p-3.5 ${sentiment.bg} ${sentiment.border}`}
      >
        <div className="flex items-start gap-2.5">
          <span
            className={`text-[14px] flex-shrink-0 mt-0.5 ${sentiment.text}`}
          >
            {sentiment.icon}
          </span>
          <div>
            <p className={`text-[13px] font-bold mb-0.5 ${sentiment.text}`}>
              {insight.headline}
            </p>
            <p
              className={`text-[12px] leading-relaxed ${sentiment.text} opacity-80`}
            >
              {insight.detail}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default HandoffInsightCard;
