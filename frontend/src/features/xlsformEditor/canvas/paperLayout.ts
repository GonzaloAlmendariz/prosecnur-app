// =============================================================================
// canvas/paperLayout.ts — opciones del select «Layout impreso» (paper_layout)
// =============================================================================
// `paper_layout` era texto libre. El select ofrece sólo lo que el motor
// respeta (reporte_formulario_pdf.R): `full`/`wide` imprimen la pregunta a todo
// el ancho y `all_choices` fuerza la lista completa aunque pase el máximo de
// opciones; vacío = automático. El select los nombra en castellano con el código entre
// paréntesis. Un valor que la fila ya traiga y no esté en la lista se ofrece
// tal cual como opción extra: no se descarta en silencio.
// =============================================================================

export type OpcionLayoutImpreso = { valor: string; rotulo: string };

export const OPCIONES_LAYOUT_IMPRESO: readonly OpcionLayoutImpreso[] = [
  { valor: "", rotulo: "Automático" },
  { valor: "full", rotulo: "Ancho completo (full)" },
  { valor: "wide", rotulo: "Ancho (wide)" },
  { valor: "all_choices", rotulo: "Todas las opciones (all_choices)" },
];

/** Opciones del select para el valor actual de la fila. */
export function opcionesLayoutImpreso(actual: string | null | undefined): OpcionLayoutImpreso[] {
  const valor = (actual ?? "").trim();
  const conocida = OPCIONES_LAYOUT_IMPRESO.some((o) => o.valor === valor);
  return conocida
    ? [...OPCIONES_LAYOUT_IMPRESO]
    : [...OPCIONES_LAYOUT_IMPRESO, { valor, rotulo: `${valor} (valor de la fila)` }];
}
