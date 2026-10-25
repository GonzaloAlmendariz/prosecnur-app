import { normalizeSourceMatch } from "../formato";
import { rowNumber, rowText, type AcreditacionAdvanceCard } from "./tarjetasDeAvance";

/**
 * Modelo puro de Avance › Resumen y Avance › Por público (A1 y A2 del diseño).
 *
 * Todas las cifras por público salen de `advanceCardsFromRows` (las mismas
 * tarjetas que lee la barra del modo) y las series de `daily_general` y
 * `daily_actor` del reporte del cliente. Nada se recalcula por otro camino:
 * el total de efectivas de la curva es el de las tarjetas.
 */

export type DiaDeAvance = { fecha: string; efectivas: number; acumulado: number };

export type TotalesDeAvance = {
  universo: number;
  efectivas: number;
  parciales: number;
  rechazos: number;
  sinRespuesta: number;
  meta: number;
  publicos: number;
  conMeta: number;
};

const ISO = /^\d{4}-\d{2}-\d{2}/;

/** La serie diaria con fecha ISO, ordenada; el acumulado se rehace si falta. */
export function serieDiaria(filas: ReadonlyArray<Record<string, unknown>>): DiaDeAvance[] {
  const dias = filas
    .map((fila) => ({
      fecha: rowText(fila, ["Fecha", "Día", "Dia", "date"], "").slice(0, 10),
      efectivas: rowNumber(fila, ["Efectivas", "Validas", "Válidas"], 0),
      acumulado: rowNumber(fila, ["Acumulado", "Acumuladas"], Number.NaN),
    }))
    .filter((dia) => ISO.test(dia.fecha))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  let suma = 0;
  return dias.map((dia) => {
    suma += dia.efectivas;
    return { fecha: dia.fecha, efectivas: dia.efectivas, acumulado: Number.isFinite(dia.acumulado) ? dia.acumulado : suma };
  });
}

export function totalesDeAvance(tarjetas: readonly AcreditacionAdvanceCard[]): TotalesDeAvance {
  const suma = (valor: (tarjeta: AcreditacionAdvanceCard) => number) => tarjetas.reduce((acc, tarjeta) => acc + valor(tarjeta), 0);
  return {
    universo: suma((tarjeta) => tarjeta.universe),
    efectivas: suma((tarjeta) => tarjeta.effective),
    parciales: suma((tarjeta) => tarjeta.partial),
    rechazos: suma((tarjeta) => tarjeta.refusals),
    sinRespuesta: suma((tarjeta) => tarjeta.pending),
    meta: suma((tarjeta) => tarjeta.meta ?? 0),
    publicos: tarjetas.length,
    conMeta: tarjetas.filter(tieneMeta).length,
  };
}

export function tieneMeta(tarjeta: AcreditacionAdvanceCard): boolean {
  return tarjeta.meta != null && tarjeta.meta > 0;
}

/** Primer día en que el acumulado alcanzó la meta, si ocurrió. */
export function diaDeMetaCumplida(serie: readonly DiaDeAvance[], meta: number): string | null {
  if (!(meta > 0)) return null;
  return serie.find((dia) => dia.acumulado >= meta)?.fecha ?? null;
}

export type Proyeccion =
  | { tipo: "cumplida"; fecha: string | null }
  | { tipo: "faltan"; faltan: number; ritmo: number; dias: number | null }
  | { tipo: "sin-meta" };

/**
 * Cuánto falta y a qué ritmo: el promedio de los últimos siete días de la
 * serie (`acreditacion.md`, A1). Sin ritmo no hay días estimados.
 */
export function proyeccion(serie: readonly DiaDeAvance[], totales: TotalesDeAvance): Proyeccion {
  if (!(totales.meta > 0)) return { tipo: "sin-meta" };
  if (totales.efectivas >= totales.meta) return { tipo: "cumplida", fecha: diaDeMetaCumplida(serie, totales.meta) };
  const ultimos = serie.slice(-7);
  const ritmo = ultimos.length ? ultimos.reduce((suma, dia) => suma + dia.efectivas, 0) / ultimos.length : 0;
  const faltan = totales.meta - totales.efectivas;
  return { tipo: "faltan", faltan, ritmo, dias: ritmo > 0 ? Math.ceil(faltan / ritmo) : null };
}

