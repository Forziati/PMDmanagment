"use client";

import ReactECharts from "echarts-for-react";

import { useChartTheme } from "@/lib/charts/theme";

export interface KpiBar {
  label: string;
  valueMdp: number;
}

/** Barras Hito/Programado/Real en MDP — PPTX de GAP, slide 2. */
export function KpiBarChart({ bars }: { bars: KpiBar[] }) {
  const theme = useChartTheme();

  const option = {
    backgroundColor: "transparent",
    grid: { left: 56, right: 24, top: 32, bottom: 32 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (v: number) => `$${v.toLocaleString("es-MX", { maximumFractionDigits: 2 })} MDP`,
    },
    xAxis: {
      type: "category",
      data: bars.map((b) => b.label),
      axisLine: { lineStyle: { color: theme.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: theme.textSecondary },
    },
    yAxis: {
      type: "value",
      name: "MDP",
      nameTextStyle: { color: theme.textSecondary },
      splitLine: { lineStyle: { color: theme.axisLine } },
      axisLabel: { color: theme.textSecondary },
    },
    series: [
      {
        type: "bar",
        barWidth: 48,
        barMaxWidth: 56,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: (params: { dataIndex: number }) => theme.colors[params.dataIndex % theme.colors.length],
        },
        label: {
          show: true,
          position: "top",
          color: theme.textPrimary,
          formatter: (params: { value: number }) =>
            `$${params.value.toLocaleString("es-MX", { maximumFractionDigits: 1 })}`,
        },
        data: bars.map((b) => b.valueMdp),
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 280, width: "100%" }} notMerge />;
}
