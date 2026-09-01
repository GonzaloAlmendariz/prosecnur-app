// La ficha ESCANEADA del parte (B6c, fase 2).
//
// El equipo pega en la hoja «Aulas Aplicadas (Campo)» del libro el enlace del
// escaneo de la ficha que volvió del aula —columna manual «ENLACE DE FICHA
// ESCANEADA»— y `monitoreo_aulas_partes_publicados()` lo entrega en cada parte
// como `scanned_sheet_link` (7e549c22). Se lee del PARTE y no de la fila del
// plan a propósito: `.PARTE_APP_AL_PLAN` no lo copia —decisión cerrada en el
// backend—, así que buscarlo en el plan sería un hueco eterno.
//
// La unión es por `operational_code`, la misma clave con la que el parte se une
// al plan en `parteDeCampo` y con la que el registro cuenta sus «con parte»: si
// esta superficie uniera por su cuenta, el chip podría decir «con parte» y la
// ficha «sin parte» sobre la misma aula.

/** Lo que la ficha puede decir del escaneo: el enlace, o el motivo del hueco. */
export type FichaEscaneada =
  | { estado: "enlace"; url: string }
  | { estado: "parte-sin-enlace" }
  | { estado: "sin-parte" };

/**
 * Resuelve el enlace de la ficha escaneada del aula `codigo` contra la hoja de
 * partes del libro.
 *
 * Tolera el alias castellano `enlace_ficha_escaneada` además del nombre
 * normalizado: el publicador ya traduce, pero el lector del libro acepta los
 * dos títulos y un parte que llegue por otro camino puede traer el crudo. Un
 * nulo no se convierte en el texto «null»: sólo cuenta el primer valor con
 * texto de verdad.
 */
export function fichaEscaneadaDelParte(
  codigo: string,
  partes: ReadonlyArray<Record<string, unknown>>,
): FichaEscaneada {
  const buscado = String(codigo ?? "").trim();
  const parte = buscado
    ? partes.find((p) => String(p.operational_code ?? "").trim() === buscado) ?? null
    : null;
  if (!parte) return { estado: "sin-parte" };
  const url = [parte.scanned_sheet_link, parte.enlace_ficha_escaneada]
    .map((v) => (v === null || v === undefined ? "" : String(v).trim()))
    .find((v) => v !== "") ?? "";
  return url ? { estado: "enlace", url } : { estado: "parte-sin-enlace" };
}
