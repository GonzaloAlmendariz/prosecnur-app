/**
 * Modelo del indicador compuesto de la matriz de equivalencias (ADR 0105).
 *
 * Una fila puede declarar, en vez de una pregunta por base, varias preguntas y
 * los códigos que cuentan como «sí». La regla es una sola, `alguna`: el caso
 * vale 1 si al menos una de sus preguntas tiene uno de esos códigos. El backend
 * escribe en `variables[base]` la expresión `alguna(V1,V2,...)`; aquí se arma el
 * borrador del editor, se valida y se construye la fila que se guarda.
 *
 * Lógica pura: `IndicadorCompuestoEditor.tsx` sólo pinta lo que este módulo decide.
 */

import type {
  Armonizacion,
  ConteosCompuesto,
  Derivada,
  DerivadaBase,
  EquivalenciaFila,
  OpcionDeEscala,
  VariableDeBase,
} from "../../api/equivalencias";
import type { PanelDeclarado } from "../../lib/navegacion/paneles";
import { aFilasEditor, type FilaEditor } from "./equivalenciasEditorModel";
import { filtrarPreguntas } from "./preguntaEquivalenteModel";
import { formatoConteo } from "../../lib/formatoNumero";

// ---- Panel direccionable ----------------------------------------------------

/**
 * `?panel=indicador-compuesto` abre uno nuevo; con `&foco=<ref>` (el `id` del
 * bloque o la posición en la declaración guardada) edita ese.
 */
export const PANEL_INDICADOR_COMPUESTO: PanelDeclarado = {
  id: "indicador-compuesto",
  label: "Indicador compuesto",
  clase: "sideover",
};

// ---- Expresión y lectura ----------------------------------------------------

/** Expresión canónica que el backend materializa como columna, en el orden declarado. */
export function expresionAlguna(variables: readonly string[]): string {
  return `alguna(${variables.join(",")})`;
}

/** Variables de una expresión `alguna(...)`, o `null` si no lo es. */
export function variablesDeExpresion(expresion: string | undefined): string[] | null {
  const m = /^\s*alguna\((.*)\)\s*$/.exec(expresion ?? "");
  if (!m) return null;
  return m[1].split(",").map((v) => v.trim()).filter(Boolean);
}

export function esCompuesta(fila: Pick<EquivalenciaFila, "derivada">): boolean {
  return Boolean(fila.derivada);
}

/**
 * Componentes de una base. Si la derivada no nombra la base pero la expresión
 * sí, se lee de la expresión (sin códigos: no viajan en ella).
 */
export function componentesDeBase(
  fila: Pick<EquivalenciaFila, "derivada" | "variables">,
  base: string,
): DerivadaBase | null {
  const declarada = fila.derivada?.por_base[base];
  if (declarada && declarada.variables.length > 0) return declarada;
  const deExpresion = variablesDeExpresion(fila.variables[base]);
  return deExpresion && deExpresion.length > 0 ? { variables: deExpresion, codigos: [] } : null;
}

/** «Alguna de: P28_1, P28_2 · código 1». Nunca la expresión cruda. */
export function textoComponentes(c: DerivadaBase): string {
  const preguntas = `Alguna de: ${c.variables.join(", ")}`;
  if (c.codigos.length === 0) return preguntas;
  return `${preguntas} · ${c.codigos.length === 1 ? "código" : "códigos"} ${c.codigos.join(", ")}`;
}

/**
 * Línea de conteos de una base, con lo guardado: «Sí 120 · No 80 · Sin dato 5».
 * Si falta una componente en los datos, dice cuál.
 */
export function textoConteos(c: ConteosCompuesto, base: string): string {
  if (c.tipo === "conteos") {
    return `Sí ${formatoConteo(c.n_si)} · No ${formatoConteo(c.n_no)} · Sin dato ${formatoConteo(c.n_sin_dato)}`;
  }
  if (c.variables.length === 0) return `Falta una de sus preguntas en los datos de ${base}.`;
  return c.variables.length === 1
    ? `Falta ${c.variables[0]} en los datos de ${base}.`
    : `Faltan ${c.variables.join(", ")} en los datos de ${base}.`;
}

/**
 * Rótulo de la variable de una base en la cabecera de la armonización: los
 * componentes legibles si la fila es compuesta, nunca la expresión `alguna(...)`.
 */
export function rotuloDeVariable(
  fila: Pick<EquivalenciaFila, "derivada" | "variables">,
  base: string,
): string {
  const c = esCompuesta(fila) ? componentesDeBase(fila, base) : null;
  return c ? textoComponentes(c) : `variable ${fila.variables[base] ?? ""}`;
}

