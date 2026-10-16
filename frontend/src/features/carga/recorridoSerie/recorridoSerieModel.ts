// Recorrido de la serie: lógica pura.
//
// Un estudio con varias mediciones se arma en seis pasos que viven en lugares
// distintos (Fuentes, Variables de la base, Segmentos, Matriz, Ponderación,
// Comparativos). La banda responde de un vistazo «qué me falta y dónde se
// hace»: cada paso trae su estado, un texto corto y concreto, y el enlace a
// donde se resuelve. Todo sale de lecturas que la app ya hace; aquí sólo se
// decide.
//
// Regla de los textos (C2): con 2 o con 6 bases el paso mide lo mismo. Una
// lista por base nombra a lo sumo dos y cuenta el resto.

import type { BaseVariables } from "../../../api/baseVariables";
import type { EquivalenciaFila } from "../../../api/equivalencias";
import type { SegmentosEstado } from "../../../api/segmentos";
import { conNivel, serializarDireccion } from "../../../lib/navegacion/direccion";
import { formatoConteo } from "../../../lib/formatoNumero";
import {
  DIRECCION_PONDERACION_SERIE,
  basesSinDeclarar,
  basesSinLeer,
  enPalabras,
  textoPonderacion,
  type PonderacionEnSerie,
} from "../../analitica/ponderacionSerieModel";
import { estadoArmonizacion, resumenOrdenSerie, PANEL_ORDEN_SERIE } from "../armonizacionModel";
import { PANEL_MAPA_BASES, presenciaEnBase } from "../mapaBasesModel";
import { PANEL_SEGMENTOS } from "../panelesCarga";
import { PANEL_VARIABLES_BASE } from "../variablesBase/variablesBaseModel";

export type Lectura<T> =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; datos: T };

/**
 * - `hecho`: no falta nada.
 * - `falta`: hay algo concreto por hacer, y el texto lo dice.
 * - `no-empezado`: el paso todavía no tiene nada.
 * - `leyendo`: su lectura no terminó.
 * - `sin-lectura`: la app no puede leerlo desde aquí, o la lectura falló (C5:
 *   desconexión, no vacío).
 */
export type EstadoPaso = "hecho" | "falta" | "no-empezado" | "leyendo" | "sin-lectura";

export type PasoId = "bases" | "variables" | "segmentos" | "matriz" | "ponderacion" | "comparativos";

export type EnlacePaso =
  | { tipo: "panel"; panel: string; foco?: string; etiqueta: string }
  | { tipo: "direccion"; href: string; etiqueta: string };

export type PasoRecorrido = {
  id: PasoId;
  numero: number;
  titulo: string;
  estado: EstadoPaso;
  detalle: string;
  enlace: EnlacePaso;
};

type FilaMatriz = Pick<EquivalenciaFila, "variables" | "derivada" | "armonizacion" | "etiqueta_estandar">;

export type EntradaRecorrido = {
  /** Bases del estudio en el orden de la serie. */
  bases: readonly string[];
  /** La matriz guarda un orden de la serie. */
  ordenDeclarado: boolean;
  /** Sin orden declarado, todas las bases nombran un año y se ordenan solas. */
  ordenPorAnio: boolean;
  /** El editor del orden está montado (sólo con una matriz guardada). */
  ordenEditable: boolean;
  /** Filas GUARDADAS de la matriz: el recorrido dice lo que ya quedó hecho. */
  filas: readonly FilaMatriz[];
  variables: Readonly<Record<string, Lectura<BaseVariables>>>;
  segmentos: Lectura<SegmentosEstado>;
  ponderacion: Lectura<readonly PonderacionEnSerie[]>;
};

export const DIRECCION_FUENTES_SERIE = serializarDireccion({
  modulo: "procesamiento",
  seccion: "carga",
  pestana: "fuentes",
});

export const DIRECCION_COMPARATIVOS_SERIE = serializarDireccion({
  modulo: "procesamiento",
  seccion: "analitica",
  pestana: "comparativos",
});

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

function conteo(n: number, singular: string, plural: string): string {
  return `${formatoConteo(n)} ${n === 1 ? singular : plural}`;
}

/**
 * Entradas por base con tope: dos se nombran, con más se nombra la primera y se
 * cuenta el resto. Así el paso no crece con el número de bases.
 */
export function porBaseConTope(entradas: readonly string[]): string {
  if (entradas.length <= 2) return entradas.join(" · ");
  const resto = entradas.length - 1;
  return `${entradas[0]} · y ${conteo(resto, "base más", "bases más")}`;
}

// ---------------------------------------------------------------------------
// Pasos
// ---------------------------------------------------------------------------

