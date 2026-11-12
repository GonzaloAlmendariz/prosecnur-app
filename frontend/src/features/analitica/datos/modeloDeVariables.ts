// Analítica › Datos con la forma del prototipo ("Analítica, Variables"): lo que
// la pestaña decide sin React. El tipo de cada variable dicho en castellano, los
// filtros de la lista con su conteo, la búsqueda, la base común de "Con dato" y
// el cambio de sección de una variable. Todo sale de `/api/analitica/data-review`
// y de la config de Analítica; aquí no se recalcula ninguna cifra del motor.

import type { DataReviewVariable } from "../../../api/analitica";
import type { TipoDePregunta } from "../../../components/procesamiento/FichaPregunta";
import type { SeccionConfig } from "../store";

// ---------------------------------------------------------------------------
// Tipo de la variable

/** El nombre del tipo y, si tiene color de tipo de pregunta, su tono (tokens `--tipo-*`). */
export type TipoDeVariable = { nombre: string; tono: TipoDePregunta | null };

const TIPOS_FECHA = new Set(["date", "datetime", "start", "end", "today"]);
const TIPOS_UBICACION = new Set(["geopoint", "geotrace", "geoshape", "start-geopoint", "background-geopoint"]);
const TIPOS_ARCHIVO = new Set(["image", "audio", "video", "file", "background-audio"]);

/**
 * El tipo que lee el analista, no el del motor: "Única" y no "select_one".
 * `dummy_select_multiple` es una opción de una múltiple que llega en su propia
 * columna; una columna sin tipo es de la base y no está en el formulario.
 */
export function tipoDeVariable(variable: Pick<DataReviewVariable, "tipo_xlsform" | "dummy_parent">): TipoDeVariable {
  const tipo = (variable.tipo_xlsform ?? "").trim().toLowerCase().split(/\s+/)[0] ?? "";
  if (variable.dummy_parent || tipo === "dummy_select_multiple") return { nombre: "Opción de múltiple", tono: "multiple" };
  if (tipo === "select_one" || tipo === "select_one_from_file") return { nombre: "Única", tono: "unica" };
  if (tipo === "select_multiple" || tipo === "select_multiple_from_file") return { nombre: "Múltiple", tono: "multiple" };
  if (tipo === "integer" || tipo === "decimal" || tipo === "range") return { nombre: "Numérica", tono: "numerica" };
  if (tipo === "text") return { nombre: "Texto", tono: "texto" };
  if (tipo === "calculate") return { nombre: "Calculada", tono: null };
  if (TIPOS_FECHA.has(tipo)) return { nombre: "Fecha", tono: null };
  if (tipo === "time") return { nombre: "Hora", tono: null };
  if (TIPOS_UBICACION.has(tipo)) return { nombre: "Ubicación", tono: null };
  if (TIPOS_ARCHIVO.has(tipo)) return { nombre: "Archivo", tono: null };
  if (tipo === "rank") return { nombre: "Orden", tono: null };
  if (tipo === "acknowledge") return { nombre: "Confirmación", tono: null };
  if (tipo === "barcode") return { nombre: "Código de barras", tono: null };
  if (tipo === "" || tipo === "data") return { nombre: "De la base", tono: null };
  return { nombre: "Otro tipo", tono: null };
}

// ---------------------------------------------------------------------------
// Filtros y búsqueda

export type FiltroDeVariables = "todas" | "incluidas" | "excluidas" | "por-confirmar";

export const FILTROS_DE_VARIABLES: readonly FiltroDeVariables[] = ["todas", "incluidas", "excluidas", "por-confirmar"];

/** Lo que la lista sabe de cada variable para filtrarla. */
export type EstadoDeFila = {
  /** Cuenta en los entregables: no está excluida y su sección no está oculta. */
  incluida: boolean;
  /** Su etiqueta o la de alguna opción cambió en el borrador y falta confirmarla. */
  porConfirmar: boolean;
};

export function enFiltro(estado: EstadoDeFila, filtro: FiltroDeVariables): boolean {
  if (filtro === "incluidas") return estado.incluida;
  if (filtro === "excluidas") return !estado.incluida;
  if (filtro === "por-confirmar") return estado.porConfirmar;
  return true;
}

/** Cuántas filas se ven al elegir cada filtro: la cifra de su chip. */
export function conteosDeFiltro(estados: readonly EstadoDeFila[]): Record<FiltroDeVariables, number> {
  return {
    todas: estados.length,
    incluidas: estados.filter((e) => e.incluida).length,
    excluidas: estados.filter((e) => !e.incluida).length,
    "por-confirmar": estados.filter((e) => e.porConfirmar).length,
  };
}

function sinTildes(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Busca por código o por etiqueta (la del borrador), sin mayúsculas ni tildes. */
export function coincideBusqueda(nombre: string, etiqueta: string, consulta: string): boolean {
  const q = sinTildes(consulta);
  if (!q) return true;
  return sinTildes(nombre).includes(q) || sinTildes(etiqueta).includes(q);
}

// ---------------------------------------------------------------------------
// Con dato

/** Casos de la base que lee la variable: con dato más sin dato. 0 si su columna no llegó. */
export function casosDeLaVariable(variable: Pick<DataReviewVariable, "n_non_missing" | "n_missing">): number {
  return Math.max(0, variable.n_non_missing ?? 0) + Math.max(0, variable.n_missing ?? 0);
}

/**
 * La base de la columna "Con dato" cuando todas las variables que llegaron
 * cuentan sobre los mismos casos (lo normal en una base): así la cifra de cada
 * fila dice solo su conteo y la base va una vez en el encabezado. Con bases
 * distintas (variables de un grupo repetido) devuelve null y cada fila dice la suya.
 */
export function baseComunDeCasos(variables: readonly Pick<DataReviewVariable, "n_non_missing" | "n_missing">[]): number | null {
  let base: number | null = null;
  for (const variable of variables) {
    const casos = casosDeLaVariable(variable);
    if (casos === 0) continue;
    if (base === null) base = casos;
    else if (base !== casos) return null;
  }
  return base;
}

/** Ancho de la barra de dato, de 0 a 100. */
export function proporcionConDato(variable: Pick<DataReviewVariable, "n_non_missing" | "n_missing">): number {
  const casos = casosDeLaVariable(variable);
  if (casos === 0) return 0;
  return Math.round((Math.max(0, variable.n_non_missing ?? 0) / casos) * 100);
}

// ---------------------------------------------------------------------------
// Cambio de sección

/**
 * Pasa una variable a otra sección declarada: sale de donde esté y entra al
 * final de la de destino. Si el destino no existe, las secciones quedan igual.
 * Se cruza por el id de la sección y el nombre de la variable, nunca por posición.
 */
export function moverVariableDeSeccion(
  secciones: readonly SeccionConfig[],
  variable: string,
  destinoId: string,
): SeccionConfig[] {
  if (!secciones.some((s) => s.id === destinoId)) return [...secciones];
  return secciones.map((s) => {
    const sin = s.variables.filter((v) => v !== variable);
    if (s.id !== destinoId) return sin.length === s.variables.length ? s : { ...s, variables: sin, manual: true };
    return { ...s, variables: [...sin, variable], manual: true };
  });
}
