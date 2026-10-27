/**
 * Control › Barrido › No barridos del telefónico: quién tiene casos asignados
 * sin ningún intento en la hoja y desde hace cuántos días (pedido de Gonzalo,
 * 2026-10-27: «es grave que la gente no barra sus casos cuando ya ha pasado
 * varios días»).
 *
 * Lee el bloque `no_barridos_casos` (`api/R/monitoreo_telefonico_no_barridos.R`):
 * una fila por caso asignado sin barrer con la fecha desde la que se cuenta su
 * atraso y qué referencia es. Los días se cuentan aquí contra el CORTE (la
 * fecha de la última lectura de la hoja), como la cola de insistencia: con un
 * proyecto abierto días después, la fecha del motor inflaría el atraso.
 *
 * Los casos sin responsable no entran: no son atraso de nadie. Su cifra sale
 * de `no_barridos_responsable`, como en Avisos.
 */

import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { filasDeBloque } from "../navegacion/bloques";

/**
 * Umbrales de severidad, en días sin barrer. Un solo lugar: Avisos, la ficha
 * del operador y la vista leen de aquí. Pregunta abierta a Gonzalo (informe
 * 2026-10-27): ¿2 y 4 días, o distintos por estudio?
 */
export const UMBRALES_NO_BARRIDO = { aviso: 2, grave: 4 } as const;

export type Severidad = "grave" | "aviso" | "reciente" | "sin-dato";

export type TipoDeReferencia = "asignacion" | "primera_llamada_operador" | "inicio_campo" | "sin_referencia";

export type CasoNoBarrido = {
  codigo: string;
  responsable: string;
  cuota: string;
  variableCuota: string;
  origen: string;
  /** Fecha ISO desde la que se cuenta el atraso, o null. */
  referencia: string | null;
  tipo: TipoDeReferencia;
  dias: number | null;
  severidad: Severidad;
};

export type OperadorNoBarrido = {
  nombre: string;
  casos: CasoNoBarrido[];
  graves: number;
  avisos: number;
  recientes: number;
  maxDias: number | null;
  severidad: Severidad;
  /** Último intento que registró en la hoja (ISO) o null si no registró ninguno. */
  ultimaLlamada: string | null;
  /** Casos que tiene asignados en la hoja (de `no_barridos_responsable`). */
  asignados: number | null;
};

export type NoBarridos =
  | { clave: "sin-hoja" }
  /** El corte guardado es anterior al bloque: hay que recalcular. */
  | { clave: "preparando" }
  | {
    clave: "lista";
    casos: CasoNoBarrido[];
    operadores: OperadorNoBarrido[];
    sinAsignar: number;
    /** Corte contra el que se cuentan los días (dd/mm), o "" si no hay. */
    corte: string;
    /** Referencias que usan los casos, en orden de prioridad. */
    referencias: TipoDeReferencia[];
    totales: { casos: number; graves: number; avisos: number; atrasados: number; operadoresAtrasados: number };
  };

function texto(valor: unknown) {
  return valor == null ? "" : String(valor).trim();
}

