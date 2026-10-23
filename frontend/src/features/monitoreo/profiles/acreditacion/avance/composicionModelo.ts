/**
 * Avance › Por cuota (ficha A3): las variables de control sin meta se leen como
 * composición. Por categoría, el % del universo frente al % de las efectivas
 * y su diferencia en puntos (`client_report.controls`, «Variables de
 * control»). Las que ya tienen cuota no se repiten aquí. Puro y con test.
 */

import type { MonitoreoCuota, MonitoreoCuotaCategoria, MonitoreoCuotaPublico } from "../../../../../api/monitoreoCuotas";
import { normalizeSourceMatch } from "../formato";
import { rowNumber, rowText } from "./tarjetasDeAvance";

export type FilaDePesa = {
  categoria: string;
  universo: number;
  efectivas: number;
  /** De 0 a 100. */
  pctBase: number | null;
  pctEfectivas: number | null;
  /** Puntos porcentuales: efectivas menos universo. */
  delta: number | null;
};

export type VariableDeControl = {
  id: string;
  actor: string;
  variable: string;
  filas: FilaDePesa[];
  maxDelta: number | null;
};

/** El motor publica la proporción de 0 a 1; si ya viene en porcentaje, se respeta. */
function aPorcentaje(valor: unknown): number | null {
  const n = Number(valor);
  if (valor === null || valor === undefined || valor === "" || !Number.isFinite(n)) return null;
  return Math.abs(n) <= 1.0001 ? n * 100 : n;
}

export function idDeControl(actor: string, variable: string) {
  return `control:${actor}::${variable}`;
}

export function variablesDeControl(
  controles: ReadonlyArray<Record<string, unknown>>,
  cuotas: readonly MonitoreoCuota[],
): VariableDeControl[] {
  const conCuota = new Set(cuotas.map((cuota) => `${normalizeSourceMatch(cuota.actor)}::${normalizeSourceMatch(cuota.variable)}`));
  const grupos = new Map<string, VariableDeControl>();
  for (const fila of controles) {
    const actor = rowText(fila, ["Actor", "Unidad"], "");
    const variable = rowText(fila, ["Variable"], "");
    if (!actor || !variable) continue;
    if (conCuota.has(`${normalizeSourceMatch(actor)}::${normalizeSourceMatch(variable)}`)) continue;
    const id = idDeControl(actor, variable);
    const grupo = grupos.get(id) ?? { id, actor, variable, filas: [], maxDelta: null };
    const deltaCrudo = Number(fila["Diferencia pp"]);
    grupo.filas.push({
      categoria: rowText(fila, ["Valor", "Categoría", "Categoria"], "Sin dato"),
      universo: rowNumber(fila, ["Universo"], 0),
      efectivas: rowNumber(fila, ["Efectivas"], 0),
      pctBase: aPorcentaje(fila["% base"]),
      pctEfectivas: aPorcentaje(fila["% efectivas"]),
      delta: fila["Diferencia pp"] === null || fila["Diferencia pp"] === undefined || fila["Diferencia pp"] === "" || !Number.isFinite(deltaCrudo) ? null : deltaCrudo,
    });
    grupos.set(id, grupo);
  }
  return [...grupos.values()].map((grupo) => {
    const deltas = grupo.filas.map((fila) => fila.delta).filter((valor): valor is number => valor != null);
    const maximo = deltas.length ? deltas.reduce((mayor, valor) => (Math.abs(valor) > Math.abs(mayor) ? valor : mayor)) : null;
    return { ...grupo, maxDelta: maximo, filas: [...grupo.filas].sort((a, b) => b.universo - a.universo) };
  }).sort((a, b) => a.actor.localeCompare(b.actor, "es") || a.variable.localeCompare(b.variable, "es"));
}

export type FranjaDeCuota = {
  efectivas: number;
  metaPorCategorias: number;
  metaDelPublico: number | null;
  /** Meta por categorías menos meta del público (redondeo). */
  diferencia: number | null;
  masAtrasada: { categoria: string; avance: number } | null;
};

export function franjaDeCuota(cuota: MonitoreoCuota, publicos: readonly MonitoreoCuotaPublico[]): FranjaDeCuota {
  const conMeta = cuota.categorias.filter((categoria) => (categoria.meta ?? 0) > 0);
  const metaPorCategorias = conMeta.reduce((suma, categoria) => suma + (categoria.meta ?? 0), 0);
  const efectivas = conMeta.length ? conMeta.reduce((suma, categoria) => suma + (categoria.efectivas ?? 0), 0) : cuota.efectivas ?? 0;
  const metaDelPublico = publicos.find((publico) => normalizeSourceMatch(publico.actor) === normalizeSourceMatch(cuota.actor))?.meta ?? null;
  const avanceDe = (categoria: MonitoreoCuotaCategoria) => categoria.avance ?? ((categoria.efectivas ?? 0) / (categoria.meta as number));
  const atrasada = conMeta.reduce<MonitoreoCuotaCategoria | null>((menor, categoria) => (!menor || avanceDe(categoria) < avanceDe(menor) ? categoria : menor), null);
  return {
    efectivas,
    metaPorCategorias,
    metaDelPublico,
    diferencia: metaDelPublico == null ? null : metaPorCategorias - metaDelPublico,
    masAtrasada: atrasada ? { categoria: atrasada.categoria, avance: avanceDe(atrasada) } : null,
  };
}
