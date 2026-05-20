"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Chart, DoughnutController, ArcElement, Tooltip } from "chart.js";

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
  percentage: number;
  color: string;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  // resolvedTheme changes on toggle — triggers effect re-run with fresh colors
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const style = getComputedStyle(document.documentElement);
    // "brand" sentinel — read CSS variable fresh so color picker + dark mode both work
    const resolvedColor =
      color === "brand"
        ? style.getPropertyValue("--color-brand").trim() || "#069494"
        : color;
    const borderColor =
      style.getPropertyValue("--color-border").trim() || "#e8ecf0";

    chartRef.current?.destroy();

    chartRef.current = new Chart(canvas, {
      type: "doughnut",
      data: {
        datasets: [
          {
            data: [percentage, 100 - percentage],
            backgroundColor: [resolvedColor, borderColor],
            borderWidth: 0,
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

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // resolvedTheme in deps — chart rebuilds when dark/light toggles
  }, [percentage, color, resolvedTheme]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[110px] h-[110px] mb-2.5">
        <canvas ref={canvasRef} id={canvasId} width={110} height={110} />
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
  return (
    <div className="flex justify-around items-center py-4 px-2">
      <DonutItem
        canvasId="donut-answered"
        value={`${answeredRate}%`}
        label="Terjawab"
        percentage={answeredRate}
        // Brand color read inside DonutItem's effect — always fresh on theme toggle
        color="brand"
      />
      <DonutItem
        canvasId="donut-quota"
        value={`${Math.round(quotaUsed)}%`}
        label="Kuota Terpakai"
        percentage={quotaUsed}
        color="#f59e0b"
      />
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
