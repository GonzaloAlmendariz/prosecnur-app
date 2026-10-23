/**
 * Avance › Ritmo del telefónico: las efectivas de Kobo por día y categoría,
 * los llamados que registra la hoja en el mismo eje de fechas, el mapa de
 * calor categoría por día y cómo vienen escritas las fechas de la hoja.
 *
 * Modelo puro sobre bloques que ya viajan: `avance_efectivo_variable_dia`
 * (Kobo por variable de cuota y fecha), `avance_efectivo_dia` (Kobo por fecha,
 * respaldo sin variable) y `estatus_dia` (status de la hoja por fecha del
 * último intento, con las fechas como las tecleó el equipo). La hora de
 * inicio de las efectivas no viaja en el corte y no se dibuja.
 */

import type { MonitoreoAcreditacionReports, MonitoreoStateRule } from "../../../../../api/client";
import { fechaDeColumna } from "../control/barridoModel";
import { clasificadorDeStatus, type FamiliaDelCliente } from "../control/familiasDelCliente";
import { filasDeBloque } from "../navegacion/bloques";
import { nombreDelSegmento } from "../segmentoDeCuotas";

type Fila = Record<string, unknown>;

function texto(valor: unknown) {
  return valor == null ? "" : String(valor).trim();
}

function numero(valor: unknown) {
  const n = Number(texto(valor).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function fechaCorta(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Año que tiene más casos: lo demás es una fecha tecleada de otro año. */
function anioDominante(porIso: Map<string, number>) {
  const porAnio = new Map<string, number>();
  porIso.forEach((casos, iso) => porAnio.set(iso.slice(0, 4), (porAnio.get(iso.slice(0, 4)) ?? 0) + casos));
  return [...porAnio.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export type SerieKobo = {
  /** Fechas ISO con efectivas, en orden. */
  fechas: string[];
  /** Categorías de la variable de cuota, de más a menos efectivas. */
  categorias: Array<{ nombre: string; total: number }>;
  /** Efectivas por categoría y fecha ISO. */
  celdas: Record<string, Record<string, number>>;
  porFecha: Record<string, number>;
  total: number;
  /** Fechas sin parsear (o «Sin fecha»), que no entran al eje. */
  sinFecha: number;
  /** Valores del eje sin cuota («Sin dato», o un valor sin meta): no entran a la serie. */
  fueraDeCuota: Array<{ nombre: string; casos: number }>;
};

function claveDeValor(valor: unknown) {
  return texto(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
}

export function serieKobo(
  reports: MonitoreoAcreditacionReports | null | undefined,
  segmento: string,
  /** Si viene, sólo cuentan los valores con cuota (como el diario de Avance › Cuotas). */
  valoresDeCuota?: ReadonlySet<string>,
): SerieKobo {
  const porVariable = filasDeBloque(reports, ["avance_efectivo_variable_dia"])
    .filter((fila) => !segmento || texto(fila.Variable).toLocaleLowerCase("es") === segmento.toLocaleLowerCase("es"));
  const filas: Array<{ categoria: string; fecha: string; casos: number }> = porVariable.length
    ? porVariable.map((fila) => ({ categoria: texto(fila.Valor) || "Sin dato", fecha: texto(fila.Fecha), casos: numero(fila["Efectivas Kobo"] ?? fila.Efectivas) }))
    : filasDeBloque(reports, ["avance_efectivo_dia"]).map((fila) => ({ categoria: "Efectivas", fecha: texto(fila.Fecha), casos: numero(fila["Efectivas Kobo"] ?? fila.Efectivas) }));
  const celdas: Record<string, Record<string, number>> = {};
  const porFecha: Record<string, number> = {};
  const totales = new Map<string, number>();
  let sinFecha = 0;
  const fueraDeCuota = new Map<string, number>();
  filas.forEach(({ categoria, fecha, casos }) => {
    if (!casos) return;
    if (porVariable.length && valoresDeCuota?.size && !valoresDeCuota.has(claveDeValor(categoria))) {
      if (fechaDeColumna(fecha)) fueraDeCuota.set(categoria, (fueraDeCuota.get(categoria) ?? 0) + casos);
      return;
    }
    const iso = fechaDeColumna(fecha);
    if (!iso) {
      sinFecha += casos;
      return;
    }
    celdas[categoria] = celdas[categoria] ?? {};
    celdas[categoria][iso] = (celdas[categoria][iso] ?? 0) + casos;
    porFecha[iso] = (porFecha[iso] ?? 0) + casos;
    totales.set(categoria, (totales.get(categoria) ?? 0) + casos);
  });
  const fechas = Object.keys(porFecha).sort();
  return {
    fechas,
    categorias: [...totales.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")).map(([nombre, total]) => ({ nombre, total })),
    celdas,
    porFecha,
    total: fechas.reduce((suma, iso) => suma + porFecha[iso], 0),
    sinFecha,
    fueraDeCuota: [...fueraDeCuota.entries()].sort((a, b) => b[1] - a[1]).map(([nombre, casos]) => ({ nombre, casos })),
  };
}

export type FamiliaDeLlamada = Exclude<FamiliaDelCliente, "sin-llamar">;

export const FAMILIAS_DE_LLAMADA: readonly FamiliaDeLlamada[] = ["efectiva", "parcial", "rechazo", "reintentable", "terminal"];

export type SerieHoja = {
  /** Llamados por fecha ISO del año dominante y familia del status. */
  porFecha: Record<string, Record<FamiliaDeLlamada, number>>;
  totalPorFecha: Record<string, number>;
  /** Última fecha con llamados registrados, ISO, o null. */
  ultima: string | null;
};

export function serieHoja(reports: MonitoreoAcreditacionReports | null | undefined, reglas: readonly MonitoreoStateRule[]): SerieHoja {
  const clasificar = clasificadorDeStatus(reglas);
  const crudo = new Map<string, Record<FamiliaDeLlamada, number>>();
  const totales = new Map<string, number>();
  filasDeBloque(reports, ["estatus_dia"]).forEach((fila: Fila) => {
    const status = texto(fila.Estado ?? fila.Estatus);
    const { familia } = clasificar(status);
    if (familia === "sin-llamar") return;
    Object.entries(fila).forEach(([columna, valor]) => {
      if (["Estado", "Estatus", "Total"].includes(columna) || columna.startsWith("_")) return;
      const iso = fechaDeColumna(columna);
      const casos = numero(valor);
      if (!iso || !casos) return;
      const actual = crudo.get(iso) ?? { efectiva: 0, parcial: 0, rechazo: 0, reintentable: 0, terminal: 0 };
      actual[familia] += casos;
      crudo.set(iso, actual);
      totales.set(iso, (totales.get(iso) ?? 0) + casos);
    });
  });
  const anio = anioDominante(totales);
  const porFecha: SerieHoja["porFecha"] = {};
  const totalPorFecha: Record<string, number> = {};
  [...crudo.entries()].filter(([iso]) => iso.slice(0, 4) === anio).forEach(([iso, familias]) => {
    porFecha[iso] = familias;
    totalPorFecha[iso] = totales.get(iso) ?? 0;
  });
  const fechas = Object.keys(porFecha).sort();
  return { porFecha, totalPorFecha, ultima: fechas.at(-1) ?? null };
}

export type FormatoDeFecha = { etiqueta: string; casos: number; aviso: boolean };

/**
 * Cómo vienen escritas las fechas de la hoja: cada columna de `estatus_dia` es
 * una fecha tal como se tecleó. Se agrupan por forma, y aparte las de otro año
 * y los llamados sin fecha. `dias` cuenta los días distintos del año dominante
 * y `columnas` cuántos valores distintos trae la hoja.
 */
export function formatosDeFecha(reports: MonitoreoAcreditacionReports | null | undefined) {
  const porColumna = new Map<string, number>();
  filasDeBloque(reports, ["estatus_dia"]).forEach((fila: Fila) => {
    const status = texto(fila.Estado ?? fila.Estatus).toLocaleLowerCase("es");
    if (status === "no barrido") return;
    Object.entries(fila).forEach(([columna, valor]) => {
      if (["Estado", "Estatus", "Total"].includes(columna) || columna.startsWith("_")) return;
      const casos = numero(valor);
      if (casos) porColumna.set(columna, (porColumna.get(columna) ?? 0) + casos);
    });
  });
  const porIso = new Map<string, number>();
  porColumna.forEach((casos, columna) => {
    const iso = fechaDeColumna(columna);
    if (iso) porIso.set(iso, (porIso.get(iso) ?? 0) + casos);
  });
  const anio = anioDominante(porIso);
  const grupos = new Map<string, FormatoDeFecha>();
  const sumar = (etiqueta: string, casos: number, aviso: boolean) => {
    const actual = grupos.get(etiqueta) ?? { etiqueta, casos: 0, aviso };
    actual.casos += casos;
    grupos.set(etiqueta, actual);
  };
  porColumna.forEach((casos, columna) => {
    const iso = fechaDeColumna(columna);
    if (!iso) sumar("Llamados sin fecha", casos, true);
    else if (iso.slice(0, 4) !== anio) sumar(`Año ${iso.slice(0, 4)}, de otro año que la hoja`, casos, true);
    else if (/^\d{4}-/.test(columna)) sumar("Año, mes y día (2026-07-01)", casos, false);
    else if (/^\d\//.test(columna)) sumar("Día con un dígito (1/07/2026)", casos, false);
    else sumar("Día con dos dígitos (01/07/2026)", casos, false);
  });
  return {
    formatos: [...grupos.values()].sort((a, b) => Number(a.aviso) - Number(b.aviso) || b.casos - a.casos),
    /** Cada valor tal como viene en la hoja, con sus llamados: lo que hay que corregir en ella. */
    valores: [...porColumna.entries()]
      .map(([valor, casos]) => ({ valor, casos, aviso: !fechaDeColumna(valor) || fechaDeColumna(valor)?.slice(0, 4) !== anio }))
      .sort((a, b) => b.casos - a.casos || a.valor.localeCompare(b.valor, "es")),
    columnas: porColumna.size,
    dias: [...porIso.keys()].filter((iso) => iso.slice(0, 4) === anio).length,
  };
}

export type ResumenDeRitmo = {
  dias: number;
  promedio: number | null;
  pico: { fecha: string; casos: number } | null;
  /** Fecha ISO en que el acumulado alcanza la meta, o null. */
  metaCruzada: string | null;
  acumulado: Record<string, number>;
};

export function resumenDeRitmo(serie: Pick<SerieKobo, "fechas" | "porFecha" | "total">, meta: number | null): ResumenDeRitmo {
  let acumulado = 0;
  let metaCruzada: string | null = null;
  const porFecha: Record<string, number> = {};
  serie.fechas.forEach((iso) => {
    acumulado += serie.porFecha[iso] ?? 0;
    porFecha[iso] = acumulado;
    if (meta && !metaCruzada && acumulado >= meta) metaCruzada = iso;
  });
  const pico = serie.fechas.reduce<{ fecha: string; casos: number } | null>((mejor, iso) => (
    !mejor || (serie.porFecha[iso] ?? 0) > mejor.casos ? { fecha: iso, casos: serie.porFecha[iso] ?? 0 } : mejor
  ), null);
  return {
    dias: serie.fechas.length,
    promedio: serie.fechas.length ? serie.total / serie.fechas.length : null,
    pico,
    metaCruzada,
    acumulado: porFecha,
  };
}

/** Segmento de cuota del corte (Sede, Actor…), el mismo de Avance › Cuotas. */
export function segmentoDeCuotas(reports: MonitoreoAcreditacionReports | null | undefined) {
  return nombreDelSegmento(filasDeBloque(reports, ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"])
    .map((fila) => texto(fila.Variable)));
}

/**
 * La serie diaria de efectivas que comparten Ritmo, el calendario de Cuotas,
 * la vista del PDF de Entregas y los chips: la de las categorías de cuota,
 * que es la que suma Avance › Cuotas y FALTAN. Una efectiva de Kobo que no cae
 * en ninguna categoría no entra a la serie; se cuenta aparte (`sinCategoria`)
 * para que la vista lo declare en vez de mostrar dos totales.
 */
export function serieDiariaDelCorte(reports: MonitoreoAcreditacionReports | null | undefined) {
  const segmento = segmentoDeCuotas(reports);
  // Los valores con cuota del eje: el mismo filtro que el diario de Avance › Cuotas.
  const valoresDeCuota = new Set(
    filasDeBloque(reports, ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"])
      .filter((fila) => texto(fila.Variable).toLocaleLowerCase("es") === segmento.toLocaleLowerCase("es"))
      .map((fila) => claveDeValor(fila.Valor ?? fila["Categoría"] ?? fila.Categoria))
      .filter(Boolean),
  );
  const serie = serieKobo(reports, segmento, valoresDeCuota);
  const fuera = serie.fueraDeCuota.reduce((suma, item) => suma + item.casos, 0);
  const totalDeKobo = filasDeBloque(reports, ["avance_efectivo_dia"]).reduce((suma, fila) => (
    fechaDeColumna(texto(fila.Fecha)) ? suma + numero(fila["Efectivas Kobo"] ?? fila.Efectivas) : suma
  ), 0);
  return {
    segmento,
    serie,
    /** Efectivas de Kobo que no caen en ningún valor del eje. */
    sinCategoria: Math.max(0, totalDeKobo - serie.total - fuera),
    /** Efectivas en valores del eje sin cuota. */
    fueraDeCuota: serie.fueraDeCuota,
  };
}

/** Efectivas por día de la serie compartida, en orden. */
export function efectivasPorDia(reports: MonitoreoAcreditacionReports | null | undefined): Array<{ fecha: string; casos: number }> {
  const { serie } = serieDiariaDelCorte(reports);
  return serie.fechas.map((fecha) => ({ fecha, casos: serie.porFecha[fecha] ?? 0 }));
}

/**
 * «1 efectiva de Kobo sin actor no entra a la serie», y las de valores sin
 * cuota («2 en Sin dato, sin cuota»); vacío si todo cae en un valor con cuota.
 */
export function notaSinCategoria(
  sinCategoria: number,
  segmento: string,
  fueraDeCuota: ReadonlyArray<{ nombre: string; casos: number }> = [],
) {
  const nombre = segmento.toLocaleLowerCase("es");
  const fmt = (n: number) => n.toLocaleString("es-PE");
  const partes = [
    sinCategoria ? `${fmt(sinCategoria)} ${sinCategoria === 1 ? "efectiva" : "efectivas"} de Kobo sin ${nombre}` : "",
    ...fueraDeCuota.map((item) => `${fmt(item.casos)} en «${item.nombre}», que no tiene cuota`),
  ].filter(Boolean);
  if (!partes.length) return "";
  if (partes.length === 1 && sinCategoria) return `${partes[0]} no ${sinCategoria === 1 ? "entra" : "entran"} a la serie`;
  return `No entran a la serie: ${partes.join(" y ")}`;
}

/**
 * Detalle bajo «Válidas» en las salidas (cuenta todas las efectivas de Kobo):
 * «69 con actor y 1 sin actor» cuando alguna no cae en una categoría; vacío si
 * no hay diferencia que explicar.
 */
export function notaDeValidasTelefonica(reports: MonitoreoAcreditacionReports | null | undefined): string | undefined {
  const { serie, sinCategoria, fueraDeCuota, segmento } = serieDiariaDelCorte(reports);
  const fuera = fueraDeCuota.reduce((suma, item) => suma + item.casos, 0);
  if (!sinCategoria && !fuera) return undefined;
  const nombre = segmento.toLocaleLowerCase("es");
  const fmt = (n: number) => n.toLocaleString("es-PE");
  return [
    `${fmt(serie.total)} con cuota`,
    fuera ? `${fmt(fuera)} en ${nombre} sin cuota` : "",
    sinCategoria ? `${fmt(sinCategoria)} sin ${nombre}` : "",
  ].filter(Boolean).join(", ").replace(/, ([^,]*)$/, " y $1");
}

/** La nota de lo que no entra a la serie compartida, para Ritmo, Cuotas y Entregas. */
export function notaDeLaSerie(reports: MonitoreoAcreditacionReports | null | undefined) {
  const { sinCategoria, segmento, fueraDeCuota } = serieDiariaDelCorte(reports);
  return notaSinCategoria(sinCategoria, segmento, fueraDeCuota);
}
