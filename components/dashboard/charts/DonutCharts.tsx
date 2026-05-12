"use client";

import { useEffect, useRef } from "react";
import { Chart, DoughnutController, ArcElement, Tooltip } from "chart.js";

// Register only what we need — tree-shakes unused Chart.js modules
Chart.register(DoughnutController, ArcElement, Tooltip);

// ── Single donut item ──
const DonutItem = ({
  canvasId,
  value,
  label,
  percentage,
  color,
}: {
  canvasId: string;
  value: string;
  label: string;
  percentage: number; // 0–100
  color: string;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Destroy previous instance before creating a new one
    // Prevents "Canvas is already in use" error on re-render
    chartRef.current?.destroy();

    chartRef.current = new Chart(canvas, {
      type: "doughnut",
      data: {
        datasets: [
          {
            data: [percentage, 100 - percentage],
            backgroundColor: [color, "var(--color-border)"],
            borderWidth: 0,
            // Cutout percentage creates the donut hole
          },
        ],
      },
      options: {
        cutout: "78%",
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
        animation: {
          duration: 1200,
          easing: "easeInOutQuart",
        },
      },
    });

    // Cleanup on unmount — prevents memory leak
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [percentage, color]);

  return (
    <div className="flex flex-col items-center">
      {/* Canvas wrapper — center text overlaid absolutely */}
      <div className="relative w-[110px] h-[110px] mb-2.5">
        <canvas ref={canvasRef} id={canvasId} width={110} height={110} />
        {/* Center value — overlaid on donut hole */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[20px] font-extrabold tracking-[-0.04em] text-(--color-text-900) leading-none">
            {value}
          </span>
        </div>
      </div>
      <span className="text-[11.5px] text-(--color-text-400) font-medium text-center">
        {label}
      </span>
    </div>
  );
};

// ── Main export — three donuts side by side ──
interface DonutChartsProps {
  answeredRate: number; // e.g. 97.3
  quotaUsed: number; // 0–100 percentage of messages limit used
}

const DonutCharts = ({ answeredRate, quotaUsed }: DonutChartsProps) => {
  // Brand color from CSS variable — read at render time
  const brandColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--color-brand")
      .trim() || "#069494";

  return (
    <div className="flex justify-around items-center py-4 px-2">
      <DonutItem
        canvasId="donut-answered"
        value={`${answeredRate}%`}
        label="Terjawab"
        percentage={answeredRate}
        color={brandColor}
      />
      <DonutItem
        canvasId="donut-quota"
        value={`${Math.round(quotaUsed)}%`}
        label="Kuota Terpakai"
        percentage={quotaUsed}
        color="#f59e0b"
      />
      {/* Rating — mock until rating system exists in Phase 7 */}
      <DonutItem
        canvasId="donut-rating"
        value="4.8★"
        label="Rating"
        percentage={96}
        color="#60a5fa"
      />
    </div>
  );
};

export default DonutCharts;
