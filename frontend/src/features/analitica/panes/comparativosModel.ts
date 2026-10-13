// Modelo puro de la pestaña Comparativos (contrato E4-E7, R4).
//
// La pestaña tabula la serie de mediciones armonizada en Carga › Equivalencias.
// Aquí vive todo lo que no es presentación: qué filas de la matriz son
// candidatas, cómo se nombra cada período, el body que viaja a
// /api/analitica/armonizada/* y la acción que resuelve cada error del motor.
// El estado de la pestaña es UI efímera y se gobierna con un reducer, no con un
// racimo de useState.

import type {
  ComparativoAusente,
  ComparativoAviso,
  ComparativoOmitida,
  ComparativoBody,
  ComparativoNa,
  ComparativoRefFila,
  ComparativoResultado,
  ComparativoSinMapa,
  ComparativoTipo,
} from "../../../api/analitica";
import type { EquivalenciasEstado } from "../../../api/equivalencias";
import { serializarDireccion } from "../../../lib/navegacion/direccion";
import { rotuloPorDefecto } from "../../carga/nombreDeSerie";
import { rotuloDeMatriz } from "../../../lib/rotuloDeMatriz";

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
  /** Mediciones de la serie en las que la fila no declara variable. */
  basesSinVariable: string[];
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
      basesSinVariable: [],
      nCategorias: arm.escala.length,
      seleccionable: false,
    });
    const ultima = out[out.length - 1];
    // Una base sin entrada en `por_base` es «n.c.» (contrato E4-E7). Sólo cuentan
    // las mediciones de la serie: una base fuera de ella no se tabula. Tampoco
    // cuenta una base sin variable declarada: no hay columna que tabular y el
    // motor la publica como «n.c.» aunque su armonización diga comparable.
    const conVariable = (base: string) => (fila.variables?.[base] ?? "").trim() !== "";
    ultima.basesComparables = Object.entries(arm.por_base)
      .filter(([base, entrada]) => entrada.comparable && conVariable(base) && (serie.length === 0 || serie.includes(base)))
      .map(([base]) => base);
    ultima.basesSinVariable = (serie.length ? serie : Object.keys(arm.por_base)).filter((base) => !conVariable(base));
    ultima.seleccionable = ultima.basesComparables.length > 0;
  });
  return out;
}

/** Orden de la serie: el declarado en la matriz y, si no hay, el de sus bases. */
export function periodosDeSerie(estado: EquivalenciasEstado | null): string[] {
  const declarados = (estado?.armonizacion_periodos ?? []).filter(Boolean);
  return declarados.length ? declarados : (estado?.bases ?? []).filter(Boolean);
}

/**
 * Espejo de `.armz_rotulos()`: el año del nombre de la base, si lo tiene, o el
 * nombre entero. Vive en `nombreDeSerie` porque Equivalencias decide con él
 * cómo nombrar la serie, y las dos superficies tienen que decir lo mismo.
 */
export { rotuloPorDefecto };

/**
 * Rótulos por defecto de toda la serie. El año sólo se usa si nombra a UNA
 * base: con «encuesta_2024_docentes» y «encuesta_2024_estudiantes» las dos
 * columnas se titularían «2024» y la tabla no diría cuál es cuál, así que
 * esas bases conservan su nombre entero.
 */
export function rotulosPorDefecto(periodos: readonly string[]): Record<string, string> {
  const cortos = periodos.map((p) => rotuloPorDefecto(p));
  return Object.fromEntries(
    periodos.map((p, i) => {
      const repetido = cortos.filter((c) => c === cortos[i]).length > 1;
      return [p, repetido ? p : cortos[i]];
    }),
  );
}

