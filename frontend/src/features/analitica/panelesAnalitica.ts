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

/**
 * Analítica › Qué casos cuentan: el universo de análisis de cada base (antes
 * vivía en Validación › Reglas del formulario; Gonzalo, 2026-10-16: «debería
 * ser algo de Analítica»). Se abre con `?panel=universo` desde la línea
 * «Cuentan … casos» del encabezado.
 */
export const PANEL_UNIVERSO: PanelDeclarado = {
  id: "universo",
  label: "Qué casos cuentan",
  clase: "sideover",
};

export const PANELES_ANALITICA = [
  PANEL_VARIABLES_EXCLUIDAS,
  PANEL_UNIVERSO,
] as const satisfies readonly PanelDeclarado[];
