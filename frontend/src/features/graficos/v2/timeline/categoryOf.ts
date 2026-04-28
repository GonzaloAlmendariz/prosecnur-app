import { SlideType } from "../../../../api/client";

export type SlideCategory = "estructural" | "1g" | "2g" | "grid" | "poblacion";

// Mapa de categoría visual por tipo de slide. Usado para color-coding
// en SlideCard (borde izquierdo) y PlanNodeCard (borde superior).
export function categoryOf(tipo: SlideType): SlideCategory {
  if (tipo.includes("poblacion")) return "poblacion";
  if (tipo.includes("4_graficos")) return "grid";
  if (tipo.includes("2_graficos")) return "2g";
  if (tipo.includes("1_grafico") || tipo.includes("grafico_texto")) return "1g";
  return "estructural";
}

export const CATEGORY_LABEL: Record<SlideCategory, string> = {
  estructural: "Estructural",
  "1g": "1 gráfico",
  "2g": "2 gráficos",
  grid: "Grid 4",
  poblacion: "Población",
};
