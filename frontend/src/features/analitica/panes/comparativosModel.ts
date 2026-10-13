// Modelo puro de la pestaña Comparativos (contrato E4-E7, R4).
//
// La pestaña tabula la serie de mediciones armonizada en Carga › Equivalencias.
// Aquí vive todo lo que no es presentación: qué filas de la matriz son
// candidatas, cómo se nombra cada período, el body que viaja a
// /api/analitica/armonizada/* y la acción que resuelve cada error del motor.
// El estado de la pestaña es UI efímera y se gobierna con un reducer, no con un
// racimo de useState.

import type {
  ComparativoAviso,
  ComparativoBody,
  ComparativoNa,
  ComparativoRefFila,
  ComparativoResultado,
  ComparativoSinMapa,
  ComparativoTipo,
} from "../../../api/analitica";
import type { EquivalenciasEstado } from "../../../api/equivalencias";
import { serializarDireccion } from "../../../lib/navegacion/direccion";

// ---- Filas candidatas -------------------------------------------------------

export type FilaArmonizada = {
  /** Clave estable dentro de la pestaña: el índice de la fila en la matriz. */
  clave: string;
  /** Lo que viaja en `filas` o `cruces`: id si lo tiene, si no el índice. */
  ref: ComparativoRefFila;
  /** Lo que viaja como clave de `notas_pregunta`: id o etiqueta estándar. */
  claveNota: string;
  etiqueta: string;
  seccion: string;
  /** Mediciones de la serie en las que la fila es comparable. */
  basesComparables: string[];
  nCategorias: number;
  /** Comparable en al menos una medición de la serie. Si no, no se ofrece. */
  seleccionable: boolean;
};

export function filasArmonizadas(estado: EquivalenciasEstado | null): FilaArmonizada[] {
  const filas = estado?.filas ?? [];
  const serie = periodosDeSerie(estado);
  const out: FilaArmonizada[] = [];
  filas.forEach((fila, indice) => {
    const arm = fila.armonizacion;
    if (!arm) return;
    const id = (fila.id ?? "").trim();
    const etiqueta = fila.etiqueta_estandar.trim() || fila.enunciado?.trim() || `Fila ${indice + 1}`;
    out.push({
      clave: String(indice),
      // Un id puramente numérico se leería como índice en el backend.
      ref: id && !/^[0-9]+$/.test(id) ? id : indice,
      claveNota: id || fila.etiqueta_estandar.trim(),
      etiqueta,
      seccion: fila.seccion.trim(),
      basesComparables: [],
      nCategorias: arm.escala.length,
      seleccionable: false,
    });
    const ultima = out[out.length - 1];
    // Una base sin entrada en `por_base` es «n.c.» (contrato E4-E7). Sólo cuentan
    // las mediciones de la serie: una base fuera de ella no se tabula.
    ultima.basesComparables = Object.entries(arm.por_base)
      .filter(([base, entrada]) => entrada.comparable && (serie.length === 0 || serie.includes(base)))
      .map(([base]) => base);
    ultima.seleccionable = ultima.basesComparables.length > 0;
  });
  return out;
}

/** Orden de la serie: el declarado en la matriz y, si no hay, el de sus bases. */
export function periodosDeSerie(estado: EquivalenciasEstado | null): string[] {
  const declarados = (estado?.armonizacion_periodos ?? []).filter(Boolean);
  return declarados.length ? declarados : (estado?.bases ?? []).filter(Boolean);
}

/** Espejo de `.armz_rotulos()`: el año del nombre de la base, si lo tiene. */
export function rotuloPorDefecto(base: string): string {
  return base.match(/(19|20)[0-9]{2}/)?.[0] ?? base;
}

/** Un estudio con menos de dos bases no tiene serie que comparar. */
export function comparativosDisponibles(nBases: number | null | undefined): boolean {
  return (nBases ?? 0) >= 2;
}

export type MotivoVacio = "sin-equivalencias" | "sin-armonizadas" | "sin-serie";

/** Por qué la pestaña no puede generar nada todavía, o null si puede. */
export function motivoVacio(estado: EquivalenciasEstado | null): MotivoVacio | null {
  if (!estado || !estado.declarada || (estado.filas ?? []).length === 0) return "sin-equivalencias";
  if (filasArmonizadas(estado).length === 0) return "sin-armonizadas";
  if (periodosDeSerie(estado).length < 2) return "sin-serie";
  return null;
}

