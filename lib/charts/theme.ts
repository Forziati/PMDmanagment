"use client";

import { useEffect, useState } from "react";

/**
 * Paleta categórica validada (dataviz skill, references/palette.md): orden
 * fijo azul/naranja/aqua/amarillo — pasa las pruebas de daltonismo (CVD ΔE
 * ≥ 8) y de contraste normal (≥ 15) en las primeras 4 posiciones, tanto en
 * claro como en oscuro. No se reordena ni se generan tonos nuevos.
 */
export const CATEGORICAL_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];
export const CATEGORICAL_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500"];

const SURFACE_LIGHT = "#ffffff";
const SURFACE_DARK = "#1a1a19";
const TEXT_PRIMARY_LIGHT = "#0b0b0b";
const TEXT_PRIMARY_DARK = "#ffffff";
const TEXT_SECONDARY_LIGHT = "#52514e";
const TEXT_SECONDARY_DARK = "#c3c2b7";
const AXIS_LIGHT = "#e2e1dc";
const AXIS_DARK = "#3a3a37";

function resolveIsDark(): boolean {
  if (typeof window === "undefined") return false;
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "dark") return true;
  if (explicit === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useChartTheme() {
  const [isDark, setIsDark] = useState(resolveIsDark);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => setIsDark(resolveIsDark());
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  return {
    isDark,
    colors: isDark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT,
    surface: isDark ? SURFACE_DARK : SURFACE_LIGHT,
    textPrimary: isDark ? TEXT_PRIMARY_DARK : TEXT_PRIMARY_LIGHT,
    textSecondary: isDark ? TEXT_SECONDARY_DARK : TEXT_SECONDARY_LIGHT,
    axisLine: isDark ? AXIS_DARK : AXIS_LIGHT,
  };
}