function clave(valor: unknown) {
  return texto(valor).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function esSinAsignar(nombre: unknown) {
  return ["", "sin responsable", "sin asignar"].includes(clave(nombre));
}

const TIPOS: readonly TipoDeReferencia[] = ["asignacion", "primera_llamada_operador", "inicio_campo", "sin_referencia"];

function tipoDe(valor: unknown): TipoDeReferencia {
  const crudo = texto(valor) as TipoDeReferencia;
  return TIPOS.includes(crudo) ? crudo : "sin_referencia";
}

function iso(valor: unknown): string | null {
  const partes = texto(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return partes ? `${partes[1]}-${partes[2]}-${partes[3]}` : null;
}

function diaUtc(fechaIso: string) {
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  return Date.UTC(anio, mes - 1, dia);
}

/** Día del corte en UTC, leído en hora local como la cola de insistencia. */
function diaDelCorte(corteIso: string | null | undefined): number | null {
  const corte = corteIso ? new Date(corteIso) : null;
  if (!corte || Number.isNaN(corte.getTime())) return null;
  return Date.UTC(corte.getFullYear(), corte.getMonth(), corte.getDate());
}

export function severidadDe(dias: number | null): Severidad {
  if (dias == null) return "sin-dato";
  if (dias >= UMBRALES_NO_BARRIDO.grave) return "grave";
  if (dias >= UMBRALES_NO_BARRIDO.aviso) return "aviso";
  return "reciente";
}

const ORDEN: Record<Severidad, number> = { grave: 0, aviso: 1, "sin-dato": 2, reciente: 3 };

function corteCorto(corteIso: string | null | undefined) {
  const corte = corteIso ? new Date(corteIso) : null;
  if (!corte || Number.isNaN(corte.getTime())) return "";
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(corte.getDate())}/${dos(corte.getMonth() + 1)}`;
}

function tieneBloque(reports: MonitoreoAcreditacionReports | null | undefined, id: string) {
  const hoja = reports?.sheets?.find((item) => item.id === "monitoreo_telefonico");
  return Boolean(hoja?.blocks.some((bloque) => String(bloque.id) === id));
}

export function construirNoBarridos(
  reports: MonitoreoAcreditacionReports | null | undefined,
  corteIso: string | null | undefined,
): NoBarridos {
  if (!reports?.sheets?.some((item) => item.id === "monitoreo_telefonico")) return { clave: "sin-hoja" };
  if (!tieneBloque(reports, "no_barridos_casos")) return { clave: "preparando" };
  const corte = diaDelCorte(corteIso);
  const ultimaPorOperador = new Map<string, string | null>();
  const casos: CasoNoBarrido[] = filasDeBloque(reports, ["no_barridos_casos"])
    .filter((fila) => texto(fila.CodPulso) && !esSinAsignar(fila.Responsable))
    .map((fila) => {
      const referencia = iso(fila["Fecha referencia"]);
      const dias = referencia && corte != null ? Math.max(0, Math.round((corte - diaUtc(referencia)) / 86_400_000)) : null;
      const responsable = texto(fila.Responsable);
      if (!ultimaPorOperador.has(responsable)) ultimaPorOperador.set(responsable, iso(fila["Ultima llamada operador"]));
      return {
        codigo: texto(fila.CodPulso),
        responsable,
        cuota: texto(fila.Cuota),
        variableCuota: texto(fila["Variable cuota"]),
        origen: texto(fila.Origen),
        referencia,
        tipo: tipoDe(fila.Referencia),
        dias,
        severidad: severidadDe(dias),
      };
    })
    .sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad] || (b.dias ?? -1) - (a.dias ?? -1) || a.codigo.localeCompare(b.codigo, "es"));

  const asignadosPorOperador = new Map<string, number>();
  let sinAsignar = 0;
  filasDeBloque(reports, ["no_barridos_responsable"]).forEach((fila) => {
    if (esSinAsignar(fila.Responsable)) {
      sinAsignar += Number(fila["No barridos"]) || 0;
      return;
    }
    const nombre = texto(fila.Responsable);
    asignadosPorOperador.set(nombre, (asignadosPorOperador.get(nombre) ?? 0) + (Number(fila["Casos asignados"]) || 0));
  });

  const porOperador = new Map<string, CasoNoBarrido[]>();
  casos.forEach((caso) => porOperador.set(caso.responsable, [...(porOperador.get(caso.responsable) ?? []), caso]));
  const operadores: OperadorNoBarrido[] = [...porOperador.entries()].map(([nombre, propios]) => {
    const dias = propios.map((caso) => caso.dias).filter((valor): valor is number => valor != null);
    const severidad = propios.map((caso) => caso.severidad).sort((a, b) => ORDEN[a] - ORDEN[b])[0] ?? "sin-dato";
    return {
      nombre,
      casos: propios,
      graves: propios.filter((caso) => caso.severidad === "grave").length,
      avisos: propios.filter((caso) => caso.severidad === "aviso").length,
      recientes: propios.filter((caso) => caso.severidad === "reciente").length,
      maxDias: dias.length ? Math.max(...dias) : null,
      severidad,
      ultimaLlamada: ultimaPorOperador.get(nombre) ?? null,
      asignados: asignadosPorOperador.get(nombre) ?? null,
    };
  }).sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad]
    || (b.maxDias ?? -1) - (a.maxDias ?? -1)
    || b.casos.length - a.casos.length
    || a.nombre.localeCompare(b.nombre, "es"));

  const graves = casos.filter((caso) => caso.severidad === "grave").length;
  const avisos = casos.filter((caso) => caso.severidad === "aviso").length;
  return {
    clave: "lista",
    casos,
    operadores,
    sinAsignar,
    corte: corteCorto(corteIso),
    referencias: TIPOS.filter((tipo) => casos.some((caso) => caso.tipo === tipo)),
    totales: {
      casos: casos.length,
      graves,
      avisos,
      atrasados: graves + avisos,
      operadoresAtrasados: operadores.filter((op) => op.graves + op.avisos > 0).length,
    },
  };
}

const FRASE_DE_REFERENCIA: Record<TipoDeReferencia, string> = {
  asignacion: "la fecha de asignación de la hoja",
  primera_llamada_operador: "la primera llamada de cada operador",
  inicio_campo: "el primer día de campo",
  sin_referencia: "",
};

/**
 * De dónde se cuentan los días, dicho una vez: «Días desde la fecha de
 * asignación de la hoja; sin ella, desde la primera llamada de cada operador».
 */
export function fraseDeReferencia(referencias: readonly TipoDeReferencia[]): string {
  const con = referencias.filter((tipo) => tipo !== "sin_referencia").map((tipo) => FRASE_DE_REFERENCIA[tipo]);
  if (!con.length) return referencias.length ? "La hoja no trae fechas para contar los días" : "";
  const [primera, ...resto] = con;
  return resto.length ? `Días desde ${primera}; sin ella, desde ${resto.join(" o ")}` : `Días desde ${primera}`;
}

/** Rótulo corto de la referencia de un caso (tooltip de su fila). */
export function rotuloDeReferencia(tipo: TipoDeReferencia): string {
  switch (tipo) {
    case "asignacion": return "Desde la fecha de asignación";
    case "primera_llamada_operador": return "Desde la primera llamada del operador";
    case "inicio_campo": return "Desde el primer día de campo";
    default: return "Sin fecha de referencia";
  }
}

export function diasLegibles(dias: number | null) {
  if (dias == null) return "Sin fecha";
  if (dias === 0) return "Hoy";
  return `${dias.toLocaleString("es-PE")} ${dias === 1 ? "día" : "días"}`;
}

/** «23/10» desde una fecha ISO. */
export function fechaCorta(fechaIso: string | null) {
  if (!fechaIso) return "—";
  return `${fechaIso.slice(8, 10)}/${fechaIso.slice(5, 7)}`;
}

/** Los casos del operador que ya pasan el umbral de aviso (lo que se le reclama). */
export function atrasadosDe(operador: OperadorNoBarrido) {
  return operador.casos.filter((caso) => caso.severidad === "grave" || caso.severidad === "aviso");
}

/**
 * Mensaje para el chat del equipo, uno por operador: sus casos atrasados, del
 * más antiguo al más reciente. Si no tiene atrasados, todos sus casos sin
 * barrer. Mismo formato que «Copiar para el equipo» de Discrepancias.
 */
export function mensajeParaElOperador(operador: OperadorNoBarrido, corte: string) {
  const atrasados = atrasadosDe(operador);
  const lista = atrasados.length ? atrasados : operador.casos;
  const total = lista.length;
  const alCorte = corte ? ` al ${corte}` : "";
  const encabezado = `${operador.nombre}: ${total.toLocaleString("es-PE")} ${total === 1 ? "caso asignado sigue" : "casos asignados siguen"} sin barrer${alCorte}`
    + (operador.maxDias != null && operador.maxDias > 0 ? ` (el más antiguo, ${diasLegibles(operador.maxDias).toLowerCase()}).` : ".");
  return [
    encabezado,
    ...lista.map((caso) => `- ${caso.codigo}${caso.cuota ? ` (${caso.cuota})` : ""}: ${diasLegibles(caso.dias).toLowerCase()}`),
  ].join("\n");
}

/** Mensaje para todo el equipo: un bloque por operador con casos atrasados. */
export function mensajeParaElEquipo(operadores: readonly OperadorNoBarrido[], corte: string) {
  return operadores
    .filter((operador) => atrasadosDe(operador).length)
    .map((operador) => mensajeParaElOperador(operador, corte))
    .join("\n\n");
}
