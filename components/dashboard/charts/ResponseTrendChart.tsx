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

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
);

interface ResponseTrendChartProps {
  // { date: "DD/MM", avgMs: number }[] sorted oldest→newest
  data: { date: string; avgMs: number }[];
}

const ResponseTrendChart = ({ data }: ResponseTrendChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const style = getComputedStyle(document.documentElement);
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

    // Purple accent — distinct from brand teal, signals "performance" metric
    const lineColor = "#8b5cf6";

    chartRef.current?.destroy();

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 180);
    gradient.addColorStop(0, "rgba(139,92,246,0.15)");
    gradient.addColorStop(1, "rgba(139,92,246,0.01)");

    // Convert ms → seconds for every data point
    const secondsData = data.map((d) =>
      parseFloat((d.avgMs / 1000).toFixed(2)),
    );

    chartRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels: data.map((d) => d.date),
        datasets: [
          {
            data: secondsData,
            borderColor: lineColor,
            borderWidth: 2.5,
            fill: true,
            backgroundColor: gradient,
            tension: 0.45,
            clip: 8,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointBackgroundColor: lineColor,
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
              // Show seconds with unit — clear and readable
              label: (ctx) => ` ${ctx.parsed.y}s rata-rata`,
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
              // Always show "s" unit on y-axis ticks
              callback: (val) => `${val}s`,
            },
            // Start at 0 — so owner sees absolute time, not relative change
            beginAtZero: true,
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
  }, [data, resolvedTheme]);

  return (
    <div className="h-[140px]">
      <canvas ref={canvasRef} />
    </div>
  );
};

export default ResponseTrendChart;