// ---- Estado de la pestaña ---------------------------------------------------

export type ErrorComparativo = { mensaje: string; codigo: string | null };

export type ComparativosUi = {
  /** Claves de las preguntas elegidas. Arranca con todas. */
  preguntas: string[];
  /** Claves de las variables de cruce. */
  cruces: string[];
  rotulos: Record<string, string>;
  notasPregunta: Record<string, string>;
  /** Una nota por línea. */
  notasGenerales: string;
  enviando: ComparativoTipo | null;
  job: { id: string; tipo: ComparativoTipo } | null;
  error: ErrorComparativo | null;
  resultado: { tipo: ComparativoTipo; datos: ComparativoResultado } | null;
};

export function estadoInicial(filas: FilaArmonizada[], periodos: string[]): ComparativosUi {
  return {
    preguntas: filas.filter((f) => f.seleccionable).map((f) => f.clave),
    cruces: [],
    rotulos: Object.fromEntries(periodos.map((p) => [p, rotuloPorDefecto(p)])),
    notasPregunta: {},
    notasGenerales: "",
    enviando: null,
    job: null,
    error: null,
    resultado: null,
  };
}

export type AccionComparativos =
  | { tipo: "reiniciar"; filas: FilaArmonizada[]; periodos: string[] }
  | { tipo: "alternar-pregunta"; clave: string }
  | { tipo: "todas-las-preguntas"; claves: string[] }
  | { tipo: "ninguna-pregunta" }
  | { tipo: "alternar-cruce"; clave: string }
  | { tipo: "rotulo"; base: string; valor: string }
  | { tipo: "nota-pregunta"; clave: string; valor: string }
  | { tipo: "notas-generales"; valor: string }
  | { tipo: "enviando"; comparativo: ComparativoTipo }
  | { tipo: "job"; comparativo: ComparativoTipo; id: string }
  | { tipo: "listo"; datos: ComparativoResultado }
  | { tipo: "fallo"; error: ErrorComparativo }
  | { tipo: "cancelado" };

function alternar(lista: string[], clave: string): string[] {
  return lista.includes(clave) ? lista.filter((c) => c !== clave) : [...lista, clave];
}

export function comparativosReducer(ui: ComparativosUi, accion: AccionComparativos): ComparativosUi {
  switch (accion.tipo) {
    case "reiniciar":
      return estadoInicial(accion.filas, accion.periodos);
    case "alternar-pregunta":
      return { ...ui, preguntas: alternar(ui.preguntas, accion.clave) };
    case "todas-las-preguntas":
      return { ...ui, preguntas: [...accion.claves] };
    case "ninguna-pregunta":
      return { ...ui, preguntas: [] };
    case "alternar-cruce":
      return { ...ui, cruces: alternar(ui.cruces, accion.clave) };
    case "rotulo":
      return { ...ui, rotulos: { ...ui.rotulos, [accion.base]: accion.valor } };
    case "nota-pregunta":
      return { ...ui, notasPregunta: { ...ui.notasPregunta, [accion.clave]: accion.valor } };
    case "notas-generales":
      return { ...ui, notasGenerales: accion.valor };
    case "enviando":
      return { ...ui, enviando: accion.comparativo, error: null };
    case "job":
      return { ...ui, enviando: null, job: { id: accion.id, tipo: accion.comparativo } };
    case "listo":
      return ui.job
        ? { ...ui, job: null, resultado: { tipo: ui.job.tipo, datos: accion.datos } }
        : ui;
    case "fallo":
      return { ...ui, enviando: null, job: null, error: accion.error };
    case "cancelado":
      return { ...ui, enviando: null, job: null };
  }
}

// ---- Body ------------------------------------------------------------------

/** Preguntas que entran a la tabla: en cruces, una variable de cruce no se cruza consigo misma. */
export function preguntasEfectivas(ui: ComparativosUi, tipo: ComparativoTipo): string[] {
  return tipo === "cruces" ? ui.preguntas.filter((c) => !ui.cruces.includes(c)) : ui.preguntas;
}

/** Por qué no se puede lanzar ese comparativo, o null si se puede. */
export function bloqueoDeGeneracion(ui: ComparativosUi, tipo: ComparativoTipo): string | null {
  if (tipo === "cruces" && ui.cruces.length === 0) {
    return "Para el comparativo de cruces, elige al menos una variable de cruce.";
  }
  if (preguntasEfectivas(ui, tipo).length === 0) {
    return tipo === "cruces"
      ? "Para el comparativo de cruces, elige al menos una pregunta que no sea variable de cruce."
      : "Elige al menos una pregunta.";
  }
  return null;
}

