/**
 * Control › Equipo del telefónico (ficha «Control, Equipo»): cómo rinde cada
 * responsable. Carga desde `operacion_responsable` y `reintentos_responsable`;
 * status por operador desde `estatus_responsable`, con la misma regla de
 * desvío que la vista anterior (`telefonicoTeamModel.ts`: 12 puntos sobre o
 * bajo la mediana, mínimo 10 casos).
 *
 * Los bloques vienen por actor y responsable: una persona que cubre dos
 * actores ocupa dos filas. Aquí se suman por PERSONA (ver `conteoDeEquipo.ts`).
 */

import type { MonitoreoAcreditacionReports, MonitoreoStateRule } from "../../../../../api/client";
import { filasDeBloque } from "../navegacion/bloques";
import { buildTelefonicoStatusMatrix, type TelefonicoStatusMatrix } from "../telefonicoTeamModel";
import { clasificadorDeStatus, type FamiliaDelCliente } from "./familiasDelCliente";

type Fila = Record<string, unknown>;

function texto(valor: unknown) {
  return valor == null ? "" : String(valor).trim();
}

function numero(valor: unknown): number | null {
  const crudo = texto(valor).replace(/,/g, "");
  if (!crudo) return null;
  const n = Number(crudo);
  return Number.isFinite(n) ? n : null;
}

