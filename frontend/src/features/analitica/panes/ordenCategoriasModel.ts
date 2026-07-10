// Lógica pura del editor "Orden de categorías" (Analítica).
// El .tsx solo presenta; toda la manipulación de secuencias vive aquí para
// poder testearla con vitest sin montar React.
//
// Contrato con el backend: `orden_categorias[list_name]` es la secuencia
// EXPLÍCITA de códigos de choice. Los códigos ausentes en la secuencia se
// anexan al final en su orden original (el backend replica esa semántica).

import type { DataReviewVariable, VariableInstrumento } from "../../../api/client";

// Estándar de la casa (ver MEMORY / dominio-prosecnur): valores especiales
// que por convención van al final de cualquier distribución.
//   90 No aplica/perdido · 94 NS/NR · 95 No piensa votar · 96 Blanco/Viciado
//   97 No votó · 98 No sabe · 99 No responde
export const VALORES_ESPECIALES = ["90", "94", "95", "96", "97", "98", "99"] as const;

const ESPECIALES_SET = new Set<string>(VALORES_ESPECIALES);

export function esValorEspecial(code: string): boolean {
  return ESPECIALES_SET.has(code);
}

// Reordena `codes` moviendo los valores especiales al final, preservando el
// orden relativo tanto de los normales como de los especiales.
export function enviarEspecialesAlFinal(codes: string[]): string[] {
  const normales = codes.filter((c) => !ESPECIALES_SET.has(c));
  const especiales = codes.filter((c) => ESPECIALES_SET.has(c));
  return [...normales, ...especiales];
}

// Aplica un orden guardado sobre el universo de códigos del instrumento:
// primero los guardados que existen (en su orden, sin duplicar), luego los
// códigos del instrumento que faltaban (en su orden original). Mismo criterio
// que usa el backend al reconstruir `orders_list`.
export function aplicarOrdenGuardado(instrumentCodes: string[], saved: string[]): string[] {
  const universo = new Set(instrumentCodes);
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const code of saved) {
    if (universo.has(code) && !vistos.has(code)) {
      resultado.push(code);
      vistos.add(code);
    }
  }
  for (const code of instrumentCodes) {
    if (!vistos.has(code)) {
      resultado.push(code);
      vistos.add(code);
    }
  }
  return resultado;
}

// Semilla del editor:
//   • Con override guardado → se respeta tal cual (ausentes al final).
//   • Sin override → orden del instrumento con los especiales empujados al
//     final como sugerencia (default de la casa).
export function sembrarOrden(instrumentCodes: string[], saved: string[] | undefined): string[] {
  if (saved && saved.length > 0) return aplicarOrdenGuardado(instrumentCodes, saved);
  return enviarEspecialesAlFinal(instrumentCodes);
}

// Dos secuencias son equivalentes si tienen los mismos códigos en el mismo
// orden. Se usa para decidir si el override coincide con el orden del
// instrumento (y ofrecer restaurar).
export function ordenesIguales(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((code, i) => code === b[i]);
}

// ----- Ordinalidad de lista (contrato compartido con el backend) -------------
// Regla "lista ordinal EFECTIVA", idéntica en R y TS:
//   • Si `listas_ordinales[list_name]` está definido (!== undefined) → gana ese
//     override explícito del analista (true o false).
//   • Si no → cae a `list_ordinal_auto` de esa lista (auto-detección del
//     backend), y si tampoco está mapeada, a `false`.
// El backend consume `listas_ordinales` (overrides) y calcula `list_ordinal_auto`
// por lista; ambos lados aplican esta misma resolución para decidir si una lista
// conserva su orden fijo al pedir orden "por frecuencia".
export function esListaOrdinalEfectiva(
  listName: string,
  overrides: Record<string, boolean>,
  autoMap: Record<string, boolean>,
): boolean {
  const override = overrides[listName];
  if (override !== undefined) return override;
  return autoMap[listName] ?? false;
}

