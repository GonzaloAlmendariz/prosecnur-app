/**
 * Control › Personas (ficha Ctl8): en qué está cada persona del padrón.
 * Modelo puro sobre `case_rollup` (una fila por persona): estado por público,
 * canal y cómo cruzó de quienes respondieron, la tabla filtrada y su
 * exportación. Grano persona; las respuestas van en Control › Respuestas.
 */

import type { MonitoreoInternalQueryCase } from "../../../../../../api/client";
import { internalCaseCrossingLabel, internalCaseCrossingValue } from "../../../../internalQueries";

export type EstadoDePersona = "efectiva" | "sin-respuesta" | "parcial" | "rechazo" | "excluida" | "revision";

export const ROTULO_DE_ESTADO: Record<EstadoDePersona, string> = {
  efectiva: "Efectiva",
  "sin-respuesta": "Sin respuesta",
  parcial: "Parcial",
  rechazo: "Rechazo",
  excluida: "Excluida",
  revision: "En revisión",
};

export const ORDEN_DE_ESTADOS: readonly EstadoDePersona[] = ["efectiva", "sin-respuesta", "parcial", "rechazo", "excluida", "revision"];

export function estadoDePersona(caso: Pick<MonitoreoInternalQueryCase, "advancement">): EstadoDePersona {
  switch (String(caso.advancement ?? "").toLowerCase()) {
    case "effective": return "efectiva";
    case "partial": return "parcial";
    case "refusal": return "rechazo";
    case "excluded": return "excluida";
    case "included_review": return "revision";
    default: return "sin-respuesta";
  }
}

export type Persona = {
  clave: string;
  llave: string;
  publico: string;
  estado: EstadoDePersona;
  canal: string;
  comoCruzo: string;
  fecha: string;
};

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

/** «Cruzó por barrido» y «Cruzó manualmente» se dicen tal cual; «Cruzó» a secas es por llave. */
export function comoCruzo(caso: MonitoreoInternalQueryCase): string {
  const base = texto(caso.base_result);
  if (/^cruz[oó] (por |manual)/i.test(base)) return base;
  return internalCaseCrossingLabel(internalCaseCrossingValue(caso));
}

/** La llave sin el prefijo técnico del motor («codigo:20222716» → «20222716»). */
export function llaveLegible(crudo: string): string {
  return crudo.replace(/^[a-z_]+:/i, "").trim();
}

export function personasDe(casos: readonly MonitoreoInternalQueryCase[]): Persona[] {
  return casos.map((caso, indice) => {
    const estado = estadoDePersona(caso);
    return {
      clave: `${texto(caso.actor)}-${texto(caso.case_key) || indice}-${indice}`,
      llave: llaveLegible(texto(caso.case_key)) || "Sin llave",
      publico: texto(caso.actor) || "Sin público",
      estado,
      canal: estado === "sin-respuesta" ? "" : texto(caso.channel) || "Sin canal",
      comoCruzo: estado === "sin-respuesta" ? "" : comoCruzo(caso),
      fecha: texto(caso.response_datetime || caso.date).slice(0, 10),
    };
  });
}

export type FilaDeEstado = { publico: string | null; total: number; porEstado: Record<EstadoDePersona, number> };

function vacio(): Record<EstadoDePersona, number> {
  return { efectiva: 0, "sin-respuesta": 0, parcial: 0, rechazo: 0, excluida: 0, revision: 0 };
}

/** Una fila por público y una de todos, en el orden de mayor a menor padrón. */
export function estadoPorPublico(personas: readonly Persona[]): FilaDeEstado[] {
  const porPublico = new Map<string, FilaDeEstado>();
  const todos: FilaDeEstado = { publico: null, total: 0, porEstado: vacio() };
  personas.forEach((persona) => {
    const fila = porPublico.get(persona.publico) ?? { publico: persona.publico, total: 0, porEstado: vacio() };
    fila.total += 1;
    fila.porEstado[persona.estado] += 1;
    porPublico.set(persona.publico, fila);
    todos.total += 1;
    todos.porEstado[persona.estado] += 1;
  });
  return [todos, ...[...porPublico.values()].sort((a, b) => b.total - a.total || String(a.publico).localeCompare(String(b.publico), "es"))];
}

/** Cuántas personas con respuesta hay por un rótulo (canal o cómo cruzó). */
export function conRespuestaPor(personas: readonly Persona[], clave: "canal" | "comoCruzo") {
  const cuenta = new Map<string, number>();
  personas.filter((persona) => persona.estado !== "sin-respuesta").forEach((persona) => {
    const rotulo = persona[clave];
    if (rotulo) cuenta.set(rotulo, (cuenta.get(rotulo) ?? 0) + 1);
  });
  return [...cuenta].map(([rotulo, casos]) => ({ rotulo, casos })).sort((a, b) => b.casos - a.casos);
}

export type FiltroDePersonas = { publico: string | null; estado: EstadoDePersona | null; busqueda: string };

function normal(valor: string) {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function filtrarPersonas(personas: readonly Persona[], filtro: FiltroDePersonas): Persona[] {
  const tokens = normal(filtro.busqueda).split(/\s+/).filter(Boolean);
  return personas.filter((persona) => (
    (!filtro.publico || persona.publico === filtro.publico)
    && (!filtro.estado || persona.estado === filtro.estado)
    && tokens.every((token) => normal(`${persona.llave} ${persona.canal} ${persona.comoCruzo} ${persona.publico}`).includes(token))
  ));
}

export const POR_PAGINA = 50;

export function pagina<T>(filas: readonly T[], numero: number) {
  const paginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA));
  const actual = Math.min(Math.max(1, numero), paginas);
  return { filas: filas.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA), actual, paginas };
}

/** CSV con rótulos legibles en la cabecera; Excel lo abre con la marca UTF-8. */
export function csvDePersonas(personas: readonly Persona[]): string {
  const celda = (valor: string) => `"${valor.replace(/"/g, "\"\"")}"`;
  const cabecera = ["Llave", "Público", "Estado", "Canal", "Cómo cruzó", "Fecha"];
  return [
    cabecera.map(celda).join(","),
    ...personas.map((persona) => [persona.llave, persona.publico, ROTULO_DE_ESTADO[persona.estado], persona.canal, persona.comoCruzo, persona.fecha].map(celda).join(",")),
  ].join("\n");
}