export function construirBody(
  ui: ComparativosUi,
  tipo: ComparativoTipo,
  filas: FilaArmonizada[],
  periodos: string[],
): ComparativoBody {
  const porClave = new Map(filas.map((f) => [f.clave, f]));
  const refs = (claves: string[]) =>
    filas.filter((f) => f.seleccionable && claves.includes(f.clave)).map((f) => f.ref);
  const efectivas = preguntasEfectivas(ui, tipo);

  const rotulos: Record<string, string> = {};
  for (const base of periodos) {
    const valor = (ui.rotulos[base] ?? "").trim();
    if (valor) rotulos[base] = valor;
  }

  const notas: Record<string, string> = {};
  for (const [clave, texto] of Object.entries(ui.notasPregunta)) {
    const fila = porClave.get(clave);
    const valor = texto.trim();
    if (fila && fila.claveNota && valor && efectivas.includes(clave)) notas[fila.claveNota] = valor;
  }

  const generales = ui.notasGenerales
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean);

  return {
    filas: refs(efectivas),
    ...(tipo === "cruces" ? { cruces: refs(ui.cruces) } : {}),
    ...(Object.keys(rotulos).length ? { rotulos_periodos: rotulos } : {}),
    ...(Object.keys(notas).length ? { notas_pregunta: notas } : {}),
    ...(generales.length ? { notas_generales: generales } : {}),
  };
}

// ---- Errores y su acción -----------------------------------------------------

const CODIGO_AL_FINAL = /\s·\s((?:E|HTTP)_[A-Z0-9_]+)\s*$/;

/** `ApiError` trae `code`; un error del job sólo trae el mensaje con el código al final. */
export function errorDesde(e: unknown): ErrorComparativo {
  const crudo = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const codigoProp = typeof e === "object" && e !== null && "code" in e && typeof e.code === "string"
    ? e.code
    : null;
  const match = crudo.match(CODIGO_AL_FINAL);
  const codigo = codigoProp ?? match?.[1] ?? null;
  const mensaje = (match ? crudo.slice(0, match.index) : crudo).trim()
    || "El comparativo no se pudo generar. Reintenta y, si se repite, revisa la matriz de equivalencias.";
  return { mensaje, codigo };
}

export type AccionDeError = { etiqueta: string; href: string };

export const DIRECCION_EQUIVALENCIAS = serializarDireccion({
  modulo: "procesamiento",
  seccion: "carga",
  pestana: "equivalencias",
});

export const DIRECCION_PONDERACION = serializarDireccion({
  modulo: "procesamiento",
  seccion: "analitica",
  pestana: "ponderacion",
});

export const DIRECCION_FUENTES = serializarDireccion({
  modulo: "procesamiento",
  seccion: "carga",
  pestana: "fuentes",
});

/** Dónde se resuelve cada error del motor, con su dirección canónica. */
export function accionParaError(codigo: string | null): AccionDeError | null {
  if (!codigo) return null;
  if (codigo === "E_ARMONIZADA_PESO_NO_DECLARADO" || codigo === "E_PONDERACION_COLUMNA_INEXISTENTE") {
    return { etiqueta: "Ir a Ponderación", href: DIRECCION_PONDERACION };
  }
  if (
    codigo === "E_ARMONIZADA_SIN_MATRIZ"
    || codigo === "E_ARMONIZADA_PERIODOS"
    // Una base hija repeat no puede ser período: se saca de la serie en Equivalencias.
    || codigo === "E_ARMONIZADA_PERIODO_REPEAT"
    || codigo === "E_ARMONIZADA_MAPA_ROTO"
    || codigo === "E_ARMONIZADA_SELECT_MULTIPLE"
    || codigo.startsWith("E_EQUIV_")
  ) {
    return { etiqueta: "Ir a Equivalencias", href: DIRECCION_EQUIVALENCIAS };
  }
  if (codigo === "E_NO_RP_DATA" || codigo === "E_ANALITICA_SOURCE_MISSING") {
    return { etiqueta: "Ir a Fuentes", href: DIRECCION_FUENTES };
  }
  return null;
}

