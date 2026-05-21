"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import {
  Chart,
  BarController,
  BarElement,
  LinearScale,
  CategoryScale,
  Tooltip,
} from "chart.js";
import { HOUR_LABELS } from "@/components/dashboard/analytics/constants";

Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip);

interface HourlyBarChartProps {
  // 24-element array — index = hour (0=midnight, 23=11pm)
  data: number[];
}

const HourlyBarChart = ({ data }: HourlyBarChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const style = getComputedStyle(document.documentElement);
    const brandColor =
      style.getPropertyValue("--color-brand").trim() || "#069494";
    const tooltipBg =
      style.getPropertyValue("--color-bg-card").trim() || "#ffffff";
    const tooltipTitle =
      style.getPropertyValue("--color-text-900").trim() || "#0f1117";
    const tooltipBody =
      style.getPropertyValue("--color-text-500").trim() || "#718096";
    const borderColor =
      style.getPropertyValue("--color-border").trim() || "#e8ecf0";
    const mutedFill =
      style.getPropertyValue("--color-border").trim() || "#e8ecf0";
    const tickColor =
      style.getPropertyValue("--color-text-400").trim() || "#a0aec0";
    const gridColor =
      style.getPropertyValue("--color-border-sm").trim() || "#f0f2f4";

    // Find the peak hour index — highlighted in brand color
    const peakIndex = data.indexOf(Math.max(...data));

    chartRef.current?.destroy();

    chartRef.current = new Chart(canvasRef.current!, {
      type: "bar",
      data: {
        labels: HOUR_LABELS,
        datasets: [
          {
            data,
            // Peak bar gets brand color — all others get muted border color
            backgroundColor: data.map((_, i) =>
              i === peakIndex ? brandColor : mutedFill,
            ),
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => `Jam ${items[0]?.label ?? ""}`,
              label: (ctx) => ` ${ctx.parsed.y} pesan`,
            },
            backgroundColor: tooltipBg,
            titleColor: tooltipTitle,
            bodyColor: tooltipBody,
            borderColor,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 10,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              // Show every 4th label — 24 labels is too dense
              maxTicksLimit: 7,
              color: tickColor,
              font: { family: "var(--font-body)", size: 10 },
            },
          },
          y: {
            grid: { color: gridColor },
            border: { display: false },
            beginAtZero: true,
            ticks: {
              color: tickColor,
              padding: 8,
              font: { family: "var(--font-body)", size: 11 },
            },
          },
        },
        animation: { duration: 800 },
        responsive: true,
        maintainAspectRatio: false,
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [data, resolvedTheme]);

  return (
    <div className="h-full min-h-[120px]">
      <canvas ref={canvasRef} />
    </div>
  );
};

export default HourlyBarChart;
