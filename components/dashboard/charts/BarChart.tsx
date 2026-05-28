"use client";

import { useEffect, useRef, useState } from "react";
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
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const syncTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

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
    // Muted bar color should invert with theme:
    // dark in light mode, light in dark mode.
    const mutedBar = isDarkMode
      ? style.getPropertyValue("--color-chart-muted-soft").trim() || "#7888a0"
      : style.getPropertyValue("--color-chart-muted").trim() || "#2d3748";

    chartRef.current?.destroy();

    const rawDow = new Date().getDay();
    const todayIdx = rawDow === 0 ? 6 : rawDow - 1;

    const barColors = data.map((_, i) =>
      i === todayIdx ? brandColor : mutedBar,
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
            backgroundColor: tooltipBg,
            titleColor: tooltipTitle,
            bodyColor: tooltipBody,
            borderColor: borderColor,
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
  }, [data, isDarkMode]);

  return (
    <div className="h-[160px]">
      <canvas ref={canvasRef} />
    </div>
  );
};

export default BarChart;
