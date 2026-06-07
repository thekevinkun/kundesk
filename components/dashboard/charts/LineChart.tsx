"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from "chart.js";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
);

interface LineChartProps {
  // 12-element arrays, index 0 = January
  current: number[];
  previous: number[];
  currentYear: number;
  previousYear: number;
  accentColor: string;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const LineChart = ({
  current,
  previous,
  currentYear,
  previousYear,
  accentColor,
}: LineChartProps) => {
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
      style.getPropertyValue("--color-text-900").trim() || "#1a1d23";
    const tooltipBody =
      style.getPropertyValue("--color-text-500").trim() || "#6b7280";
    const borderColor =
      style.getPropertyValue("--color-border").trim() || "#e8ecf0";
    const gridColor =
      style.getPropertyValue("--color-border-sm").trim() || "#f0f2f4";
    const tickColor =
      style.getPropertyValue("--color-text-400").trim() || "#a0aec0";

    chartRef.current?.destroy();

    const currentMonth = new Date().getMonth();
    const currentData = current.map((v, i) => (i > currentMonth ? null : v));

    chartRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels: MONTHS,
        datasets: [
          {
            label: String(currentYear),
            data: currentData,
            borderColor: brandColor,
            backgroundColor: "transparent",
            borderWidth: 2.5,
            tension: 0.45,
            pointRadius: 3,
            pointBackgroundColor: brandColor,
            pointBorderColor: "white",
            pointBorderWidth: 2,
            spanGaps: false,
          },
          {
            label: String(previousYear),
            data: previous,
            borderColor: "#f87171",
            backgroundColor: "transparent",
            borderWidth: 2.5,
            tension: 0.45,
            pointRadius: 3,
            pointBackgroundColor: "#f87171",
            pointBorderColor: "white",
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: tooltipTitle,
            bodyColor: tooltipBody,
            borderColor: borderColor,
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
              color: tickColor,
              font: { family: "var(--font-body)", size: 11 },
            },
          },
          y: {
            grid: { color: gridColor },
            border: { display: false },
            ticks: {
              color: tickColor,
              font: { family: "var(--font-body)", size: 11 },
              callback: (v) =>
                Number(v) >= 1000
                  ? `${(Number(v) / 1000).toFixed(0)}k`
                  : String(v),
            },
          },
        },
        interaction: { mode: "index", intersect: false },
        animation: { duration: 1000 },
        responsive: true,
        maintainAspectRatio: false,
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [
    current,
    previous,
    currentYear,
    previousYear,
    resolvedTheme,
    accentColor,
  ]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: "var(--color-brand)" }}
          />
          <span className="text-[12px] font-semibold text-(--color-text-500)">
            {currentYear}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#f87171]" />
          <span className="text-[12px] font-semibold text-(--color-text-500)">
            {previousYear}
          </span>
        </div>
      </div>
      <div className="h-[160px]">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};

export default LineChart;