/** Rótulos que titulan a más de una medición. Dos columnas iguales no se distinguen. */
export function rotulosRepetidos(
  rotulos: Record<string, string>,
  periodos: readonly string[],
): string[] {
  const vistos = new Map<string, number>();
  for (const base of periodos) {
    const r = (rotulos[base] ?? "").trim() || base;
    vistos.set(r, (vistos.get(r) ?? 0) + 1);
  }
  return [...vistos.entries()].filter(([, n]) => n > 1).map(([r]) => r);
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
    rotulos: rotulosPorDefecto(periodos),
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
  /** Elige o suelta de una vez las preguntas de un grupo (una sección, un filtro). */
  | { tipo: "elegir-preguntas"; claves: string[]; valor: boolean }
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
    case "elegir-preguntas": {
      const sin = ui.preguntas.filter((c) => !accion.claves.includes(c));
      return { ...ui, preguntas: accion.valor ? [...sin, ...accion.claves] : sin };
    }
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
  sin_variable: "Sin variable",
  "variable_ausente:excluida": "Variable excluida en Analítica",
  "variable_ausente:no_esta_en_la_base": "Variable que no está en la base",
  // Un `variable_ausente` sin motivo conocido conserva un rótulo honesto.
  variable_ausente: "Variable que no está en los datos",
};

// ---- Preguntas omitidas ------------------------------------------------------

/**
 * Por qué una pregunta quedó fuera del comparativo, en palabras llanas. Un
 * motivo que el cliente no conoce se muestra tal cual: nunca se oculta.
 */
const MOTIVO_OMISION: Partial<Record<string, string>> = {
  sin_variable: "No tiene variable en la base que se iba a tabular",
  mapa_roto: "Su armonización apunta a respuestas que la escala común no tiene",
  select_multiple: "Es de respuesta múltiple y el comparativo sólo tabula preguntas de una respuesta",
  "variable_ausente:excluida": "Variable excluida en Analítica",
  "variable_ausente:no_esta_en_la_base": "Variable que no está en la base",
  variable_ausente: "Variable que no está en los datos",
};

/**
 * Motivo en palabras llanas. `variable_ausente` se precisa con los motivos de
 * sus `ausentes`: si todas están excluidas en Analítica lo dice así, si alguna
 * falta en la base, eso.
 */
export function textoMotivoOmision(
  motivo: string | undefined,
  ausentes: readonly Pick<ComparativoAusente, "motivo">[] = [],
): string {
  const m = (motivo ?? "").trim();
  if (!m) return "Motivo no informado";
  if (m === "variable_ausente" && ausentes.length) {
    const sub = ausentes.every((a) => a.motivo === "excluida") ? "excluida" : "no_esta_en_la_base";
    return MOTIVO_OMISION[`${m}:${sub}`] ?? m;
  }
  return MOTIVO_OMISION[m] ?? m;
}

/**
 * El detalle de una omisión en una sola frase: el texto del motor, las
 * variables ausentes por base y, si el motor no dio texto, los códigos.
 */
export function detalleDeOmitida(
  o: Pick<ComparativoOmitida, "detalle" | "ausentes" | "codigos">,
  periodos: ComparativoResultado["periodos"],
): string {
  const partes: string[] = [];
  if (o.detalle) partes.push(o.detalle);
  for (const a of o.ausentes) partes.push(`${rotuloDe(a.base, periodos)}: ${textoAusente(a)}.`);
  if (!o.detalle && o.codigos.length) partes.push(`Códigos: ${o.codigos.join(", ")}.`);
  return partes.join(" ");
}

/** Por qué falta la variable en una base, como frase. */
export function textoAusente(a: Pick<ComparativoAusente, "variable" | "motivo">): string {
  return a.motivo === "excluida"
    ? `La variable ${a.variable} está excluida en Analítica para esta base`
    : `La variable ${a.variable} no está en los datos de esta base`;
}

/**
 * Lo que quedó fuera del libro. La fuente es `resumen.omitidas`. Un motor que
 * todavía no la manda sólo avisaba con `pregunta_omitida`/`cruce_omitido`: se
 * reconstruye desde esos avisos para no perder la omisión.
 */
