import type { PanelDeclarado } from "../../lib/navegacion/paneles";

/**
 * Analítica › Variables excluidas (U5, checklist entregables-hsyvbg-2026-10-13).
 *
 * Las variables que no salen en ningún entregable de Analítica ni en los
 * comparativos, para la base activa. Se abre con `?panel=excluidas` desde
 * cualquier pestaña de Analítica (`/analitica?pestana=datos&panel=excluidas`);
 * Carga lo enlaza cuando una base preparada fuera retira variables (ADR 0100).
 * Vive en el manifiesto porque el QA visual recorre esa lista.
 */
export const PANEL_VARIABLES_EXCLUIDAS: PanelDeclarado = {
  id: "excluidas",
  label: "Variables excluidas",
  clase: "sideover",
};

export const PANELES_ANALITICA = [
  PANEL_VARIABLES_EXCLUIDAS,
] as const satisfies readonly PanelDeclarado[];
