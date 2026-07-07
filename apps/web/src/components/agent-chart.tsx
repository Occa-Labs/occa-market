"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@occa-market/shared";

/* The chart block — a candlestick chart rendered client-side by TradingView
   Lightweight Charts (canvas). Background is black per brand call; candle
   colors keep the library defaults. The raw OHLCV rides in as a `chart` block
   (see OutputBlock) so the model never draws pixels — it ships data, the
   client renders. */
export function AgentChart({
  candles,
  interval,
}: {
  candles: Candle[];
  interval?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || candles.length === 0) return;

    const chart: IChartApi = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#000000" },
        textColor: "#8a8d93",
        fontFamily:
          "var(--font-mono), ui-monospace, SFMono-Regular, monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.07)" },
      timeScale: {
        borderColor: "rgba(255,255,255,0.07)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: { mode: 0 },
    });

    const series = chart.addSeries(CandlestickSeries, { borderVisible: false });
    series.setData(
      candles
        .slice()
        .sort((a, b) => a.t - b.t)
        .map((c) => ({
          time: c.t as UTCTimestamp,
          open: c.o,
          high: c.h,
          low: c.l,
          close: c.c,
        })),
    );
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [candles]);

  if (candles.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-black">
      {interval && (
        <div className="flex items-center justify-between px-3 pt-2.5">
          <span className="font-mono text-[0.6rem] uppercase tracking-wider text-faint">
            Price
          </span>
          <span className="font-mono text-[0.6rem] uppercase tracking-wider text-faint">
            {interval}
          </span>
        </div>
      )}
      <div ref={containerRef} className="h-[220px] w-full" />
    </div>
  );
}
