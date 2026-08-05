/**
 * Modelo puro del explorador de bases (Marco › Explorador).
 *
 * G42 · Gonzalo: «falta la pestaña que nos permite explorar las bases de
 * estudiantes y cursos-horario con gráficos muy similares a los del explorador
 * de base de procesamiento/validación».
 *
 * Qué describe y qué NO: las filas que el motor ya publicó —la población de
 * estudiantes y el marco de cursos-horario— tal como están. No aplica criterios,
 * no reconstruye el embudo y no acredita nada del marco: para eso están la
 * cascada y la radiografía, que sí las calcula R. Aquí sólo se cuenta lo que hay
 * en la columna, que es lo que se necesita para decidir si una variable sirve.
 *
 * Vive aparte del componente porque es lo único calculable de esta pestaña, y lo
 * calculable de la casa se prueba.
 */
import type { MonitoreoRow } from "../../../../api/client";

export type TipoVariableExplorador = "numerica" | "categorica";

export type VariableExplorador = {
  columna: string;
  tipo: TipoVariableExplorador;
  /** Filas con dato utilizable (ni vacío ni NA textual). */
  conDato: number;
  /** Valores distintos observados (tope de conteo: no se enumera al infinito). */
  distintos: number;
};

export type CategoriaExplorador = {
  clave: string;
  n: number;
  share: number;
};

export type DistribucionCategorica = {
  tipo: "categorica";
  conDato: number;
  sinDato: number;
  categorias: CategoriaExplorador[];
  /**
   * Categorías que no entran en el top mostrado.
   *
   * G45 · Además del agregado viajan sus `filas`, para que la cola se pueda
   * abrir y leer. Gonzalo: «lo demás ya puede quedar como otras tantas
   * categorías, pero con la posibilidad de que de alguna u otra forma podamos
   * verlas, quizás como una lista». Un «otras 39 categorías» que no se puede
   * abrir esconde justo lo que uno quiere comprobar cuando algo no cuadra.
   */
  otras: {
    n: number;
    categorias: number;
    filas: CategoriaExplorador[];
    /** Cuántas quedan fuera incluso de la lista desplegable. */
    truncadas: number;
  } | null;
};

export type DistribucionNumerica = {
  tipo: "numerica";
  conDato: number;
  sinDato: number;
  min: number;
  max: number;
  media: number;
  p25: number;
  p50: number;
  p75: number;
  /** Histograma de anchos iguales; `desde`/`hasta` en unidades de la variable. */
  bins: Array<{ desde: number; hasta: number; n: number }>;
};

export type DistribucionExplorador = DistribucionCategorica | DistribucionNumerica;

/** Vacío, `NA` y `NaN` textuales cuentan como ausencia, no como categoría. */
function vacio(value: unknown): boolean {
  if (value == null) return true;
  const texto = String(value).trim();
  if (!texto) return true;
  const upper = texto.toUpperCase();
  return upper === "NA" || upper === "NAN" || upper === "NULL";
}