function clave(valor: unknown) {
  return texto(valor).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function esSinAsignar(nombre: string) {
  return ["", "sin responsable", "sin asignar", "na", "-"].includes(clave(nombre));
}

export type OperadorDeEquipo = {
  nombre: string;
  asignados: number;
  llamados: number;
  sinLlamar: number;
  efectivasHoja: number;
  efectivasKobo: number;
  /** Efectivas en Kobo cuyo caso la hoja no marca efectivo: entrevistó sin registrar. */
  brecha: number;
  sinEfectiva: number;
  /** Sin efectiva sobre llamados. */
  pctSinEfectiva: number | null;
  reintentables: number | null;
  noContesta: number | null;
  promedioIntentos: number | null;
};

export type FamiliasDeOperador = Array<{ familia: FamiliaDelCliente; casos: number }>;

export type StatusDeOperador = Array<{ status: string; casos: number; familia: FamiliaDelCliente; porRegla: boolean }>;

export type Equipo = {
  operadores: OperadorDeEquipo[];
  sinAsignar: { asignados: number; efectivasKobo: number } | null;
  matriz: TelefonicoStatusMatrix;
  desvios: number;
  familiasPorOperador: Map<string, FamiliasDeOperador>;
  statusPorOperador: Map<string, StatusDeOperador>;
};

function sumar(filas: readonly Fila[], columnas: string[]) {
  let total: number | null = null;
  for (const fila of filas) {
    for (const columna of columnas) {
      const valor = numero(fila[columna]);
      if (valor != null) {
        total = (total ?? 0) + valor;
        break;
      }
    }
  }
  return total;
}

function porPersona(filas: readonly Fila[]) {
  const grupos = new Map<string, { nombre: string; filas: Fila[] }>();
  filas.forEach((fila) => {
    const nombre = texto(fila.Responsable);
    const llave = clave(nombre);
    const grupo = grupos.get(llave) ?? { nombre, filas: [] };
    grupo.filas.push(fila);
    grupos.set(llave, grupo);
  });
  return grupos;
}

export function contarDesvios(matriz: TelefonicoStatusMatrix) {
  return matriz.responsables.reduce((suma, fila) => suma + fila.celdas.filter((celda) => celda.senal !== "normal").length, 0);
}

export function construirEquipo({
  reports,
  reglas,
}: {
  reports: MonitoreoAcreditacionReports | null | undefined;
  reglas: readonly MonitoreoStateRule[];
}): Equipo {
  const operacion = porPersona(filasDeBloque(reports, ["operacion_responsable"]));
  const reintentos = porPersona(filasDeBloque(reports, ["reintentos_responsable"]));
  const estatus = filasDeBloque(reports, ["estatus_responsable"]);

  const operadores: OperadorDeEquipo[] = [];
  let sinAsignar: Equipo["sinAsignar"] = null;
  operacion.forEach(({ nombre, filas }, llave) => {
    if (esSinAsignar(nombre)) {
      sinAsignar = {
        asignados: sumar(filas, ["Casos asignados"]) ?? 0,
        efectivasKobo: sumar(filas, ["Efectivas Kobo", "Plataforma completa"]) ?? 0,
      };
      return;
    }
    const llamados = sumar(filas, ["Barridos"]) ?? 0;
    const sinEfectiva = sumar(filas, ["Sin efectiva"]) ?? 0;
    const intentos = reintentos.get(llave)?.filas ?? [];
    const reintentables = sumar(intentos, ["Casos reintentables"]);
    // Promedio ponderado por casos reintentables cuando la persona tiene dos filas.
    const ponderado = intentos.reduce((suma, fila) => suma + (numero(fila["Promedio intentos"]) ?? 0) * (numero(fila["Casos reintentables"]) ?? 0), 0);
    operadores.push({
      nombre,
      asignados: sumar(filas, ["Casos asignados"]) ?? 0,
      llamados,
      sinLlamar: sumar(filas, ["No barridos"]) ?? 0,
      efectivasHoja: sumar(filas, ["Efectivas telefónicas", "Efectivas"]) ?? 0,
      efectivasKobo: sumar(filas, ["Efectivas Kobo", "Plataforma completa"]) ?? 0,
      brecha: sumar(filas, ["Efectiva Kobo sin tel. efectiva", "Plataforma completa sin tel. efectiva"]) ?? 0,
      sinEfectiva,
      pctSinEfectiva: llamados > 0 ? (sinEfectiva / llamados) * 100 : null,
      reintentables,
      noContesta: sumar(intentos, ["No contesta"]),
      promedioIntentos: reintentables ? ponderado / reintentables : null,
    });
  });
  operadores.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));

  const clasificar = clasificadorDeStatus(reglas);
  const familiasPorOperador = new Map<string, FamiliasDeOperador>();
  const statusPorOperador = new Map<string, StatusDeOperador>();
  porPersona(estatus).forEach(({ nombre, filas }) => {
    if (esSinAsignar(nombre)) return;
    const cuenta = new Map<FamiliaDelCliente, number>();
    const porStatus = new Map<string, { casos: number; familia: FamiliaDelCliente; porRegla: boolean }>();
    filas.forEach((fila) => {
      const casos = numero(fila.Casos) ?? 0;
      if (!casos) return;
      const status = texto(fila.Estado);
      const { familia, porRegla } = clasificar(status);
      cuenta.set(familia, (cuenta.get(familia) ?? 0) + casos);
      const previo = porStatus.get(status);
      porStatus.set(status, { casos: (previo?.casos ?? 0) + casos, familia, porRegla });
    });
    familiasPorOperador.set(clave(nombre), [...cuenta.entries()].map(([familia, casos]) => ({ familia, casos })));
    statusPorOperador.set(clave(nombre), [...porStatus.entries()]
      .map(([status, item]) => ({ status, ...item }))
      .sort((a, b) => b.casos - a.casos));
  });

  const matriz = buildTelefonicoStatusMatrix(estatus);
  return { operadores, sinAsignar, matriz, desvios: contarDesvios(matriz), familiasPorOperador, statusPorOperador };
}

export function familiasDe(equipo: Equipo, nombre: string): FamiliasDeOperador {
  return equipo.familiasPorOperador.get(clave(nombre)) ?? [];
}

export function statusDe(equipo: Equipo, nombre: string): StatusDeOperador {
  return equipo.statusPorOperador.get(clave(nombre)) ?? [];
}