function pasoBases(e: EntradaRecorrido): PasoRecorrido {
  const n = e.bases.length;
  const enlace: EnlacePaso = e.ordenEditable
    ? { tipo: "panel", panel: PANEL_ORDEN_SERIE.id, etiqueta: "Orden de la serie" }
    : { tipo: "direccion", href: DIRECCION_FUENTES_SERIE, etiqueta: "Fuentes" };
  const base = { id: "bases" as const, numero: 1, titulo: "Bases", enlace };
  if (n < 2) {
    return { ...base, estado: n === 0 ? "no-empezado" : "falta", detalle: n === 0 ? "Sin bases cargadas" : "1 base: la serie necesita 2" };
  }
  if (!e.ordenDeclarado && !e.ordenPorAnio) {
    return { ...base, estado: "falta", detalle: `${conteo(n, "base", "bases")} · orden sin declarar` };
  }
  return { ...base, estado: "hecho", detalle: resumenOrdenSerie(e.bases, 3) };
}

function pasoVariables(e: EntradaRecorrido): PasoRecorrido {
  const base = { id: "variables" as const, numero: 2, titulo: "Variables de cada base" };
  const lecturas = e.bases.map((b) => ({ base: b, lectura: e.variables[b] ?? { tipo: "cargando" as const } }));
  const primera = e.bases[0] ?? "";
  if (lecturas.some((l) => l.lectura.tipo === "cargando")) {
    return { ...base, estado: "leyendo", detalle: "Leyendo…", enlace: enlaceVariables(primera) };
  }
  const pendientes: { base: string; texto: string }[] = [];
  const fallidas: string[] = [];
  for (const { base: b, lectura } of lecturas) {
    if (lectura.tipo === "error") {
      fallidas.push(b);
      continue;
    }
    if (lectura.tipo !== "listo") continue;
    const sinIncorporar = lectura.datos.extras.filter((c) => !c.declarada).length;
    const sinMotivo = lectura.datos.retiradas_pendientes.length;
    const partes = [
      sinIncorporar ? conteo(sinIncorporar, "columna sin incorporar", "columnas sin incorporar") : "",
      sinMotivo ? conteo(sinMotivo, "retirada sin motivo", "retiradas sin motivo") : "",
    ].filter(Boolean);
    if (partes.length) pendientes.push({ base: b, texto: `${b}: ${partes.join(", ")}` });
  }
  if (pendientes.length) {
    return {
      ...base,
      estado: "falta",
      detalle: porBaseConTope(pendientes.map((p) => p.texto)),
      enlace: enlaceVariables(pendientes[0].base),
    };
  }
  if (fallidas.length) {
    return { ...base, estado: "sin-lectura", detalle: `No se pudo leer ${enPalabras(fallidas)}`, enlace: enlaceVariables(fallidas[0]) };
  }
  return { ...base, estado: "hecho", detalle: "Sin columnas pendientes", enlace: enlaceVariables(primera) };
}

function enlaceVariables(base: string): EnlacePaso {
  return { tipo: "panel", panel: PANEL_VARIABLES_BASE.id, foco: base || undefined, etiqueta: "Variables de la base" };
}

function pasoSegmentos(e: EntradaRecorrido): PasoRecorrido {
  const base = {
    id: "segmentos" as const,
    numero: 3,
    titulo: "Segmentos de cruce",
    enlace: { tipo: "panel" as const, panel: PANEL_SEGMENTOS.id, etiqueta: "Segmentos de cruce" },
  };
  const l = e.segmentos;
  if (l.tipo === "cargando") return { ...base, estado: "leyendo", detalle: "Leyendo…" };
  if (l.tipo === "error") return { ...base, estado: "sin-lectura", detalle: "No se pudieron leer" };
  const segmentos = l.datos.segmentos;
  if (!segmentos.length) return { ...base, estado: "no-empezado", detalle: "Sin segmentos declarados" };
  const faltas = e.bases
    .map((b) => ({ base: b, n: segmentos.filter((s) => s.por_base[b]?.estado !== "definido").length }))
    .filter((f) => f.n > 0);
  if (faltas.length) {
    return {
      ...base,
      estado: "falta",
      detalle: porBaseConTope(faltas.map((f) => `${f.base}: ${f.n === 1 ? "falta 1 segmento" : `faltan ${formatoConteo(f.n)} segmentos`}`)),
    };
  }
  return {
    ...base,
    estado: "hecho",
    detalle: `${conteo(segmentos.length, "segmento", "segmentos")} en ${e.bases.length === 2 ? "las 2 bases" : `las ${formatoConteo(e.bases.length)} bases`}`,
  };
}

/** Filas armonizadas que existen como comparables en al menos dos bases. */
export function filasComparables(filas: readonly FilaMatriz[], bases: readonly string[]): number {
  return filas.filter((f) => {
    if (estadoArmonizacion(f).tipo === "sin_armonizar") return false;
    return bases.filter((b) => presenciaEnBase(f, b) === "presente").length >= 2;
  }).length;
}

