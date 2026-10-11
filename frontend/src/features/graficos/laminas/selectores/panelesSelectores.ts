// Paneles de los selectores de tipo de la pestaña Láminas (F6.2; dirección F6 §3: `panel=tipo-lamina`,
// `panel=tipo-grafico`). La lámina y la ranura que se cambian las nombra `foco` (`<slide.id>`, `<slide.id>:g2`; `l-07[:g2]` sólo se lee como heredado).

import type { PanelDeclarado } from "../../../../lib/navegacion/paneles";

export const PANEL_TIPO_LAMINA: PanelDeclarado = {
  id: "tipo-lamina",
  label: "¿Qué lámina?",
  clase: "dialogo",
};

export const PANEL_TIPO_GRAFICO: PanelDeclarado = {
  id: "tipo-grafico",
  label: "¿Qué gráfico?",
  clase: "dialogo",
};

export const PANELES_SELECTORES = [PANEL_TIPO_LAMINA, PANEL_TIPO_GRAFICO] as const satisfies readonly PanelDeclarado[];

export const esPanelSelector = (panel: string | null | undefined): boolean =>
  PANELES_SELECTORES.some((p) => p.id === panel);