// ---- Códigos ----------------------------------------------------------------

/** «1, 2 3» → ["1", "2", "3"], sin repetir. */
export function parsearCodigos(texto: string): string[] {
  const out: string[] = [];
  for (const c of texto.split(/[\s,;]+/)) {
    const t = c.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export function textoDeCodigos(codigos: readonly string[]): string {
  return codigos.join(", ");
}

/** Agrega el código si no está y lo quita si está. */
export function alternarCodigo(texto: string, codigo: string): string {
  const actuales = parsearCodigos(texto);
  return textoDeCodigos(
    actuales.includes(codigo) ? actuales.filter((c) => c !== codigo) : [...actuales, codigo],
  );
}

// ---- Borrador ---------------------------------------------------------------

export type BaseBorradorCompuesto = {
  variables: string[];
  /** Lo que la persona escribe; se parsea al validar y al guardar. */
  codigosTexto: string;
};

export type BorradorCompuesto = {
  etiqueta: string;
  seccion: string;
  porBase: Record<string, BaseBorradorCompuesto>;
};

export const CODIGOS_POR_DEFECTO = "1";

export function borradorCompuestoDesde(
  fila: EquivalenciaFila | null,
  bases: readonly string[],
): BorradorCompuesto {
  const porBase: Record<string, BaseBorradorCompuesto> = {};
  for (const base of bases) {
    const c = fila ? componentesDeBase(fila, base) : null;
    porBase[base] = {
      variables: c ? [...c.variables] : [],
      codigosTexto: c && c.codigos.length ? textoDeCodigos(c.codigos) : CODIGOS_POR_DEFECTO,
    };
  }
  return {
    etiqueta: fila?.etiqueta_estandar ?? "",
    seccion: fila?.seccion ?? "",
    porBase,
  };
}

export type AccionCompuesto =
  | { tipo: "etiqueta"; valor: string }
  | { tipo: "seccion"; valor: string }
  | { tipo: "agregar"; base: string; variable: string }
  | { tipo: "quitar"; base: string; variable: string }
  | { tipo: "codigos"; base: string; valor: string }
  | { tipo: "alternar-codigo"; base: string; codigo: string };

function conBase(
  b: BorradorCompuesto,
  base: string,
  cambio: (actual: BaseBorradorCompuesto) => BaseBorradorCompuesto,
): BorradorCompuesto {
  const actual = b.porBase[base] ?? { variables: [], codigosTexto: CODIGOS_POR_DEFECTO };
  return { ...b, porBase: { ...b.porBase, [base]: cambio(actual) } };
}

export function reducirCompuesto(b: BorradorCompuesto, a: AccionCompuesto): BorradorCompuesto {
  switch (a.tipo) {
    case "etiqueta":
      return { ...b, etiqueta: a.valor };
    case "seccion":
      return { ...b, seccion: a.valor };
    case "agregar":
      return conBase(b, a.base, (x) =>
        !a.variable || x.variables.includes(a.variable) ? x : { ...x, variables: [...x.variables, a.variable] });
    case "quitar":
      return conBase(b, a.base, (x) => ({ ...x, variables: x.variables.filter((v) => v !== a.variable) }));
    case "codigos":
      return conBase(b, a.base, (x) => ({ ...x, codigosTexto: a.valor }));
    case "alternar-codigo":
      return conBase(b, a.base, (x) => ({ ...x, codigosTexto: alternarCodigo(x.codigosTexto, a.codigo) }));
  }
}

/** Bases con al menos una pregunta elegida, en el orden de `bases`. */
export function basesDeclaradas(b: BorradorCompuesto, bases: readonly string[]): string[] {
  return bases.filter((base) => (b.porBase[base]?.variables.length ?? 0) > 0);
}

export function validarCompuesto(b: BorradorCompuesto, bases: readonly string[]): string[] {
  const errores: string[] = [];
  if (!b.etiqueta.trim()) errores.push("Falta el nombre estándar.");
  const declaradas = basesDeclaradas(b, bases);
  if (declaradas.length === 0) errores.push("Elige al menos una pregunta en una base.");
  for (const base of declaradas) {
    if (parsearCodigos(b.porBase[base].codigosTexto).length === 0) {
      errores.push(`Falta al menos un código «sí» en ${base}.`);
    }
  }
  return errores;
}

// ---- Fila que se guarda -----------------------------------------------------

export const ESCALA_SI_NO = [
  { codigo: "1", etiqueta: "Sí" },
  { codigo: "0", etiqueta: "No" },
] as const;

/**
 * Armonización de la fila: la escala «Sí/No» y cada base declarada comparable
 * con mapa identidad. Al editar se conserva lo ya decidido (etiquetas
 * renombradas, una base marcada no comparable); una base nueva entra comparable
 * y una que dejó de tener preguntas sale.
 */
export function armonizacionDeCompuesto(
  declaradas: readonly string[],
  previa: Armonizacion | null | undefined,
): Armonizacion {
  const escala = previa && previa.escala.length > 0
    ? previa.escala.map((c) => ({ ...c }))
    : ESCALA_SI_NO.map((c) => ({ ...c }));
  const por_base: Armonizacion["por_base"] = {};
  for (const base of declaradas) {
    por_base[base] = previa?.por_base[base] ?? { comparable: true, mapa: {} };
  }
  return { escala, por_base };
}

/**
 * La fila tal como se envía. Una base sin preguntas queda fuera de `variables`,
 * de la derivada y de la armonización: no se declara, así que no es comparable.
 */
export function filaDeCompuesto(
  b: BorradorCompuesto,
  bases: readonly string[],
  previa: EquivalenciaFila | null,
): EquivalenciaFila {
  const declaradas = basesDeclaradas(b, bases);
  const variables: Record<string, string> = {};
  const por_base: Derivada["por_base"] = {};
  for (const base of declaradas) {
    const x = b.porBase[base];
    variables[base] = expresionAlguna(x.variables);
    por_base[base] = { variables: [...x.variables], codigos: parsearCodigos(x.codigosTexto) };
  }
  const { sugerida: _sugerida, ...resto } = previa ?? { seccion: "", etiqueta_estandar: "", variables: {}, cantidad: 0 };
  return {
    ...resto,
    seccion: b.seccion.trim(),
    etiqueta_estandar: b.etiqueta.trim(),
    variables,
    cantidad: declaradas.length,
    derivada: { regla: "alguna", por_base },
    armonizacion: armonizacionDeCompuesto(declaradas, previa?.armonizacion),
  };
}

/** Declaración guardada con la fila reemplazada (`indice`) o agregada al final (`null`). */
export function filasConCompuesto(
  guardadas: readonly EquivalenciaFila[],
  indice: number | null,
  fila: EquivalenciaFila,
): EquivalenciaFila[] {
  if (indice === null || indice < 0 || indice >= guardadas.length) return [...guardadas, fila];
  return guardadas.map((f, i) => (i === indice ? fila : f));
}

/**
 * Lleva al editor de la tabla la fila que el panel acaba de guardar, sin pisar
 * los cambios pendientes de otras filas: se reemplaza la fila con ese
 * `indice_declarado` o, si es nueva, se agrega al final.
 */
export function fusionarCompuestoGuardado(
  prev: readonly FilaEditor[],
  guardadas: readonly EquivalenciaFila[],
  indice: number,
): FilaEditor[] {
  const guardada = guardadas[indice];
  if (!guardada) return [...prev];
  const [nueva] = aFilasEditor([guardada]);
  const fila: FilaEditor = { ...nueva, indice_declarado: indice };
  const posicion = prev.findIndex((f) => f.indice_declarado === indice);
  if (posicion < 0) return [...prev, fila];
  return prev.map((f, i) => (i === posicion ? { ...fila, id: f.id } : f));
}

// ---- Búsqueda de preguntas --------------------------------------------------

export type ResultadosBusqueda = {
  visibles: VariableDeBase[];
  /** Cuántas más casan y no se muestran: se afina la búsqueda en vez de desplazar. */
  resto: number;
};

export const MAX_RESULTADOS = 8;

/** Preguntas que casan con lo escrito y todavía no están elegidas. Sin consulta, ninguna. */
export function resultadosBusqueda(
  opciones: readonly VariableDeBase[],
  consulta: string,
  elegidas: readonly string[],
  max = MAX_RESULTADOS,
): ResultadosBusqueda {
  if (!consulta.trim()) return { visibles: [], resto: 0 };
  const libres = filtrarPreguntas(opciones, consulta).filter((o) => !elegidas.includes(o.name));
  return { visibles: libres.slice(0, max), resto: Math.max(0, libres.length - max) };
}

/** Opciones de la primera pregunta elegida: la ayuda para escoger los códigos «sí». */
export function opcionesDeAyuda(
  opciones: readonly VariableDeBase[],
  variables: readonly string[],
): OpcionDeEscala[] {
  const primera = variables[0];
  if (!primera) return [];
  return opciones.find((o) => o.name === primera)?.opciones ?? [];
}