export function omitidasDe(resumen: Pick<ComparativoResultado["resumen"], "omitidas" | "avisos">): ComparativoOmitida[] {
  if (resumen.omitidas.length) return resumen.omitidas;
  return resumen.avisos
    .filter((a) => a.tipoOriginal === "pregunta_omitida" || a.tipoOriginal === "cruce_omitido")
    .map((a) => ({
      fila: a.fila ?? "",
      titulo: a.fila ?? "",
      tipo: a.tipoOriginal === "cruce_omitido" ? "cruce" : "pregunta",
      motivo: a.motivo ?? "",
      base: a.base ?? "",
      codigos: a.codigos ?? [],
      detalle: a.mensaje,
      ausentes: [],
    }));
}

/** Los demás avisos: las omisiones van en su propio bloque, no mezcladas. */
export function avisosGenerales(avisos: readonly ComparativoAviso[]): ComparativoAviso[] {
  return avisos.filter((a) => a.tipoOriginal !== "pregunta_omitida" && a.tipoOriginal !== "cruce_omitido");
}

/** Abre el editor de armonización sobre la fila omitida. */
export function direccionDeOmitida(o: Pick<ComparativoOmitida, "fila">): string {
  return o.fila
    ? serializarDireccion({
      modulo: "procesamiento",
      seccion: "carga",
      pestana: "equivalencias",
      panel: "armonizacion",
      foco: o.fila,
    })
    : DIRECCION_EQUIVALENCIAS;
}

/** «2024» o «2024 (Sexo)»: dónde no tiene variable una pregunta, con sus rótulos. */
export function celdaSinVariable(
  p: Pick<Pregunta, "sin_variable" | "variable_ausente">,
  periodos: ComparativoResultado["periodos"],
): string[] {
  const sin = p.sin_variable.map((s) => {
    const rotulo = rotuloDe(s.base, periodos);
    return s.fila ? `${rotulo} (${s.fila})` : rotulo;
  });
  // La variable está declarada pero no en los datos: se dice cuál y por qué.
  const ausentes = p.variable_ausente.map((a) => {
    const rotulo = rotuloDe(a.base, periodos);
    return `${rotulo}: ${textoAusente(a)}`;
  });
  return [...sin, ...ausentes];
}

/** Rótulo del tipo de aviso. Un tipo que el cliente no conoce se muestra tal cual, nunca se oculta. */
export function etiquetaDeAviso(aviso: ComparativoAviso): string {
  const conMotivo = aviso.motivo ? ETIQUETA_AVISO[`${aviso.tipoOriginal}:${aviso.motivo}`] : undefined;
  return conMotivo ?? ETIQUETA_AVISO[aviso.tipoOriginal] ?? (aviso.tipoOriginal || "Aviso");
}

