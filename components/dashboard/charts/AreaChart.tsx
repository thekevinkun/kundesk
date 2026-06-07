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
  accentColor?: string;
}

const AreaChart = ({ data, accentColor }: AreaChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  // Rebuild chart when theme toggles — CSS variables change value
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const style = getComputedStyle(document.documentElement);
    const brandColor =
      accentColor ??
      (style.getPropertyValue("--color-brand").trim() || "#069494");

    // Read card bg for tooltip — white in light, dark card in dark mode
    const tooltipBg =
      style.getPropertyValue("--color-bg-card").trim() || "#ffffff";
    const tooltipTitle =
      style.getPropertyValue("--color-text-900").trim() || "#0f1117";
    const tooltipBody =
      style.getPropertyValue("--color-text-500").trim() || "#718096";
    const borderColor =
      style.getPropertyValue("--color-border").trim() || "#e8ecf0";
    const gridColor =
      style.getPropertyValue("--color-border-sm").trim() || "#f0f2f4";
    const tickColor =
      style.getPropertyValue("--color-text-400").trim() || "#a0aec0";

    chartRef.current?.destroy();

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(
      0,
      `color-mix(in srgb, ${brandColor} 19%, transparent)`,
    );
    gradient.addColorStop(
      1,
      `color-mix(in srgb, ${brandColor} 1%, transparent)`,
    );

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
            tension: 0.45,
            clip: 8,
            pointRadius: 0,
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
              label: (ctx) => ` ${ctx.parsed.y} pesan`,
            },
            // Dynamic colors — correct in both light and dark
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
              maxTicksLimit: 7,
              color: tickColor,
              font: { family: "var(--font-body)", size: 11 },
            },
          },
          y: {
            grid: { color: gridColor },
            border: { display: false, dash: [4, 4] },
            ticks: {
              color: tickColor,
              padding: 8,
              font: { family: "var(--font-body)", size: 11 },
            },
          },
        },
        layout: {
          padding: {
            top: 8,
            right: 8,
            left: 4,
            bottom: 2,
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
    // resolvedTheme in deps — rebuilds chart with fresh CSS variable values on toggle
  }, [data, resolvedTheme, accentColor]);

  return (
    <div className="h-[140px]">
      <canvas ref={canvasRef} />
    </div>
  );
};

export default AreaChart;
