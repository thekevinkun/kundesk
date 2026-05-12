"use client";

import { useEffect, useRef } from "react";
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
}: LineChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const brandColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-brand")
        .trim() || "#069494";

    chartRef.current?.destroy();

    // Null out future months for current year — cleaner than showing zeros
    const currentMonth = new Date().getMonth(); // 0-indexed
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
            // Null values create a gap in the line — correct for future months
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
          legend: { display: false }, // Custom legend rendered in JSX below
          tooltip: {
            backgroundColor: "white",
            titleColor: "#1a1d23",
            bodyColor: "#6b7280",
            borderColor: "var(--color-border)",
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
              color: "var(--color-text-400)",
              font: { family: "var(--font-body)", size: 11 },
            },
          },
          y: {
            grid: { color: "var(--color-border-sm)" },
            border: { display: false },
            ticks: {
              color: "var(--color-text-400)",
              font: { family: "var(--font-body)", size: 11 },
              // Show "1k" instead of "1000"
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
  }, [current, previous, currentYear, previousYear]);

  return (
    <div>
      {/* Custom legend — matches mockup style */}
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
