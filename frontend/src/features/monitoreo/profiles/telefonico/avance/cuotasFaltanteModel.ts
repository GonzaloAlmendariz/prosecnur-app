/**
 * Avance › Cuotas del telefónico: cuánto falta por cuota (ficha «Avance,
 * Cuotas (aterrizaje)» de `docs/qa/revamp-monitoreo/telefonico.md`).
 *
 * Modelo puro: recibe las cuotas ya leídas del bloque `cuotas_variable` (con
 * su serie diaria de `avance_efectivo_variable_dia`) y devuelve lo que la
 * vista pinta. Ritmo y rendimiento salen de `buildTelefonicoCumplimiento`,
 * el mismo modelo que usaba el panel de cumplimiento, para que ninguna
 * pantalla invente su versión.
 *
 * Lo que el diseño muestra y el payload no trae no se inventa: la muestra por
 * familia de status de la hoja y la separación Muestra/Backup no viajan por
 * cuota, así que el reparto se arma con lo que sí viaja (efectivas, rechazos y
 * parciales, sin llamar) sobre el listado completo de cada categoría.
 */

import { caracterEfectivo, estadoDeCuota, type CaracterDeCuota, type EstadoDeCuota } from "../../../core/caracterDeCuota";
import { buildTelefonicoCumplimiento } from "../telefonicoGoalModel";
import { parseAcreditacionDailyDate } from "./ritmoDiario";

export type CuotaDeEntrada = {
  id: string;
  actor: string;
  universe: number;
  effective: number;
  partial: number;
  refusals: number;
  pending: number;
  meta: number | null;
  dailyPoints: ReadonlyArray<{ date: string; effective: number; total?: number }>;
  /** ADR 0126: lo que publica el motor (`Caracter`); sin él, meta si hay número. */
  caracter?: CaracterDeCuota | null;
  /** `estado_cuota` del motor, si viaja. */
  estadoCuota?: EstadoDeCuota | null;
  /** El número de una referencial declarada (`Referencia` del motor): nunca un piso. */
  referencia?: number | null;
};

export type PuntoAcumulado = { fecha: string; valor: number };

export type FilaDeCuota = {
  clave: string;
  nombre: string;
  estado: "cumple" | "en-curso" | "sin-meta";
  /** ADR 0126. Una referencial no tiene meta: su número viaja en `referencia`. */
  caracter: CaracterDeCuota;
  estadoCuota: EstadoDeCuota;
  meta: number | null;
  referencia: number | null;
  efectivas: number;
  faltan: number | null;
  pct: number | null;
  acumulado: PuntoAcumulado[];
  /** Fecha («05/07») en que el acumulado alcanzó la meta. */
  cumplio: string | null;
  /** La misma fecha en ISO, para ordenar. */
  cumplioClave: string | null;
  sinLlamar: number;
  universo: number;
  rechazoOParcial: number;
  llamadoSinEfectiva: number;
};

/**
 * Una cuota referencial (ADR 0126 §4): lo obtenido frente al listado, en
 * puntos y con su `n`, sin faltante ni veredicto. El comparador es la hoja de
 * barrido: el marco, no la población.
 */
export type FilaReferencial = {
  clave: string;
  nombre: string;
  efectivas: number;
  universo: number;
  /** Parte de las efectivas de la variable, de 0 a 100; null sin efectivas. */
  obtenida: number | null;
  /** Parte del listado de la variable, de 0 a 100; null sin listado. */
  esperada: number | null;
  /** obtenida − esperada, en puntos. */
  diferencia: number | null;
  /** El número declarado, si lo trae: una referencia, nunca un piso. */
  referencia: number | null;
  /** Con listado y ninguna efectiva: impide posestratificar. Un hecho, no una alarma. */
  celdaVacia: boolean;
  estadoCuota: EstadoDeCuota;
};

export type CadenaDeLaCifra = Array<{ nombre: string; detalle: string; valor: number }>;

export type CuotasFaltante = {
  segmento: string;
  /** De dónde salen las efectivas (`origenDeEfectivas.ts`); sin dato, Kobo. */
  origen?: import("./origenDeEfectivas").OrigenDeEfectivas;
  /** Avisos del numerador con su causa (`avisos_numerador`). */
  avisos?: string[];
  /** Otras variables con metas que no se muestran aquí (R5), ya rotuladas: «sexo (2)». */
  otrasConMeta?: string[];
  /** Sólo las metas (ADR 0126): lo que se exige. */
  filas: FilaDeCuota[];
  /** Todas las categorías, para el listado: el barrido no distingue carácter. */
  todas: FilaDeCuota[];
  referenciales: FilaReferencial[];
  total: {
    meta: number | null;
    /** Todas las efectivas de la variable (la cifra de «De dónde sale»). */
    efectivas: number;
    /** Sólo las de las metas con número; el % de la meta no compensa entre celdas. */
    efectivasDeMetas: number;
    faltan: number | null;
    pct: number | null;
    desde: string | null;
    hasta: string | null;
    cumplio: string | null;
    sinLlamar: number;
    universo: number;
  };
  ritmo: { porDia: number; dias: number } | null;
  rendimiento: number | null;
  sinAsignar: number | null;
  /** Fechas comunes y faltante al cierre de cada día, por categoría. */
  faltanteDiario: { fechas: string[]; series: Array<{ clave: string; nombre: string; valores: number[] }> };
};

