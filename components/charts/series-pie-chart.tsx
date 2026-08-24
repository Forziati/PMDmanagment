"use client";

import ReactECharts from "echarts-for-react";

import { useChartTheme } from "@/lib/charts/theme";

export interface SeriesPieSlice {
  name: string;
  valueMdp: number;
  /** La rebanada agregada "Otros" se pinta en gris neutro, fuera de la paleta. */
  isOtros?: boolean;
}

const OTROS_LIGHT = "#8a8880";
const OTROS_DARK = "#6f6d66";

/** Distribución del PMD programado por serie, para un año del ciclo. */
export function SeriesPieChart({ slices }: { slices: SeriesPieSlice[] }) {
  const theme = useChartTheme();

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      valueFormatter: (v: number) =>
        `$${Number(v).toLocaleString("es-MX", { maximumFractionDigits: 2 })} MDP`,
    },
    legend: {
      orient: "vertical",
      right: 0,
      top: "middle",
      textStyle: { color: theme.textSecondary },
    },
    color: theme.colors,
    series: [
      {
        type: "pie",
        radius: ["45%", "72%"],
        center: ["32%", "50%"],
        itemStyle: { borderColor: theme.surface, borderWidth: 2 },
        label: { formatter: "{d}%", color: theme.textSecondary },
        labelLine: { lineStyle: { color: theme.axisLine } },
        data: slices.map((s) => ({
          name: s.name,
          value: s.valueMdp,
          ...(s.isOtros
            ? { itemStyle: { color: theme.isDark ? OTROS_DARK : OTROS_LIGHT } }
            : {}),
        })),
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 300, width: "100%" }} notMerge />;
}