export type UltimosDias = {
  dias: DiaDeAvance[];
  promedio7: number;
  mejor: DiaDeAvance | null;
  sinEfectivas: number;
};

export function ultimosDias(serie: readonly DiaDeAvance[], cantidad = 14): UltimosDias {
  const dias = serie.slice(-cantidad);
  const siete = dias.slice(-7);
  const mejor = dias.reduce<DiaDeAvance | null>((max, dia) => (!max || dia.efectivas > max.efectivas ? dia : max), null);
  return {
    dias,
    promedio7: siete.length ? siete.reduce((suma, dia) => suma + dia.efectivas, 0) / siete.length : 0,
    mejor: mejor && mejor.efectivas > 0 ? mejor : null,
    sinEfectivas: dias.filter((dia) => dia.efectivas === 0).length,
  };
}

/** Series diarias por público (`daily_actor`), con la clave normalizada del público. */
export function seriesPorPublico(filas: ReadonlyArray<Record<string, unknown>>): Map<string, DiaDeAvance[]> {
  const agrupadas = new Map<string, Array<Record<string, unknown>>>();
  for (const fila of filas) {
    const clave = normalizeSourceMatch(rowText(fila, ["Actor", "Unidad", "Público"], ""));
    if (!clave) continue;
    const lista = agrupadas.get(clave) ?? [];
    lista.push(fila);
    agrupadas.set(clave, lista);
  }
  return new Map([...agrupadas].map(([clave, lista]) => [clave, serieDiaria(lista)]));
}

/** Las efectivas de un público en las fechas dadas (cero si ese día no hubo). */
export function enFechas(serie: readonly DiaDeAvance[] | undefined, fechas: readonly string[]): number[] {
  const porFecha = new Map((serie ?? []).map((dia) => [dia.fecha, dia.efectivas]));
  return fechas.map((fecha) => porFecha.get(fecha) ?? 0);
}

/** Rezagados primero: menor avance contra la meta arriba; sin meta al final. */
export function rezagadosPrimero(tarjetas: readonly AcreditacionAdvanceCard[]): AcreditacionAdvanceCard[] {
  const avance = (tarjeta: AcreditacionAdvanceCard) => (tieneMeta(tarjeta) ? tarjeta.effective / (tarjeta.meta as number) : Number.POSITIVE_INFINITY);
  return [...tarjetas].sort((a, b) => avance(a) - avance(b) || b.universe - a.universe);
}

/** Por universo, de mayor a menor (A2). */
export function porUniverso(tarjetas: readonly AcreditacionAdvanceCard[]): AcreditacionAdvanceCard[] {
  return [...tarjetas].sort((a, b) => b.universe - a.universe || a.actor.localeCompare(b.actor, "es"));
}

/** Efectivas del público por canal, de `client_report.sources` (`Actor`, `Canal`, `Efectivas`). */
export function efectivasPorCanal(fuentes: ReadonlyArray<Record<string, unknown>>, actor: string): Array<{ canal: string; efectivas: number }> {
  const clave = normalizeSourceMatch(actor);
  const porCanal = new Map<string, number>();
  for (const fila of fuentes) {
    if (normalizeSourceMatch(rowText(fila, ["Actor", "Unidad"], "")) !== clave) continue;
    const canal = rowText(fila, ["Canal", "Modalidad"], "Sin canal");
    porCanal.set(canal, (porCanal.get(canal) ?? 0) + rowNumber(fila, ["Efectivas"], 0));
  }
  return [...porCanal]
    .map(([canal, efectivas]) => ({ canal, efectivas }))
    .filter((item) => item.efectivas > 0)
    .sort((a, b) => b.efectivas - a.efectivas);
}

/** Marcas «redondas» para un eje de 0 a `maximo` (4 o 5 intervalos). */
export function marcasDeEje(maximo: number): number[] {
  if (!(maximo > 0)) return [0, 1];
  const crudo = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10].map((factor) => factor * potencia).find((valor) => valor >= crudo) ?? crudo;
  const marcas: number[] = [];
  for (let valor = 0; valor < maximo + paso * 0.999; valor += paso) marcas.push(Math.round(valor * 1000) / 1000);
  return marcas;
}
