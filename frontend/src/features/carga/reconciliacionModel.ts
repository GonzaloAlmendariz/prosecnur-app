// Lógica de dominio (pura) de la reconciliación de variables data ↔ XLSForm.
// El .tsx solo presenta; aquí vive la selección, el copy y las comparaciones
// para que sea testeable sin montar el componente.
import type { ReconciliacionExtra, ReconciliacionInfo } from "../../api/client";

// Criterio único de qué columna fuera del formulario viene marcada antes de que
// el usuario decida (diálogo de variables extra y Carga › Revisión). Una columna
// con dato en la mayoría de los casos casi siempre se registró a propósito
// (fecha, hora, ubigeo, teléfono, una marca de selección); un resto de una
// versión anterior del formulario solo tiene datos en parte de los casos. Antes
// se exigía el 100 % y una columna con 94 a 99.9 % quedaba sin marcar (ítem 21
// del checklist de Validación, 2026-11-12). El usuario puede desmarcar.
export const UMBRAL_MARCA_POR_DEFECTO = 50;

// Ronda 2 (decisión de Gonzalo, 2026-11-12): una columna que el motor identifica
// como dato potencialmente personal (`.reconciliacion_dato_personal`) viene sin
// marcar aunque tenga dato; se avisa con su causa y el usuario puede marcarla.
export function vieneMarcadaPorDefecto(extra: Pick<ReconciliacionExtra, "kind" | "fill_pct" | "personal">): boolean {
  if (extra.personal?.sospecha) return false;
  return extra.kind === "con_datos" && extra.fill_pct > UMBRAL_MARCA_POR_DEFECTO;
}

export const ROTULO_DATO_PERSONAL = "Dato potencialmente personal identificado";

/** Rótulo y causa del aviso de dato personal de una columna; `null` si no hay sospecha. */
export function avisoDatoPersonal(extra: Pick<ReconciliacionExtra, "personal">): { rotulo: string; causa: string } | null {
  if (!extra.personal?.sospecha) return null;
  return { rotulo: ROTULO_DATO_PERSONAL, causa: extra.personal.causa };
}

// Porcentaje de casos con dato, sin redondear hacia 100 ni hacia 0: una columna
// con 99.9 % no se presenta como completa ni una con 0.4 % como vacía.
export function textoPorcentajeConDato(fillPct: number): string {
  const pct = Math.max(0, Math.min(100, fillPct));
  if (pct > 0 && pct < 1) return "menos de 1";
  if (pct < 100) return String(Math.min(99, Math.round(pct)));
  return "100";
}

// Nombres marcados como "incluida" en el estado que trae el backend. Si todavía
// no se conservó ninguna, vienen marcadas las que cumplen
// `vieneMarcadaPorDefecto`; si ya hay una decisión, se respeta.
export function initialIncluidas(info: ReconciliacionInfo): string[] {
  const decididas = info.extra.filter((extra) => extra.incluida);
  if (decididas.length) return decididas.map((extra) => extra.name);
  return info.extra.filter(vieneMarcadaPorDefecto).map((extra) => extra.name);
}

// Etiqueta del relleno para mostrar en la fila. fill_pct viene 0-100.
export function fillLabel(extra: ReconciliacionExtra): string {
  if (extra.kind === "vacia") return "Sin datos";
  const texto = textoPorcentajeConDato(extra.fill_pct);
  if (texto === "menos de 1") return "Menos de 1 % con datos";
  return `${texto} % con datos`;
}

// Alterna un nombre dentro del conjunto de incluidas, devolviendo un arreglo
// nuevo (no muta). Mantiene el orden de aparición de `extra`.
export function toggleIncluida(
  extras: ReconciliacionExtra[],
  incluidas: string[],
  name: string,
): string[] {
  const set = new Set(incluidas);
  if (set.has(name)) set.delete(name);
  else set.add(name);
  return extras.filter((extra) => set.has(extra.name)).map((extra) => extra.name);
}

// Compara dos selecciones ignorando el orden.
export function selectionEquals(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((name) => set.has(name));
}

// Resumen para el panel revisitable: "3 variables extra · 1 incluida".
export function summaryLabel(info: ReconciliacionInfo): string {
  const extraLabel = `${info.n_extra} variable${info.n_extra === 1 ? "" : "s"} extra`;
  const incluidasLabel = `${info.n_incluidas} incluida${info.n_incluidas === 1 ? "" : "s"}`;
  return `${extraLabel}, ${incluidasLabel}`;
}

// Título del diálogo según cuántas variables se detectaron.
export function dialogTitle(nExtra: number): string {
  if (nExtra === 1) return "Encontramos 1 variable que no está en tu formulario";
  return `Encontramos ${nExtra} variables que no están en tu formulario`;
}
