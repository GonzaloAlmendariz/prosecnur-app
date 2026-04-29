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

  // Solo el primario (y sus derivados sintéticos) rotan con la paleta de
  // marca. Los grises del fondo y las superficies viven hardcodeados en
  // tokens.css para que cambiar a "Paleta de rojos" o "Paleta de verdes"
  // no manche el fondo entero del dashboard.
  const style: CSSProperties = {
    ["--dash-primario" as string]: theme.color_primario,
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
  };

  return (
    <div className="dashboard-scope" style={style}>
      {children}
    </div>
  );
}