function pasoMatriz(e: EntradaRecorrido): PasoRecorrido {
  const base = {
    id: "matriz" as const,
    numero: 4,
    titulo: "Matriz",
    enlace: { tipo: "panel" as const, panel: PANEL_MAPA_BASES.id, etiqueta: "Mapa de bases" },
  };
  const n = e.filas.length;
  if (!n) return { ...base, estado: "no-empezado", detalle: "Sin preguntas en la matriz" };
  const sinArmonizar = e.filas.filter((f) => estadoArmonizacion(f).tipo === "sin_armonizar").length;
  const incompletas = e.filas.filter((f) => e.bases.some((b) => presenciaEnBase(f, b) === "falta")).length;
  const partes = [
    conteo(n, "fila", "filas"),
    sinArmonizar ? `${formatoConteo(sinArmonizar)} sin armonizar` : "",
    // Faltar en una base puede ser legítimo (no se preguntó ese año): se dice, no se exige.
    incompletas ? `${formatoConteo(incompletas)} ${incompletas === 1 ? "falta" : "faltan"} en alguna base` : "",
  ].filter(Boolean);
  return { ...base, estado: sinArmonizar ? "falta" : "hecho", detalle: partes.join(" · ") };
}

function pasoPonderacion(e: EntradaRecorrido): PasoRecorrido {
  const base = {
    id: "ponderacion" as const,
    numero: 5,
    titulo: "Ponderación",
    enlace: { tipo: "direccion" as const, href: DIRECCION_PONDERACION_SERIE, etiqueta: "Ponderación" },
  };
  const l = e.ponderacion;
  if (l.tipo === "cargando") return { ...base, estado: "leyendo", detalle: "Leyendo…" };
  if (l.tipo === "error") return { ...base, estado: "sin-lectura", detalle: "No se pudo leer" };
  const serie = l.datos;
  const sinDeclarar = basesSinDeclarar(serie);
  if (sinDeclarar.length) {
    return {
      ...base,
      estado: "falta",
      detalle: sinDeclarar.length <= 2
        ? `${enPalabras(sinDeclarar)} sin peso declarado`
        : `${conteo(sinDeclarar.length, "base", "bases")} sin peso declarado`,
    };
  }
  const leidas = serie.filter((s) => s.ponderacion.tipo !== "sin_leer");
  const sinLeer = basesSinLeer(serie);
  const textoLeidas = porBaseConTope(leidas.map((s) => `${s.base}: ${textoPonderacion(s.ponderacion)}`));
  if (sinLeer.length) {
    const resto = sinLeer.length === serie.length
      ? "Se ve base por base en Analítica"
      : `${conteo(sinLeer.length, "base", "bases")} sin leer aquí`;
    return { ...base, estado: "sin-lectura", detalle: [textoLeidas, resto].filter(Boolean).join(" · ") };
  }
  return { ...base, estado: "hecho", detalle: textoLeidas };
}

function pasoComparativos(e: EntradaRecorrido): PasoRecorrido {
  const base = {
    id: "comparativos" as const,
    numero: 6,
    titulo: "Comparativos",
    enlace: { tipo: "direccion" as const, href: DIRECCION_COMPARATIVOS_SERIE, etiqueta: "Comparativos" },
  };
  const n = filasComparables(e.filas, e.bases);
  if (!n) return { ...base, estado: "no-empezado", detalle: "Ninguna pregunta armonizada en 2 bases" };
  return { ...base, estado: "hecho", detalle: `${conteo(n, "pregunta lista", "preguntas listas")} para comparar` };
}

export function pasosDelRecorrido(e: EntradaRecorrido): PasoRecorrido[] {
  return [pasoBases(e), pasoVariables(e), pasoSegmentos(e), pasoMatriz(e), pasoPonderacion(e), pasoComparativos(e)];
}

/** La banda se muestra plegada sólo si los seis pasos están hechos. */
export function todoHecho(pasos: readonly PasoRecorrido[]): boolean {
  return pasos.length > 0 && pasos.every((p) => p.estado === "hecho");
}

/** Readiness de la banda: `false` mientras algún paso lee. */
export function readinessRecorrido(pasos: readonly PasoRecorrido[]): "true" | "false" {
  return pasos.some((p) => p.estado === "leyendo") ? "false" : "true";
}

export const TEXTO_ESTADO: Record<EstadoPaso, string> = {
  hecho: "Hecho",
  falta: "Falta algo",
  "no-empezado": "No empezado",
  leyendo: "Leyendo",
  "sin-lectura": "Sin lectura",
};

/** Resumen de una línea para la banda plegada o para el lector de pantalla. */
export function resumenRecorrido(pasos: readonly PasoRecorrido[]): string {
  if (todoHecho(pasos)) return "Los seis pasos están hechos";
  const faltan = pasos.filter((p) => p.estado === "falta" || p.estado === "no-empezado").length;
  if (!faltan) return "Sin pasos pendientes";
  return `${formatoConteo(faltan)} de ${formatoConteo(pasos.length)} ${faltan === 1 ? "paso pendiente" : "pasos pendientes"}`;
}

/**
 * A dónde lleva el enlace. Un panel de Carga se abre sobre la dirección actual
 * (misma pestaña, `panel` y `foco` reescritos); una dirección de otra sección
 * se usa tal cual.
 */
export function hrefDeEnlace(enlace: EnlacePaso, pathname: string, search: string): string {
  if (enlace.tipo === "direccion") return enlace.href;
  const conPanel = conNivel(search, "panel", enlace.panel);
  return `${pathname}${conNivel(conPanel, "foco", enlace.foco ?? null)}`;
}