// Auto-detección de ordinalidad de una lista a partir de sus variables. El
// backend marca el mismo `list_ordinal_auto` en todas las variables que
// comparten `list_name`; tomamos el primero con valor definido. Sin señal
// → false.
export function ordinalAutoDeLista(vars: VariableInstrumento[]): boolean {
  for (const v of vars) {
    if (v.list_ordinal_auto !== undefined) return v.list_ordinal_auto;
  }
  return false;
}

// ----- Catálogo de listas ----------------------------------------------------
// Una fila del catálogo de listas disponibles. Se deriva de las variables de
// selección del instrumento agrupadas por `list_name`, con el conteo de
// categorías resuelto desde data-review y el flag de override desde el store.

export type ListaCatalogoEntry = {
  listName: string;
  // Cuántas variables de selección comparten esta lista.
  nVariables: number;
  // Cuántas categorías (choices) tiene la lista, según data-review.
  nCategorias: number;
  // La lista tiene un orden propio guardado (override no vacío en el store).
  tieneOverride: boolean;
  // Auto-detección de ordinalidad calculada por el backend para la lista.
  ordinalAuto: boolean;
  // Ordinalidad EFECTIVA = override explícito (`listas_ordinales`) ?? auto.
  ordinalEfectivo: boolean;
};

// Deriva el catálogo de listas únicas a partir de las variables de selección.
// Agrupa por `list_name` (ignora vacíos), cuenta variables, resuelve cuántas
// categorías tiene la lista (primera variable de la lista con opciones en
// data-review) y marca `tieneOverride` si el store ya guardó un orden propio.
// Orden útil: más variables primero, y a igualdad, alfabético por list_name.
export function derivarCatalogoListas(
  variablesSeleccion: VariableInstrumento[],
  dataReview: DataReviewVariable[],
  overrides: Record<string, string[]>,
  ordinalOverrides: Record<string, boolean> = {},
): ListaCatalogoEntry[] {
  const grupos = new Map<string, VariableInstrumento[]>();
  for (const v of variablesSeleccion) {
    const listName = (v.list_name ?? "").trim();
    if (!listName) continue;
    const arr = grupos.get(listName);
    if (arr) arr.push(v);
    else grupos.set(listName, [v]);
  }

  const drPorNombre = new Map(dataReview.map((d) => [d.name, d]));

  const entries: ListaCatalogoEntry[] = [];
  for (const [listName, vars] of grupos) {
    let nCategorias = 0;
    for (const v of vars) {
      const dr = drPorNombre.get(v.name);
      if (dr && dr.opciones.length > 0) {
        nCategorias = dr.opciones.length;
        break;
      }
    }
    const override = overrides[listName];
    const ordinalAuto = ordinalAutoDeLista(vars);
    entries.push({
      listName,
      nVariables: vars.length,
      nCategorias,
      tieneOverride: !!override && override.length > 0,
      ordinalAuto,
      ordinalEfectivo: esListaOrdinalEfectiva(listName, ordinalOverrides, { [listName]: ordinalAuto }),
    });
  }

  entries.sort((a, b) => b.nVariables - a.nVariables || a.listName.localeCompare(b.listName));
  return entries;
}

// ----- Movimiento manual por fila --------------------------------------------
// Reordenan una categoría a una posición precisa (complementan el arrastre).
// Todas son puras y no-op fuera de rango: devuelven la MISMA secuencia si el
// movimiento no cambia nada (primera fila arriba, última fila abajo, etc.).

function moverElemento(codes: string[], desde: number, hacia: number): string[] {
  if (desde < 0 || desde >= codes.length) return codes;
  const destino = Math.max(0, Math.min(hacia, codes.length - 1));
  if (destino === desde) return codes;
  const next = [...codes];
  const [item] = next.splice(desde, 1);
  next.splice(destino, 0, item);
  return next;
}

export function moverArriba(codes: string[], index: number): string[] {
  return moverElemento(codes, index, index - 1);
}

export function moverAbajo(codes: string[], index: number): string[] {
  return moverElemento(codes, index, index + 1);
}

export function moverAlInicio(codes: string[], index: number): string[] {
  return moverElemento(codes, index, 0);
}

export function moverAlFinal(codes: string[], index: number): string[] {
  return moverElemento(codes, index, codes.length - 1);
}