/** Dónde se resuelve un aviso, si tiene dónde. */
export function accionParaAviso(aviso: ComparativoAviso): AccionDeError | null {
  if (aviso.tipo === "peso_ignorado") return { etiqueta: "Ir a Ponderación", href: DIRECCION_PONDERACION };
  // Una variable que no está en la base se revisa en la fila de Equivalencias.
  // Una excluida en Analítica no tiene superficie a la que llevar: sólo se dice.
  if (aviso.tipo === "variable_ausente" && aviso.motivo === "no_esta_en_la_base") {
    return { etiqueta: "Revisar en Equivalencias", href: direccionDeOmitida({ fila: aviso.fila ?? "" }) };
  }
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

// ---- Cobertura por medición y agrupación de la lista ---------------------------

export type EstadoCobertura = "comparable" | "sin-variable" | "no-comparable";

export type CoberturaMedicion = { base: string; rotulo: string; estado: EstadoCobertura };

/**
 * Estado de la fila en cada medición de la serie, en el orden de la serie. Es lo
 * que la tarjeta pinta como un chip por medición: con siete bases, una frase
 * «comparable en 5 de 7, sin variable en A y B» no dice dónde está cada una.
 */
export function coberturaPorMedicion(
  fila: Pick<FilaArmonizada, "basesComparables" | "basesSinVariable">,
  periodos: readonly string[],
  rotulos: Record<string, string>,
): CoberturaMedicion[] {
  return periodos.map((base) => ({
    base,
    rotulo: (rotulos[base] ?? "").trim() || rotuloPorDefecto(base),
    estado: fila.basesComparables.includes(base)
      ? "comparable"
      : fila.basesSinVariable.includes(base)
        ? "sin-variable"
        : "no-comparable",
  }));
}

export const TEXTO_COBERTURA: Record<EstadoCobertura, string> = {
  comparable: "comparable",
  "sin-variable": "sin variable",
  "no-comparable": "no comparable",
};

export type GrupoDeFilas = { clave: string; titulo: string; filas: FilaArmonizada[] };

/** Nombre legible de una sección del formulario: «pag3» es «Página 3 del formulario». */
export function tituloDeSeccion(seccion: string): string {
  const s = seccion.trim();
  if (!s) return "Sin sección";
  const m = /^pag(?:ina|e)?\s*_?(\d+)$/i.exec(s);
  return m ? `Página ${Number(m[1])} del formulario` : rotuloDeMatriz(s);
}

/** Estado de la casilla de una sección: todas, ninguna o algunas elegidas. */
export type EstadoCasilla = "todas" | "ninguna" | "algunas";

export function estadoDeCasilla(claves: readonly string[], elegidas: readonly string[]): EstadoCasilla {
  const n = claves.filter((c) => elegidas.includes(c)).length;
  if (n === 0) return "ninguna";
  return n === claves.length ? "todas" : "algunas";
}

/** Agrupa por sección conservando el orden de la matriz: la primera aparición manda. */
export function agruparPorSeccion(filas: readonly FilaArmonizada[]): GrupoDeFilas[] {
  const grupos = new Map<string, GrupoDeFilas>();
  for (const fila of filas) {
    const clave = fila.seccion.trim();
    const grupo = grupos.get(clave) ?? { clave, titulo: tituloDeSeccion(clave), filas: [] };
    grupo.filas.push(fila);
    grupos.set(clave, grupo);
  }
  return [...grupos.values()];
}

function plano(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Filtra por texto en la etiqueta o la sección, sin distinguir tildes ni mayúsculas. */
export function filtrarFilas(filas: readonly FilaArmonizada[], consulta: string): FilaArmonizada[] {
  const q = plano(consulta.trim());
  if (!q) return [...filas];
  return filas.filter((f) => plano(`${f.etiqueta} ${f.seccion} ${tituloDeSeccion(f.seccion)}`).includes(q));
}

/** «12 elegidas de 74». Sólo cuentan las que se pueden elegir. */
export function contadorElegidas(filas: readonly FilaArmonizada[], elegidas: readonly string[]): string {
  const seleccionables = filas.filter((f) => f.seleccionable);
  const n = seleccionables.filter((f) => elegidas.includes(f.clave)).length;
  return `${n} ${n === 1 ? "elegida" : "elegidas"} de ${seleccionables.length}`;
}

/** Lo que la tarjeta dice de la cobertura de la fila en la serie. */
export function detalleCobertura(
  fila: Pick<FilaArmonizada, "basesComparables" | "basesSinVariable" | "nCategorias">,
  totalPeriodos: number,
  rotulos: Record<string, string>,
): string {
  const partes = [
    `comparable en ${fila.basesComparables.length} de ${cantidad(totalPeriodos, "medición", "mediciones")}`,
    cantidad(fila.nCategorias, "categoría", "categorías"),
  ];
  if (fila.basesSinVariable.length) {
    const mediciones = fila.basesSinVariable.map((b) => (rotulos[b] ?? "").trim() || rotuloPorDefecto(b));
    partes.push(`sin variable en ${unirLista(mediciones)}`);
  }
  return partes.join(", ");
}

function unirLista(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function cantidad(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function formatoBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}