// ---- Resultado --------------------------------------------------------------

const ETIQUETA_AVISO: Partial<Record<string, string>> = {
  ponderacion: "Ponderación",
  suma_pesos: "Suma de pesos",
  sin_mapa: "Sin correspondencia",
  nota_sin_pregunta: "Nota sin pregunta",
  peso_ignorado: "Peso ignorado",
};

/** Rótulo del tipo de aviso. Un tipo que el cliente no conoce se muestra tal cual, nunca se oculta. */
export function etiquetaDeAviso(aviso: ComparativoAviso): string {
  return ETIQUETA_AVISO[aviso.tipoOriginal] ?? (aviso.tipoOriginal || "Aviso");
}

/** Dónde se resuelve un aviso, si tiene dónde. */
export function accionParaAviso(aviso: ComparativoAviso): AccionDeError | null {
  if (aviso.tipo === "peso_ignorado") return { etiqueta: "Ir a Ponderación", href: DIRECCION_PONDERACION };
  return null;
}

/** Especiales sin destino de una medición, con su etiqueta cuando la hay: «98 No sabe». */
export function especialesSinMapa(s: ComparativoSinMapa): string[] {
  return s.codigos_especiales.map((codigo, i) => {
    const etiqueta = (s.etiquetas_especiales[i] ?? "").trim();
    return etiqueta && etiqueta !== codigo ? `${codigo} ${etiqueta}` : codigo;
  });
}

/** Casos sustantivos sin destino en la escala, sumados entre mediciones de una pregunta. */
export function totalSinMapa(pregunta: ComparativoResultado["resumen"]["preguntas"][number]): number {
  return pregunta.sin_mapa.reduce((total, s) => total + s.n_sin_mapa, 0);
}

/**
 * Lo que una celda del resumen puede afirmar. `items` vacío con `cubierto`
 * permite decir «Ninguna». Sin cobertura se dice «—»: el resumen no lo reporta.
 */
export type CeldaResumen = { items: string[]; cubierto: boolean };

type Pregunta = ComparativoResultado["resumen"]["preguntas"][number];

/**
 * n.a. del resumen. En el simple son los períodos sin respuestas sustantivas y
 * cubren la pregunta entera. En el de cruces sólo traen las categorías de cruce
 * sin casos, así que una lista vacía no prueba que no haya n.a.
 */
export function celdaNa(p: Pregunta, tipo: ComparativoTipo, periodos: ComparativoResultado["periodos"]): CeldaResumen {
  return { items: p.n_a.map((x) => describirNa(x, periodos)), cubierto: tipo === "frecuencias" };
}

/**
 * No ofrecidas: las de la pregunta siempre vienen. En el de cruces, las de las
 * variables de cruce sólo si el backend manda `no_ofrecidas_cruce`.
 */
export function celdaNoOfrecidas(
  p: Pregunta,
  tipo: ComparativoTipo,
  periodos: ComparativoResultado["periodos"],
): CeldaResumen {
  const codigos = (cods: string[]) => `${cods.length === 1 ? "código" : "códigos"} ${cods.join(", ")}`;
  const items = Object.entries(p.no_ofrecidas)
    .map(([base, cods]) => `${rotuloDe(base, periodos)}: ${codigos(cods)}`);
  if (tipo === "frecuencias") return { items, cubierto: true };
  if (p.no_ofrecidas_cruce === null) return { items, cubierto: false };
  for (const [cruce, porBase] of Object.entries(p.no_ofrecidas_cruce)) {
    for (const [base, cods] of Object.entries(porBase)) {
      items.push(`${cruce}, ${rotuloDe(base, periodos)}: ${codigos(cods)}`);
    }
  }
  return { items, cubierto: true };
}

/** «n.a.» legible: «2024» en el simple, «2024, Sexo: Mujer» en el de cruces. */
export function describirNa(na: ComparativoNa, periodos: ComparativoResultado["periodos"]): string {
  const rotulo = rotuloDe(na.periodo, periodos);
  if (!na.cruce) return rotulo;
  return na.categoria ? `${rotulo}, ${na.cruce}: ${na.categoria}` : `${rotulo}, ${na.cruce}`;
}

export function rotuloDe(base: string, periodos: ComparativoResultado["periodos"]): string {
  return periodos.find((p) => p.base === base)?.rotulo ?? base;
}

export function cantidad(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function formatoBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}
