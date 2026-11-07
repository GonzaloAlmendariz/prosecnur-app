// «Revisar emparejado» del contraste entre públicos (ADR 0135 §7): `?panel=emparejado&foco=<slide.id>:g<k>`. Se abre
// desde la tarjeta del contraste en Datos; la lámina y la ranura las dice `foco`.

import type { PanelDeclarado } from "../../../../lib/navegacion/paneles";

export const PANEL_EMPAREJADO: PanelDeclarado = {
  id: "emparejado",
  label: "Revisar emparejado",
  clase: "dialogo",
};
