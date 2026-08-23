"use client";

import ReactECharts from "echarts-for-react";

import { useChartTheme } from "@/lib/charts/theme";

export interface DonutSlice {
  name: string;
  valueMdp: number;
}

/** Desglose del faltante (dona) — PPTX de GAP, slide 6. */
export function FaltanteDonutChart({ slices }: { slices: DonutSlice[] }) {
  const theme = useChartTheme();

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      valueFormatter: (v: number) => `$${Number(v).toLocaleString("es-MX", { maximumFractionDigits: 2 })} MDP`,
    },
    legend: {
      orient: "horizontal",
      bottom: 0,
      textStyle: { color: theme.textSecondary },
    },
    color: theme.colors,
    series: [
      {
        type: "pie",
        radius: ["45%", "70%"],
        center: ["50%", "46%"],
        itemStyle: {
          borderColor: theme.surface,
          borderWidth: 2,
        },
        label: {
          formatter: "{b}\n{d}%",
          color: theme.textSecondary,
        },
        labelLine: { lineStyle: { color: theme.axisLine } },
        data: slices.map((s) => ({ name: s.name, value: s.valueMdp })),
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 320, width: "100%" }} notMerge />;
}
