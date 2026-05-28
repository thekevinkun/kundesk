"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { Chart, DoughnutController, ArcElement, Tooltip } from "chart.js";
import { staggerItem } from "@/lib/animations";
import { CHANNEL_CONFIG } from "./constants";
import type { DeliveryChannel } from "@/types/chat";

Chart.register(DoughnutController, ArcElement, Tooltip);

interface ChannelBreakdownCardProps {
  data: { channel: DeliveryChannel; count: number }[];
}

const ChannelBreakdownCard = ({ data }: ChannelBreakdownCardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const { resolvedTheme } = useTheme();

  const total = data.reduce((sum, d) => sum + d.count, 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const style = getComputedStyle(document.documentElement);
    const isDark = resolvedTheme === "dark";
    const tooltipBg =
      style.getPropertyValue("--color-bg-card").trim() || "#ffffff";
    const tooltipTitle =
      style.getPropertyValue("--color-text-900").trim() || "#0f1117";
    const borderColor =
      style.getPropertyValue("--color-border").trim() || "#e8ecf0";
    const mutedColor =
      style.getPropertyValue("--color-border").trim() || "#e8ecf0";

    chartRef.current?.destroy();

    const hasData = data.length > 0 && total > 0;

    chartRef.current = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: hasData
          ? data.map((d) => CHANNEL_CONFIG[d.channel]?.label ?? d.channel)
          : ["Belum ada data"],
        datasets: [
          {
            data: hasData ? data.map((d) => d.count) : [1],
            backgroundColor: hasData
              ? data.map((d) =>
                  isDark
                    ? (CHANNEL_CONFIG[d.channel]?.darkColor ?? "#069494")
                    : (CHANNEL_CONFIG[d.channel]?.color ?? "#069494"),
                )
              : [mutedColor],
            borderWidth: 0,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        cutout: "70%",
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: hasData,
            callbacks: {
              label: (ctx) => ` ${ctx.parsed} percakapan`,
            },
            backgroundColor: tooltipBg,
            titleColor: tooltipTitle,
            bodyColor: "#718096",
            borderColor,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 10,
          },
        },
        animation: { duration: 1000 },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [data, total, resolvedTheme]);

  return (
    <motion.div variants={staggerItem} className="card-base p-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-bold text-(--color-text-900)">
          Channel Percakapan
        </h2>
        <p className="text-[12px] text-(--color-text-400) mt-0.5">
          Dari mana pelanggan menemukanmu
        </p>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <span className="text-[32px] mb-3">📡</span>
          <p className="text-[13px] text-(--color-text-500) font-medium">
            Belum ada percakapan
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          {/* Donut */}
          <div className="relative w-[120px] h-[120px] flex-shrink-0">
            <canvas ref={canvasRef} />
            {/* Center — total count */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[20px] font-extrabold tracking-[-0.04em] text-(--color-text-900) leading-none">
                {total.toLocaleString("id-ID")}
              </span>
              <span className="text-[10px] text-(--color-text-400) font-medium mt-0.5">
                total
              </span>
            </div>
          </div>

          {/* Legend — one row per channel */}
          <div className="max-w-sm lg:max-w-full flex-1 space-y-3">
            {data.map((item) => {
              const config = CHANNEL_CONFIG[item.channel];
              const pct = Math.round((item.count / total) * 100);

              return (
                <div key={item.channel}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{
                          background:
                            resolvedTheme === "dark"
                              ? config?.darkColor
                              : config?.color,
                        }}
                      />
                      <span className="text-[12.5px] font-medium text-(--color-text-700)">
                        {config?.label ?? item.channel}
                      </span>
                    </div>
                    <span className="text-[12px] font-bold text-(--color-text-900)">
                      {pct}%
                    </span>
                  </div>
                  {/* Mini progress bar */}
                  <div className="h-1.5 bg-(--color-bg-page) rounded-full overflow-hidden border border-(--color-border-sm)">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background:
                          resolvedTheme === "dark"
                            ? config?.darkColor
                            : config?.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ChannelBreakdownCard;