function claveDeFecha(fecha: string): string {
  const parsed = parseAcreditacionDailyDate(fecha);
  if (!parsed) return "";
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${dos(parsed.getMonth() + 1)}-${dos(parsed.getDate())}`;
}

/** «2026-07-05» a «05/07». */
export function fechaCorta(clave: string | null): string | null {
  if (!clave) return null;
  const partes = clave.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return partes ? `${partes[3]}/${partes[2]}` : clave;
}

function serieDiaria(puntos: CuotaDeEntrada["dailyPoints"]): Map<string, number> {
  const porDia = new Map<string, number>();
  for (const punto of puntos) {
    const clave = claveDeFecha(punto.date);
    const valor = Number(punto.effective) || 0;
    if (!clave || valor <= 0) continue;
    porDia.set(clave, (porDia.get(clave) ?? 0) + valor);
  }
  return porDia;
}

function acumular(fechas: readonly string[], porDia: Map<string, number>): number[] {
  let suma = 0;
  return fechas.map((fecha) => {
    suma += porDia.get(fecha) ?? 0;
    return suma;
  });
}

function primeraQueAlcanza(fechas: readonly string[], acumulado: readonly number[], meta: number | null): string | null {
  if (meta == null || meta <= 0) return null;
  const indice = acumulado.findIndex((valor) => valor >= meta);
  return indice >= 0 ? fechas[indice] : null;
}

export function construirCuotasFaltante({
  cuotas,
  segmento,
  sinAsignar,
}: {
  cuotas: readonly CuotaDeEntrada[];
  segmento: string;
  /** «No barrido» sin responsable (`no_barridos_responsable`); `null` si no viaja. */
  sinAsignar: number | null;
}): CuotasFaltante {
  const series = cuotas.map((cuota) => serieDiaria(cuota.dailyPoints));
  const fechas = [...new Set(series.flatMap((serie) => [...serie.keys()]))].sort();

  const todas: FilaDeCuota[] = cuotas.map((cuota, indice) => {
    const acumuladoDia = acumular(fechas, series[indice]);
    const caracter = cuota.caracter ?? caracterEfectivo(null, cuota.meta);
    const meta = caracter === "meta" && cuota.meta != null && cuota.meta > 0 ? cuota.meta : null;
    const faltan = meta != null ? Math.max(0, meta - cuota.effective) : null;
    const rechazoOParcial = Math.max(0, cuota.partial) + Math.max(0, cuota.refusals);
    return {
      clave: cuota.id,
      nombre: cuota.actor,
      estado: meta == null ? "sin-meta" : faltan === 0 ? "cumple" : "en-curso",
      caracter,
      estadoCuota: cuota.estadoCuota ?? estadoDeCuota(caracter, caracter === "meta" ? cuota.meta : null, cuota.effective, cuota.universe),
      meta,
      referencia: caracter !== "referencial" ? null
        : cuota.referencia ?? (cuota.meta != null && cuota.meta > 0 ? cuota.meta : null),
      efectivas: cuota.effective,
      faltan,
      pct: meta != null ? (cuota.effective / meta) * 100 : null,
      acumulado: fechas.map((fecha, i) => ({ fecha, valor: acumuladoDia[i] })),
      cumplio: fechaCorta(primeraQueAlcanza(fechas, acumuladoDia, meta)),
      cumplioClave: primeraQueAlcanza(fechas, acumuladoDia, meta),
      sinLlamar: Math.max(0, cuota.pending),
      universo: Math.max(0, cuota.universe),
      rechazoOParcial,
      llamadoSinEfectiva: Math.max(0, cuota.universe - cuota.effective - cuota.pending - rechazoOParcial),
    };
  });

  const cumplimiento = buildTelefonicoCumplimiento({
    categorias: cuotas.map((cuota, indice) => ({
      clave: cuota.id,
      etiqueta: cuota.actor,
      universo: cuota.universe,
      // Una referencial no aporta mínimo: su número es referencia (ADR 0126).
      minimo: todas[indice].meta,
      logrado: cuota.effective,
    })),
    logradoTotal: cuotas.reduce((suma, cuota) => suma + cuota.effective, 0),
    porBarrer: cuotas.reduce((suma, cuota) => suma + cuota.pending, 0),
    barridos: cuotas.reduce((suma, cuota) => suma + Math.max(0, cuota.universe - cuota.pending), 0),
    // El ritmo del estudio suma las cuotas por día: dos cuotas que trabajan el
    // mismo día son un día, no dos.
    serieDiaria: fechas.map((fecha) => series.reduce((suma, serie) => suma + (serie.get(fecha) ?? 0), 0)),
  });

  // Metas y referenciales no se suman entre sí (ADR 0126): el total de metas
  // cuenta las efectivas de las metas, no las de una categoría que no se exige.
  const filas = todas.filter((fila) => fila.caracter === "meta");
  const conMeta = filas.filter((fila) => fila.meta != null);
  const metaTotal = conMeta.length ? conMeta.reduce((suma, fila) => suma + (fila.meta ?? 0), 0) : null;
  const efectivasTotal = todas.reduce((suma, fila) => suma + fila.efectivas, 0);
  const efectivasDeMetas = conMeta.reduce((suma, fila) => suma + fila.efectivas, 0);
  const faltanTotal = conMeta.length ? conMeta.reduce((suma, fila) => suma + (fila.faltan ?? 0), 0) : null;
  const universoTotal = todas.reduce((suma, fila) => suma + fila.universo, 0);
  const parte = (valor: number, total: number) => (total > 0 ? (valor / total) * 100 : null);
  const referenciales: FilaReferencial[] = todas.filter((fila) => fila.caracter === "referencial").map((fila) => {
    const obtenida = parte(fila.efectivas, efectivasTotal);
    const esperada = parte(fila.universo, universoTotal);
    return {
      clave: fila.clave,
      nombre: fila.nombre,
      efectivas: fila.efectivas,
      universo: fila.universo,
      obtenida,
      esperada,
      diferencia: obtenida != null && esperada != null ? obtenida - esperada : null,
      referencia: fila.referencia,
      celdaVacia: fila.universo > 0 && fila.efectivas <= 0,
      estadoCuota: fila.estadoCuota,
    };
  });
  return {
    segmento,
    filas,
    todas,
    referenciales,
    total: {
      meta: metaTotal,
      efectivas: efectivasTotal,
      efectivasDeMetas,
      faltan: faltanTotal,
      // Sin compensar entre celdas (ADR 0079): el exceso de una no cubre el
      // faltante de otra, así que el % es lo cubierto de la meta, no Σ efectivas.
      pct: metaTotal ? ((metaTotal - (faltanTotal ?? 0)) / metaTotal) * 100 : null,
      desde: fechaCorta(fechas[0] ?? null),
      hasta: fechaCorta(fechas.at(-1) ?? null),
      // Con cuotas, el total se cumple cuando se cumple la última de ellas:
      // cubrir el total con una categoría corta no es cumplir.
      cumplio: conMeta.length && conMeta.every((fila) => fila.cumplio)
        ? fechaCorta([...conMeta.map((fila) => fila.cumplioClave ?? "")].sort().at(-1) ?? null)
        : null,
      sinLlamar: todas.reduce((suma, fila) => suma + fila.sinLlamar, 0),
      universo: universoTotal,
    },
    ritmo: cumplimiento.ritmo ? { porDia: cumplimiento.ritmo.porDia, dias: cumplimiento.ritmo.diasConDatos } : null,
    rendimiento: cumplimiento.reserva?.costoPorEfectiva ?? null,
    sinAsignar,
    faltanteDiario: {
      fechas,
      series: filas.filter((fila) => fila.meta != null).map((fila) => ({
        clave: fila.clave,
        nombre: fila.nombre,
        valores: fila.acumulado.map((punto) => Math.max(0, (fila.meta ?? 0) - punto.valor)),
      })),
    },
  };
}

/**
 * Con hasta cuatro categorías la tabla deja alto libre: va el faltante diario.
 * Era «menos de cuatro» y el RMS, con sus cuatro actores, dejaba media tarjeta
 * vacía bajo el Total (Gonzalo, 2026-10-27).
 */
export function llevaFaltanteDiario(modelo: CuotasFaltante): boolean {
  return modelo.filas.length > 0 && modelo.filas.length <= 4 && modelo.faltanteDiario.fechas.length > 1
    && modelo.faltanteDiario.series.length > 0;
}

/**
 * «De dónde sale la cifra» con lo que viaja: envíos recibidos por la encuesta
 * (si la metadata del sync los cuenta), envíos que pasan el filtro de efectiva
 * (`control_tiempo_kobo`) y efectivas únicas que cuentan para la cuota.
 */
export function cadenaDeLaCifra({
  recibidas,
  encuesta,
  pasanFiltro,
  criterios,
  unicas,
}: {
  recibidas: number | null;
  encuesta: string;
  pasanFiltro: number | null;
  criterios: string;
  unicas: number;
}): CadenaDeLaCifra {
  const pasos: CadenaDeLaCifra = [];
  if (recibidas != null && recibidas > 0) pasos.push({ nombre: "Recibidas en Kobo", detalle: encuesta, valor: recibidas });
  if (pasanFiltro != null && pasanFiltro > 0) pasos.push({ nombre: "Pasan el filtro de efectiva", detalle: criterios, valor: pasanFiltro });
  pasos.push({ nombre: "Únicas por CodPulso", detalle: "Las que cuentan para la cuota", valor: unicas });
  return pasos;
}
