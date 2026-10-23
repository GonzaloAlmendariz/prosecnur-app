import type { MonitoreoTerritorialDashboard, TerritorialResponseAuditRow } from "../../../../../api/client";
import {
  TERRITORIAL_DURATION_SHORT_SECONDS,
  TERRITORIAL_DURATION_VERY_SHORT_SECONDS,
  territorialDurationOperationalStatusFromValues,
} from "../../../territorialDuration";
import { nombreDeDistrito } from "../rotulos";

/**
 * Control › Señales (territorial.md §3.7): la distribución de la distancia del
 * GPS a la manzana y de la duración, y las señales por distrito. Todo sale de
 * `response_audit` del corte de Validación; la base de la matriz son los casos
 * del corte con distrito.
 */

export type Tramo = { desde: number; hasta: number | null; rotulo: string; casos: number; marca?: "revision" | "lejos" | "muy-corta" | "corta" };

export type Histograma = { tramos: Tramo[]; base: number; mediana: number | null };

export type FilaDeSenales = {
  distrito: string;
  casos: number;
  enManzana: number;
  hasta150: number;
  de150a300: number;
  mas300: number;
  sinGps: number;
  sinCruce: number;
  corta: number;
  muyCorta: number;
};

export type ModeloSenales = {
  disponible: boolean;
  distancia: Histograma;
  duracion: Histograma;
  distritos: FilaDeSenales[];
  total: FilaDeSenales;
  /** Casos del corte sin distrito: quedan fuera de la matriz y se declaran. */
  sinDistrito: number;
};

const CORTES_DE_DISTANCIA = [0, 25, 50, 100, 150, 200, 300, 500, 1000, 2000];
const CORTES_DE_DURACION_MIN = [0, 2, 5, 10, 15, 20, 30, 45, 60, 120];

function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
}

function rotuloDeTramo(desde: number, hasta: number | null, unidad: string): string {
  if (hasta == null) return `${desde.toLocaleString("es-PE")} ${unidad} o más`;
  if (desde === 0) return `Menos de ${hasta.toLocaleString("es-PE")} ${unidad}`;
  return `${desde.toLocaleString("es-PE")} a ${hasta.toLocaleString("es-PE")} ${unidad}`;
}

function histograma(valores: number[], cortes: readonly number[], unidad: string, marca: (desde: number) => Tramo["marca"]): Histograma {
  const tramos: Tramo[] = cortes.map((desde, indice) => {
    const hasta = cortes[indice + 1] ?? null;
    return { desde, hasta, rotulo: rotuloDeTramo(desde, hasta, unidad), casos: 0, marca: marca(desde) };
  });
  for (const valor of valores) {
    const tramo = tramos.find((item) => valor >= item.desde && (item.hasta == null || valor < item.hasta));
    if (tramo) tramo.casos += 1;
  }
  return { tramos, base: valores.length, mediana: mediana(valores) };
}

function distanciaDe(fila: TerritorialResponseAuditRow): number | null {
  if (fila.geo_estado === "geo_sin_gps" || fila.geo_estado === "geo_sin_cruce") return null;
  const valor = Number(fila.gps_effective_distance_m ?? fila.distance_m);
  return fila.distance_m != null && Number.isFinite(valor) && valor >= 0 ? valor : null;
}

function filaVacia(distrito: string): FilaDeSenales {
  return { distrito, casos: 0, enManzana: 0, hasta150: 0, de150a300: 0, mas300: 0, sinGps: 0, sinCruce: 0, corta: 0, muyCorta: 0 };
}

export function construirSenales(reports: MonitoreoTerritorialDashboard | null | undefined): ModeloSenales {
  const filas = Array.isArray(reports?.response_audit) ? reports.response_audit : [];
  const distancias = filas.map(distanciaDe).filter((valor): valor is number => valor != null);
  const duraciones = filas
    .map((fila) => Number(fila.duration_seconds))
    .filter((segundos) => Number.isFinite(segundos) && segundos > 0)
    .map((segundos) => segundos / 60);

  const porDistrito = new Map<string, FilaDeSenales>();
  let sinDistrito = 0;
  for (const fila of filas) {
    if (!String(fila.distrito ?? "").trim()) {
      sinDistrito += 1;
      continue;
    }
    const nombre = nombreDeDistrito(fila.distrito);
    const acumulado = porDistrito.get(nombre) ?? filaVacia(nombre);
    acumulado.casos += 1;
    if (fila.geo_estado === "geo_ok") acumulado.enManzana += 1;
    else if (fila.geo_estado === "geo_cerca") acumulado.hasta150 += 1;
    else if (fila.geo_estado === "geo_revision") acumulado.de150a300 += 1;
    else if (fila.geo_estado === "geo_no_defendible") acumulado.mas300 += 1;
    else if (fila.geo_estado === "geo_sin_cruce") acumulado.sinCruce += 1;
    else acumulado.sinGps += 1;
    const segundos = Number(fila.duration_seconds);
    const estado = territorialDurationOperationalStatusFromValues({
      seconds: Number.isFinite(segundos) && segundos > 0 ? segundos : null,
      durationStatus: fila.duration_status,
      durationOperationalStatus: fila.duration_operational_status,
      durationOperationalLabel: fila.duration_operational_label,
    });
    if (estado === "muy_corto") acumulado.muyCorta += 1;
    else if (estado === "corto") acumulado.corta += 1;
    porDistrito.set(nombre, acumulado);
  }
  const distritos = [...porDistrito.values()].sort((a, b) => a.distrito.localeCompare(b.distrito, "es"));
  const total = distritos.reduce((suma, fila) => {
    for (const clave of ["casos", "enManzana", "hasta150", "de150a300", "mas300", "sinGps", "sinCruce", "corta", "muyCorta"] as const) {
      suma[clave] += fila[clave];
    }
    return suma;
  }, filaVacia("Total"));

  return {
    disponible: filas.length > 0,
    distancia: histograma(distancias, CORTES_DE_DISTANCIA, "m", (desde) => (desde >= 300 ? "lejos" : desde >= 150 ? "revision" : undefined)),
    duracion: histograma(duraciones, CORTES_DE_DURACION_MIN, "min", (desde) => (
      desde < TERRITORIAL_DURATION_VERY_SHORT_SECONDS / 60 ? "muy-corta" : desde < TERRITORIAL_DURATION_SHORT_SECONDS / 60 ? "corta" : undefined
    )),
    distritos,
    total,
    sinDistrito,
  };
}