function numeroDe(value: unknown): number | null {
  if (vacio(value)) return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Una columna es numérica cuando TODO lo que trae dato es número y hay más de
 * dos valores distintos.
 *
 * El segundo requisito importa: un 0/1 es una bandera, y describirla con media y
 * cuartiles dice menos que sus dos barras. La primera vez que se probó, media
 * 0,73 era la respuesta a una pregunta que nadie hace.
 */
function esNumerica(valores: unknown[]): boolean {
  let conDato = 0;
  const distintos = new Set<number>();
  for (const value of valores) {
    if (vacio(value)) continue;
    const n = numeroDe(value);
    if (n === null) return false;
    conDato += 1;
    if (distintos.size <= 3) distintos.add(n);
  }
  return conDato > 0 && distintos.size > 2;
}

/** Columnas que no se ofrecen: identificadores y hashes no tienen distribución. */
const COLUMNAS_OCULTAS = new Set([
  "unique_student_hash",
  "student_id",
  "classroom_id",
  "course_id",
  "teacher_email",
]);

/**
 * G46 · Las facultades presentes en la base, con cuántas filas trae cada una.
 *
 * Gonzalo: «deberíamos tener un selector de facultad […] para identificar si, por
 * ejemplo, condición tiene las típicas tres o cuatro categorías pero alguna otra
 * facultad es la que agrega muchas otras». El total esconde justo eso: una cola
 * de 11 categorías puede ser una facultad entera escribiendo distinto.
 *
 * Ordenadas por tamaño y no alfabéticamente: al abrir el selector, lo primero
 * que se busca es dónde está el grueso de la base.
 */
export function facultadesDe(
  rows: MonitoreoRow[],
  columna = "faculty",
): Array<{ clave: string; n: number }> {
  if (!rows.length) return [];
  const conteo = new Map<string, number>();
  for (const row of rows) {
    const valor = (row as Record<string, unknown>)[columna];
    if (vacio(valor)) continue;
    const clave = String(valor).trim();
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .map(([clave, n]) => ({ clave, n }))
    .sort((a, b) => b.n - a.n || a.clave.localeCompare(b.clave, "es"));
}

export function inventarioVariables(rows: MonitoreoRow[]): VariableExplorador[] {
  if (!rows.length) return [];
  const columnas = new Set<string>();
  // El muestreo de cabecera basta para el inventario: las filas del motor son
  // rectangulares. Se recorren 50 por si una trae una columna extra.
  for (const row of rows.slice(0, 50)) {
    for (const key of Object.keys(row ?? {})) columnas.add(key);
  }
  const out: VariableExplorador[] = [];
  for (const columna of columnas) {
    if (COLUMNAS_OCULTAS.has(columna)) continue;
    const valores = rows.map((row) => (row as Record<string, unknown>)[columna]);
    const conDato = valores.filter((value) => !vacio(value)).length;
    if (!conDato) continue;
    const distintos = new Set<string>();
    for (const value of valores) {
      if (vacio(value)) continue;
      distintos.add(String(value).trim());
      if (distintos.size > 500) break;
    }
    out.push({
      columna,
      tipo: esNumerica(valores) ? "numerica" : "categorica",
      conDato,
      distintos: distintos.size,
    });
  }
  return out.sort((a, b) => a.columna.localeCompare(b.columna, "es"));
}

/*
 * G45 · Cuántas categorías se dibujan con barra.
 *
 * Estaba en 12 y Gonzalo lo midió contra el uso: «el máximo debería ser algo de
 * cuarenta categorías; lo demás ya puede quedar como otras tantas». Con 12, una
 * variable como la condición del curso —51 valores— escondía en «otras» la
 * mitad de lo que se quiere mirar.
 */
const TOP_CATEGORIAS = 40;

/*
 * Y cuántas se listan al abrir la cola. El tope existe porque una columna de
 * texto libre puede traer miles de valores distintos —«Docente» trae 501— y
 * volcar todos al DOM convierte una lectura en una espera; lo que quede fuera
 * se declara en vez de desaparecer.
 */
const MAX_COLA = 500;

export function distribucionDe(
  rows: MonitoreoRow[],
  columna: string,
  tipo: TipoVariableExplorador,
): DistribucionExplorador | null {
  if (!rows.length || !columna) return null;
  const valores = rows.map((row) => (row as Record<string, unknown>)[columna]);
  const sinDato = valores.filter((value) => vacio(value)).length;
  const conDato = valores.length - sinDato;
  if (!conDato) return null;

  if (tipo === "numerica") {
    const numeros = valores
      .map(numeroDe)
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);
    if (!numeros.length) return null;
    const cuantil = (q: number) => {
      const pos = (numeros.length - 1) * q;
      const bajo = Math.floor(pos);
      const alto = Math.ceil(pos);
      if (bajo === alto) return numeros[bajo]!;
      return numeros[bajo]! + (numeros[alto]! - numeros[bajo]!) * (pos - bajo);
    };
    const min = numeros[0]!;
    const max = numeros[numeros.length - 1]!;
    const nBins = Math.min(24, Math.max(6, Math.round(Math.sqrt(numeros.length))));
    const ancho = max > min ? (max - min) / nBins : 1;
    const bins = Array.from({ length: max > min ? nBins : 1 }, (_, index) => ({
      desde: min + ancho * index,
      hasta: min + ancho * (index + 1),
      n: 0,
    }));
    for (const value of numeros) {
      const bruto = max > min ? Math.floor((value - min) / ancho) : 0;
      const index = Math.min(bins.length - 1, Math.max(0, bruto));
      bins[index]!.n += 1;
    }
    return {
      tipo: "numerica",
      conDato: numeros.length,
      sinDato,
      min,
      max,
      media: numeros.reduce((acc, value) => acc + value, 0) / numeros.length,
      p25: cuantil(0.25),
      p50: cuantil(0.5),
      p75: cuantil(0.75),
      bins,
    };
  }

  const conteo = new Map<string, number>();
  for (const value of valores) {
    if (vacio(value)) continue;
    const clave = String(value).trim();
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
  }
  const ordenadas = [...conteo.entries()]
    .map(([clave, n]) => ({ clave, n, share: n / conDato }))
    .sort((a, b) => b.n - a.n || a.clave.localeCompare(b.clave, "es"));
  const categorias = ordenadas.slice(0, TOP_CATEGORIAS);
  const resto = ordenadas.slice(TOP_CATEGORIAS);
  return {
    tipo: "categorica",
    conDato,
    sinDato,
    categorias,
    otras: resto.length
      ? {
          n: resto.reduce((acc, row) => acc + row.n, 0),
          categorias: resto.length,
          filas: resto.slice(0, MAX_COLA),
          truncadas: Math.max(0, resto.length - MAX_COLA),
        }
      : null,
  };
}
