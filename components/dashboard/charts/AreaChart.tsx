"use client";

import { useEffect, useRef } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
} from "chart.js";

// Register only what area chart needs
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
);

interface AreaChartProps {
  // Array of { date: "DD/MM", count: number } sorted oldest→newest
  data: { date: string; count: number }[];
}

const AreaChart = ({ data }: AreaChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get brand color at runtime — respects color picker changes
    const brandColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-brand")
        .trim() || "#069494";

    chartRef.current?.destroy();

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Gradient fill — brand color at top fading to transparent at bottom
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    // Use CSS color-mix for format-agnostic opacity
    gradient.addColorStop(
      0,
      `color-mix(in srgb, ${brandColor} 19%, transparent)`,
    ); // 19% opacity
    gradient.addColorStop(
      1,
      `color-mix(in srgb, ${brandColor} 1%, transparent)`,
    ); // ~1% opacity

    chartRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels: data.map((d) => d.date),
        datasets: [
          {
            data: data.map((d) => d.count),
            borderColor: brandColor,
            borderWidth: 2.5,
            fill: true,
            backgroundColor: gradient,
            tension: 0.45, // smooth curve
            pointRadius: 0, // no dots on line — clean look
            pointHoverRadius: 5,
            pointBackgroundColor: brandColor,
            pointBorderColor: "white",
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              // Indonesian label — "142 pesan" not just "142"
              label: (ctx) => ` ${ctx.parsed.y} pesan`,
            },
            backgroundColor: "white",
            titleColor: "var(--color-text-900)",
            bodyColor: "var(--color-text-500)",
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
              // Show max 7 labels — avoids crowding on 30-day range
              maxTicksLimit: 7,
              color: "var(--color-text-400)",
              font: { family: "var(--font-body)", size: 11 },
            },
          },
          y: {
            grid: { color: "var(--color-border-sm)" },
            border: { display: false, dash: [4, 4] },
            ticks: {
              color: "var(--color-text-400)",
              padding: 8,
              font: { family: "var(--font-body)", size: 11 },
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
  }, [data]);

  return (
    // Fixed height wrapper — maintainAspectRatio: false lets canvas fill it
    <div className="h-[140px]">
      <canvas ref={canvasRef} />
    </div>
  );
};

export default AreaChart;
