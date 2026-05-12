"use client";

import { useEffect, useRef } from "react";
import {
  Chart,
  BarController,
  BarElement,
  LinearScale,
  CategoryScale,
  Tooltip,
} from "chart.js";

Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip);

interface BarChartProps {
  // 7-element array, index 0 = Monday
  data: number[];
}

// Day labels — Indonesian abbreviations matching the mockup
const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const BarChart = ({ data }: BarChartProps) => {
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

    // Today's day of week — 0=Sun, 1=Mon ... 6=Sat
    // Convert to Mon-first index: Sun(0)→6, Mon(1)→0, etc.
    const rawDow = new Date().getDay();
    const todayIdx = rawDow === 0 ? 6 : rawDow - 1;

    // Color each bar: brand for today, muted border color for others
    const barColors = data.map((_, i) =>
      i === todayIdx ? brandColor : "var(--color-border)",
    );

    chartRef.current = new Chart(canvas, {
      type: "bar",
      data: {
        labels: DAYS,
        datasets: [
          {
            label: "Pesan",
            data,
            backgroundColor: barColors,
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "white",
            titleColor: "#1a1d23",
            bodyColor: "#6b7280",
            borderColor: "var(--color-border)",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 10,
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.y} pesan`,
            },
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
  }, [data]);

  return (
    <div className="h-[160px]">
      <canvas ref={canvasRef} />
    </div>
  );
};

export default BarChart;
