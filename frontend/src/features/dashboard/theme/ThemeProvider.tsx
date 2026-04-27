import { CSSProperties, ReactNode } from "react";
import type { DashboardThemeDefault } from "../../../api/client";
import { deriveDashboardTheme } from "./deriveTheme";

// Wrapper que aplica las vars CSS del tema dinámico al scope dashboard.
// El componente envolvente recibe el config visual y los defaults del
// backend; las vars se inyectan como style inline para no contaminar
// el :root global del app.

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function rgba(hex: string, alpha: number, fallback: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function ThemeProvider({
  children,
  paletaId,
  colorPrimarioOverride,
  paletaColors,
  themeDefault,
}: {
  children: ReactNode;
  paletaId: string | null;
  colorPrimarioOverride: string | null;
  paletaColors?: string[];
  themeDefault?: DashboardThemeDefault;
}) {
  const theme = deriveDashboardTheme({
    paletaId,
    colorPrimarioOverride,
    paletaColors,
    themeDefault,
  });

  const style: CSSProperties = {
    // Cast indirecto para que TS acepte custom properties.
    ["--dash-primario" as string]: theme.color_primario,
    ["--dash-fondo" as string]: theme.color_fondo_app,
    ["--dash-borde" as string]: theme.color_borde,
    ["--dash-texto" as string]: theme.color_texto,
    ["--dash-texto-suave" as string]: theme.color_texto_suave,
    ["--dash-superficie" as string]: theme.color_superficie,
    ["--dash-superficie-2" as string]: theme.color_superficie_2,
    ["--dash-header-tabla" as string]: theme.color_header_tabla,
    ["--dash-primario-soft" as string]: rgba(
      theme.color_primario,
      0.08,
      "rgba(0, 36, 87, 0.08)",
    ),
    ["--dash-primario-ring" as string]: rgba(
      theme.color_primario,
      0.18,
      "rgba(0, 36, 87, 0.18)",
    ),
    ["--dash-shadow-color" as string]: rgba(
      theme.color_primario,
      0.08,
      "rgba(15, 23, 42, 0.08)",
    ),
  };

  return (
    <div className="dashboard-scope" style={style}>
      {children}
    </div>
  );
}
