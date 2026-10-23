/**
 * Control › Insistencia del telefónico: lectura de los bloques
 * `cola_insistencia` y `cola_insistencia_responsables` (contrato en
 * `docs/qa/revamp-monitoreo/plan-ui-telefonico.md`, «T4 backend»).
 *
 * El bloque llega con `""` donde el motor tenía NA, y booleanos que según el
 * camino de serialización son `true`, `"TRUE"` o `1`: se normaliza aquí, una
 * vez, para que la vista no tenga que adivinar.
 */

import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import {
  conIntensidad,
  type CasoDeCola,
  type ResponsableDeCola,
} from "../../../core/colaDeInsistenciaModel";
import { filasDeBloque } from "../navegacion/bloques";

type Fila = Record<string, unknown>;

function texto(valor: unknown): string {
  return valor == null ? "" : String(valor).trim();
}

function entero(valor: unknown): number | null {
  const crudo = texto(valor);
  if (!crudo) return null;
  const n = Number(crudo.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function decimal(valor: unknown): number | null {
  const crudo = texto(valor);
  if (!crudo) return null;
  const n = Number(crudo.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function booleano(valor: unknown): boolean {
  if (typeof valor === "boolean") return valor;
  if (typeof valor === "number") return valor !== 0;
  return ["true", "1", "si", "sí", "yes"].includes(texto(valor).toLowerCase());
}

function opcional(fila: Fila, clave: string): string | null {
  return clave in fila ? texto(fila[clave]) || null : null;
}

export function casosDeCola(filas: readonly Fila[]): CasoDeCola[] {
  return filas
    .map((fila) => ({
      codigo: texto(fila.CodPulso),
      responsable: texto(fila.Responsable) || "Sin asignar",
      sinAsignar: booleano(fila["Sin asignar"]),
      status: texto(fila.Status),
      intentos: entero(fila.Intentos),
      fecha: texto(fila.Fecha) || null,
      observacion: texto(fila["Observación"] ?? fila.Observacion),
      variableCuota: texto(fila["Variable cuota"]),
      cuota: texto(fila.Cuota),
      efectivaKobo: booleano(fila.efectiva_kobo),
      diasSinRegistro: entero(fila.dias_sin_registro),
      criterio: texto(fila["Criterio cola"]),
      ordenTelefono: entero(fila.OrdenTelefono),
      numTelefonos: entero(fila.NumTelefonos),
      telefonosIntentados: opcional(fila, "TelefonosIntentados"),
      origen: opcional(fila, "Origen"),
    }))
    .filter((caso) => caso.codigo);
}

export function responsablesDeCola(filas: readonly Fila[]): ResponsableDeCola[] {
  return conIntensidad(filas.map((fila) => ({
    nombre: texto(fila.Responsable) || "Sin asignar",
    sinAsignar: booleano(fila["Sin asignar"]),
    enCola: entero(fila["Casos en cola"]) ?? 0,
    yaEfectivas: entero(fila["Ya efectivas en Kobo"]) ?? 0,
    promedio: decimal(fila["Promedio intentos"]),
    sinDato: entero(fila["Sin dato de intentos"]) ?? 0,
    porLlamar: entero(fila["Por llamar"]) ?? 0,
  })));
}

export type EstadoDeInsistencia =
  | { clave: "lista"; casos: CasoDeCola[]; responsables: ResponsableDeCola[] }
  /** El corte guardado es anterior al bloque: hay que recalcular. */
  | { clave: "preparando" }
  /** El proyecto no tiene hoja de barrido: no hay cola que leer. */
  | { clave: "sin-hoja" };

function tieneBloque(reports: MonitoreoAcreditacionReports | null | undefined, id: string) {
  const hoja = reports?.sheets?.find((item) => item.id === "monitoreo_telefonico");
  return Boolean(hoja?.blocks.some((bloque) => String(bloque.id) === id));
}

export function estadoDeInsistencia(reports: MonitoreoAcreditacionReports | null | undefined): EstadoDeInsistencia {
  const hayHoja = Boolean(reports?.sheets?.some((item) => item.id === "monitoreo_telefonico"));
  if (!hayHoja) return { clave: "sin-hoja" };
  if (!tieneBloque(reports, "cola_insistencia")) return { clave: "preparando" };
  return {
    clave: "lista",
    casos: casosDeCola(filasDeBloque(reports, ["cola_insistencia"])),
    responsables: responsablesDeCola(filasDeBloque(reports, ["cola_insistencia_responsables"])),
  };
}

/**
 * Lo que la vista anterior decía en su franja y la cola no dice por sí sola:
 * los casos por llamar ya asignados y los casos repartidos entre el equipo.
 */
export function repartoDelEquipo(responsables: readonly ResponsableDeCola[], reports: MonitoreoAcreditacionReports | null | undefined) {
  const asignados = filasDeBloque(reports, ["no_barridos_responsable"])
    .filter((fila) => !["sin responsable", "sin asignar", ""].includes(texto(fila.Responsable).toLowerCase()))
    .reduce((suma, fila) => suma + (entero(fila["Casos asignados"]) ?? 0), 0);
  return {
    porLlamarAsignados: responsables.filter((item) => !item.sinAsignar).reduce((suma, item) => suma + item.porLlamar, 0),
    repartidos: asignados || null,
    equipo: responsables.filter((item) => !item.sinAsignar).length,
  };
}

/** Chips de la cabecera de pestaña: por rellamar y ya efectivas en Kobo. */
export function chipsDeInsistencia(reports: MonitoreoAcreditacionReports | null | undefined): string[] {
  const estado = estadoDeInsistencia(reports);
  if (estado.clave !== "lista") return [];
  const ya = estado.casos.filter((caso) => caso.efectivaKobo).length;
  return [
    `${estado.casos.length.toLocaleString("es-PE")} casos por rellamar`,
    ya === 0 ? "Ninguno ya efectivo en Kobo" : ya === 1 ? "1 ya es efectiva en Kobo" : `${ya.toLocaleString("es-PE")} ya son efectivas en Kobo`,
  ];
}
