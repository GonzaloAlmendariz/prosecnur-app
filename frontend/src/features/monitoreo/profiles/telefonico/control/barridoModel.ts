/**
 * Control › Barrido del telefónico (ficha «Control, Barrido»): cómo rinde la
 * hoja de barrido. Modelo puro sobre bloques que ya viajan:
 * `resumen_telefonico`, `estatus_telefonico`, `estatus_dia`,
 * `no_barridos_responsable` y las cuotas de `cuotas_variable`.
 *
 * Lo que el lienzo dibuja y el corte no trae no se inventa: la muestra frente
 * a la reserva (columna `Origen`) y la familia de status por categoría no
 * viajan por cuota. La tabla por categoría reparte con lo que sí trae
 * `cuotas_variable` (parciales, rechazos, sin llamar y efectivas en Kobo).
 */

import type { MonitoreoAcreditacionReports, MonitoreoStateRule } from "../../../../../api/client";
import { filasDeBloque } from "../navegacion/bloques";
import { clasificadorDeStatus, type FamiliaDelCliente } from "./familiasDelCliente";

type Fila = Record<string, unknown>;

function texto(valor: unknown) {
  return valor == null ? "" : String(valor).trim();
}

function numero(valor: unknown): number {
  const n = Number(texto(valor).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normal(valor: unknown) {
  return texto(valor).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export type CuotaDeBarrido = {
  actor: string;
  universe: number;
  effective: number;
  partial: number;
  refusals: number;
  pending: number;
};

export type FilaDeCategoria = {
  nombre: string;
  listado: number;
  llamados: number;
  pctLlamado: number | null;
  parcial: number;
  rechazo: number;
  efectivasKobo: number;
  sinLlamar: number;
};

export type GrupoDeStatus = {
  familia: Exclude<FamiliaDelCliente, "sin-llamar">;
  total: number;
  items: Array<{ status: string; casos: number; conRegla: boolean; porRegla: boolean }>;
};

export type Barrido = {
  listado: number;
  llamados: number;
  sinLlamar: number;
  efectivasHoja: number;
  efectivasKobo: number;
  categorias: FilaDeCategoria[];
  total: FilaDeCategoria;
  status: GrupoDeStatus[];
  maximoStatus: number;
  porFecha: Array<{ fecha: string; casos: number }>;
  otraFecha: number;
  porLlamarAsignados: number | null;
  sinAsignar: number | null;
};

function pct(parte: number, total: number) {
  return total > 0 ? (parte / total) * 100 : null;
}

/** «1/07/2026», «2026-07-01» o «30/06/2020» a ISO; `null` si no es fecha. */
export function fechaDeColumna(columna: string): string | null {
  const iso = columna.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dma = columna.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dma) {
    const anio = dma[3].length === 2 ? `20${dma[3]}` : dma[3];
    return `${anio}-${dma[2].padStart(2, "0")}-${dma[1].padStart(2, "0")}`;
  }
  return null;
}

/**
 * Llamados por fecha del último intento, desde `estatus_dia` (status × fecha,
 * con las fechas tal como las tecleó el equipo: «1/07/2026» y «2026-07-01» son
 * el mismo día). Una fecha de otro año que el grueso de la hoja (un «2020»
 * tecleado por error) va a «otra o sin fecha» con las vacías.
 */
export function llamadosPorFecha(filas: readonly Fila[]): {
  porFecha: Array<{ fecha: string; casos: number }>;
  otraFecha: number;
  /** Lo que cayó en «otra o sin fecha», por cómo vino escrito. */
  otras: Array<{ etiqueta: string; casos: number }>;
} {
  const porDia = new Map<string, number>();
  const otras = new Map<string, number>();
  let otra = 0;
  filas.forEach((fila) => {
    if (normal(fila.Estado) === "no barrido") return;
    Object.entries(fila).forEach(([columna, valor]) => {
      if (columna === "Estado" || columna === "Total" || columna.startsWith("_")) return;
      const casos = numero(valor);
      if (!casos) return;
      const iso = fechaDeColumna(columna);
      if (iso) porDia.set(iso, (porDia.get(iso) ?? 0) + casos);
      else {
        otra += casos;
        otras.set(columna, (otras.get(columna) ?? 0) + casos);
      }
    });
  });
  const porAnio = new Map<string, number>();
  porDia.forEach((casos, iso) => porAnio.set(iso.slice(0, 4), (porAnio.get(iso.slice(0, 4)) ?? 0) + casos));
  const anio = [...porAnio.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const porFecha: Array<{ fecha: string; casos: number }> = [];
  [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([iso, casos]) => {
    if (iso.slice(0, 4) === anio) porFecha.push({ fecha: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`, casos });
    else {
      otra += casos;
      const etiqueta = `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
      otras.set(etiqueta, (otras.get(etiqueta) ?? 0) + casos);
    }
  });
  return {
    porFecha,
    otraFecha: otra,
    otras: [...otras.entries()].sort((a, b) => b[1] - a[1]).map(([etiqueta, casos]) => ({ etiqueta, casos })),
  };
}

export function construirBarrido({
  reports,
  reglas,
  cuotas,
}: {
  reports: MonitoreoAcreditacionReports | null | undefined;
  reglas: readonly MonitoreoStateRule[];
  cuotas: readonly CuotaDeBarrido[];
}): Barrido {
  const resumen = filasDeBloque(reports, ["resumen_telefonico"]);
  const valorDeResumen = (indicador: string) => {
    const fila = resumen.find((item) => normal(item.Indicador) === indicador);
    return fila ? numero(fila.Casos) : null;
  };
  const clasificar = clasificadorDeStatus(reglas);
  const estatus = filasDeBloque(reports, ["estatus_telefonico"])
    .map((fila) => ({ status: texto(fila.Estatus ?? fila.Estado), casos: numero(fila.Casos) }))
    .filter((item) => item.status && item.casos > 0);

  const grupos = new Map<GrupoDeStatus["familia"], GrupoDeStatus>();
  let sinLlamarDeStatus = 0;
  let efectivasHoja = 0;
  estatus.forEach(({ status, casos }) => {
    const { familia, conRegla, porRegla } = clasificar(status);
    if (familia === "sin-llamar") {
      sinLlamarDeStatus += casos;
      return;
    }
    if (familia === "efectiva") efectivasHoja += casos;
    const grupo = grupos.get(familia) ?? { familia, total: 0, items: [] };
    grupo.total += casos;
    grupo.items.push({ status, casos, conRegla, porRegla });
    grupos.set(familia, grupo);
  });
  const orden: GrupoDeStatus["familia"][] = ["efectiva", "parcial", "rechazo", "reintentable", "terminal"];
  const status = orden
    .map((familia) => grupos.get(familia))
    .filter((grupo): grupo is GrupoDeStatus => Boolean(grupo))
    .map((grupo) => ({ ...grupo, items: [...grupo.items].sort((a, b) => b.casos - a.casos) }));

  const categorias: FilaDeCategoria[] = cuotas.map((cuota) => {
    const llamados = Math.max(0, cuota.universe - cuota.pending);
    return {
      nombre: cuota.actor,
      listado: cuota.universe,
      llamados,
      pctLlamado: pct(llamados, cuota.universe),
      parcial: cuota.partial,
      rechazo: cuota.refusals,
      efectivasKobo: cuota.effective,
      sinLlamar: cuota.pending,
    };
  }).sort((a, b) => b.listado - a.listado || a.nombre.localeCompare(b.nombre, "es"));
  const suma = (clave: keyof Omit<FilaDeCategoria, "nombre" | "pctLlamado">) => categorias.reduce((total, fila) => total + fila[clave], 0);
  const total: FilaDeCategoria = {
    nombre: "Total",
    listado: suma("listado"),
    llamados: suma("llamados"),
    pctLlamado: pct(suma("llamados"), suma("listado")),
    parcial: suma("parcial"),
    rechazo: suma("rechazo"),
    efectivasKobo: suma("efectivasKobo"),
    sinLlamar: suma("sinLlamar"),
  };

  const listado = valorDeResumen("total telefonico") ?? total.listado;
  const llamados = valorDeResumen("casos barridos") ?? total.llamados;
  const noBarridos = filasDeBloque(reports, ["no_barridos_responsable"]);
  const esSinAsignar = (fila: Fila) => ["sin responsable", "sin asignar", ""].includes(normal(fila.Responsable));
  const { porFecha, otraFecha } = llamadosPorFecha(filasDeBloque(reports, ["estatus_dia"]));

  return {
    listado,
    llamados,
    sinLlamar: valorDeResumen("no barridos") ?? sinLlamarDeStatus,
    efectivasHoja,
    efectivasKobo: total.efectivasKobo,
    categorias,
    total,
    status,
    maximoStatus: Math.max(1, ...status.flatMap((grupo) => grupo.items.map((item) => item.casos))),
    porFecha,
    otraFecha,
    porLlamarAsignados: noBarridos.length
      ? noBarridos.filter((fila) => !esSinAsignar(fila)).reduce((s, fila) => s + numero(fila["No barridos"]), 0)
      : null,
    sinAsignar: noBarridos.length
      ? noBarridos.filter(esSinAsignar).reduce((s, fila) => s + numero(fila["No barridos"]), 0)
      : null,
  };
}
