import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { fmt, numeroDeUmp, pctEntero } from "../rotulos";
import { construirFaltante, type EstadoDeUmp, type FilaDeUmp } from "./faltanteModel";

/**
 * Avance › UMP (territorial.md §3.16) y el lateral de Avance › Mapa (§3.15).
 *
 * Las filas salen de las mismas que Faltante por UMP (`construirFaltante`), así
 * que «cuentan», la cuota y el estado de una UMP son idénticos en las tres
 * pestañas. Se agregan las observaciones del avance por manzana y, si el
 * proyecto declara el parte de ocurrencias, lo efectivo frente a lo intentado.
 */

export type ParteDeUmp = { efectivas: number; intentos: number; tasa: string };

export type FilaDeUmpAvance = {
  ump: string;
  distrito: string;
  manzana: string;
  tipo: "Titular" | "Reemplazo";
  aplicador: string;
  cuentan: number;
  meta: number;
  observacion: number;
  cuota: string;
  estado: EstadoDeUmp;
  /** `null` si el proyecto no declara ocurrencias o la UMP no tiene parte. */
  parte: ParteDeUmp | null;
  sinParte: boolean;
  idManzana: string;
  base: FilaDeUmp;
};

export type FiltroDeUmps = "todas" | "pendientes" | "subsanadas" | "completas" | "sin-parte";

export type ModeloUmps = {
  filas: FilaDeUmpAvance[];
  /** El proyecto declara el parte de ocurrencias (E4 lo apaga). */
  conOcurrencias: boolean;
  conteos: Record<FiltroDeUmps, number>;
};

function n(valor: unknown): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

const ORDEN: Record<EstadoDeUmp, number> = { pendiente: 0, subsanada: 1, completa: 2 };

export function textoDeCuota(fila: Pick<FilaDeUmp, "falta" | "estado">): string {
  if (fila.falta > 0) return `Falta ${fmt(fila.falta)}`;
  return fila.estado === "subsanada" ? "Completa con subsanación" : "Completa";
}

/**
 * `avance` aporta la cuota y las subsanaciones; las ocurrencias pueden venir en
 * cualquiera de los dos cortes, así que se buscan en ambos.
 */
export function construirUmps(
  avance: MonitoreoTerritorialDashboard | null | undefined,
  otro?: MonitoreoTerritorialDashboard | null,
): ModeloUmps {
  const base = construirFaltante(avance);
  const revisionPorManzana = new Map(
    (avance?.advance?.block_progress ?? []).map((bloque) => [bloque.id_manzana, Math.round(n(bloque.revision))]),
  );
  const ocurrencias = avance?.field_occurrences ?? otro?.field_occurrences ?? null;
  const porUmp = new Map((ocurrencias?.by_ump ?? []).map((item) => [numeroDeUmp(item.ump), item]));
  const conOcurrencias = Boolean(ocurrencias?.by_ump?.length);

  const filas: FilaDeUmpAvance[] = base.filas.map((fila) => {
    const parte = porUmp.get(fila.ump);
    const conParte = Boolean(parte && (parte.has_report ?? n(parte.reportes) > 0));
    return {
      ump: fila.ump,
      distrito: fila.distrito,
      manzana: fila.manzana,
      tipo: fila.reemplazo ? "Reemplazo" : "Titular",
      aplicador: fila.aplicador,
      cuentan: fila.logrado,
      meta: fila.meta,
      observacion: revisionPorManzana.get(fila.idManzana) ?? 0,
      cuota: textoDeCuota(fila),
      estado: fila.estado,
      parte: conOcurrencias && parte && conParte
        ? { efectivas: Math.round(n(parte.efectivas)), intentos: Math.round(n(parte.intentos)), tasa: pctEntero(n(parte.efectivas), n(parte.intentos)) }
        : null,
      sinParte: conOcurrencias && !conParte,
      idManzana: fila.idManzana,
      base: fila,
    };
  });
  filas.sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || (Number(a.ump) || 0) - (Number(b.ump) || 0));

  return {
    filas,
    conOcurrencias,
    conteos: {
      todas: filas.length,
      pendientes: filas.filter((fila) => fila.estado === "pendiente").length,
      subsanadas: filas.filter((fila) => fila.estado === "subsanada").length,
      completas: filas.filter((fila) => fila.estado === "completa").length,
      "sin-parte": filas.filter((fila) => fila.sinParte).length,
    },
  };
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function filtrarUmps(filas: readonly FilaDeUmpAvance[], filtro: FiltroDeUmps, busqueda = ""): FilaDeUmpAvance[] {
  const termino = normalizar(busqueda.trim());
  return filas.filter((fila) => {
    if (filtro === "pendientes" && fila.estado !== "pendiente") return false;
    if (filtro === "subsanadas" && fila.estado !== "subsanada") return false;
    if (filtro === "completas" && fila.estado !== "completa") return false;
    if (filtro === "sin-parte" && !fila.sinParte) return false;
    if (!termino) return true;
    return normalizar([`UMP ${fila.ump}`, fila.distrito, fila.manzana, fila.aplicador].join(" ")).includes(termino);
  });
}

function celdaCsv(valor: string | number): string {
  const texto = String(valor);
  return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, "\"\"")}"` : texto;
}

/** CSV de lo que se ve, con las mismas columnas y rótulos que la tabla. */
export function csvDeUmps(filas: readonly FilaDeUmpAvance[], conOcurrencias: boolean): string {
  const cabecera = ["UMP", "Distrito", "Manzana", "Tipo", "Aplicador", "Cuentan", "Meta", "En observación", "Cuota"];
  if (conOcurrencias) cabecera.push("Efectivas", "Intentos", "Tasa efectiva");
  const lineas = filas.map((fila) => {
    const valores: Array<string | number> = [fila.ump, fila.distrito, fila.manzana, fila.tipo, fila.aplicador, fila.cuentan, fila.meta, fila.observacion, fila.cuota];
    if (conOcurrencias) valores.push(fila.parte?.efectivas ?? "", fila.parte?.intentos ?? "", fila.parte?.tasa ?? "Sin parte");
    return valores.map(celdaCsv).join(",");
  });
  return [cabecera.map(celdaCsv).join(","), ...lineas].join("\n");
}
