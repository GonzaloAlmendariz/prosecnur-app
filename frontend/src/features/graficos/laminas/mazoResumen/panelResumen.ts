// Panel del mazo «Resumen ejecutivo» en la pestaña Láminas (ADR 0135): `?panel=resumen-ejecutivo`. Se abre desde la
// cabecera de «¿Qué quieres contar?» y desde el vacío de Láminas; las láminas se insertan detrás de la del `foco`.

import type { PanelDeclarado } from "../../../../lib/navegacion/paneles";

export const PANEL_RESUMEN_EJECUTIVO: PanelDeclarado = {
  id: "resumen-ejecutivo",
  label: "Armar el resumen ejecutivo",
  clase: "dialogo",
};
