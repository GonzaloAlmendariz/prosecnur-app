/**
 * Muestra general › Archivo del marco: qué columna se propone para cada rol
 * (id, estrato, tamaño) a partir de su nombre.
 *
 * El nombre se compara sin mayúsculas, sin tildes y por palabras
 * (`cod_hogar`, `Código`, `N personas`). La propuesta es un punto de partida:
 * el formulario la marca como propuesta y el usuario la cambia o la quita.
 *
 * La unicidad del id no se comprueba aquí: la inspección del archivo sólo
 * devuelve nombres de columna, no valores. La valida el motor al declarar
 * (`ids_duplicados` en el error del marco).
 */

export type ColumnasPropuestas = { id: string; estrato: string; tamano: string };

const PALABRAS_ID = ["codigo", "cod", "id", "dni", "folio", "clave", "cui", "ruc"] as const;
const PALABRAS_ESTRATO = ["distrito", "provincia", "region", "zona", "estrato", "facultad", "sede"] as const;
const PALABRAS_TAMANO = ["personas", "tamano", "hogares", "n_personas", "poblacion"] as const;

/** `Código ` → `codigo`; `N° Personas` → `n personas`. */
export function normalizarNombreColumna(nombre: string): string {
  return nombre
    .replace(/^﻿/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function palabras(normalizado: string): string[] {
  return normalizado.split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * 2 si el nombre ES una de las palabras (`codigo`, `n_personas`); 1 si la
 * contiene como palabra suelta (`cod_hogar`); 0 si no.
 */
function coincidencia(nombre: string, lista: readonly string[]): number {
  const n = normalizarNombreColumna(nombre);
  const compacto = palabras(n).join("_");
  if (lista.includes(n) || lista.includes(compacto)) return 2;
  const partes = palabras(n);
  return partes.some((p) => lista.includes(p)) ? 1 : 0;
}

function mejor(
  columnas: readonly string[],
  lista: readonly string[],
  admite: (columna: string, puntaje: number) => boolean,
): string {
  let elegida = "";
  let puntaje = 0;
  for (const c of columnas) {
    const p = coincidencia(c, lista);
    if (p > puntaje && admite(c, p)) {
      elegida = c;
      puntaje = p;
    }
  }
  return elegida;
}

export function proponerColumnas(columnas: readonly string[]): ColumnasPropuestas {
  const otrasDeId = [...PALABRAS_ESTRATO, ...PALABRAS_TAMANO];
  // Una palabra de id dentro de un nombre de estrato o tamaño (`cod_distrito`)
  // nombra el código del grupo, no la unidad: sólo cuenta si el nombre es
  // exactamente la palabra de id.
  const id = mejor(columnas, PALABRAS_ID, (c, p) => p === 2 || coincidencia(c, otrasDeId) === 0);
  const estrato = mejor(columnas, PALABRAS_ESTRATO, (c) => c !== id);
  const tamano = mejor(columnas, PALABRAS_TAMANO, (c) => c !== id && c !== estrato && coincidencia(c, PALABRAS_ID) === 0);
  return { id, estrato, tamano };
}
