import type { MonitoreoState, MonitoreoTerritorialDashboard, TerritorialQuotaProgressItem } from "../../../../../api/client";
import { fmt, nombreDeDistrito, rotuloDeCelda } from "../rotulos";

/**
 * Modelo › Cuotas (territorial.md §3.5b): con qué variables se cuota, la
 * plantilla por UMP (la que usan las manzanas de la ruta), la cuota por
 * distrito y las reglas con que el motor cubre una celda. Se lee aquí.
 *
 * La contradicción entre `route_quota` (celdas cruzadas) y el progreso
 * (marginales) es la pregunta 6: no se decide aquí.
 */

export type CeldaDePlantilla = { clave: string; rotulo: string; meta: number; eje: "sexo" | "edad" };
export type FilaDeCuota = { distrito: string; metas: number[]; total: number };

export type ModeloCuotas = {
  disponible: boolean;
  variables: Array<{ rotulo: string; columna: string; categorias: string[] }>;
  plantilla: CeldaDePlantilla[];
  entrevistasPorUmp: number;
  /** Manzanas que usan la plantilla y las que traen otra. */
  conPlantilla: number;
  conOtra: number;
  distritos: FilaDeCuota[];
  total: FilaDeCuota;
  reglas: { sexoFlexible: boolean | null; edadFlexible: boolean | null };
};

function n(valor: unknown): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function firma(sexo: readonly TerritorialQuotaProgressItem[], edad: readonly TerritorialQuotaProgressItem[]): string {
  return [...sexo.map((item) => `s:${item.label}:${n(item.target)}`), ...edad.map((item) => `e:${item.label}:${n(item.target)}`)].join("|");
}

function bandera(deficits: ReadonlyArray<Record<string, unknown>>, campo: string): boolean | null {
  const valores = deficits.map((item) => item[campo]).filter((valor) => typeof valor === "boolean") as boolean[];
  if (!valores.length) return null;
  return valores.some(Boolean);
}

export function construirCuotas(
  reports: MonitoreoTerritorialDashboard | null | undefined,
  state: MonitoreoState | null | undefined,
  avance?: MonitoreoTerritorialDashboard | null,
): ModeloCuotas {
  const cuota = reports?.route_quota_progress;
  const bloques = (cuota?.blocks ?? []).filter((bloque) => (bloque.sex?.length || bloque.age?.length));
  const porFirma = new Map<string, { veces: number; sexo: TerritorialQuotaProgressItem[]; edad: TerritorialQuotaProgressItem[] }>();
  for (const bloque of bloques) {
    const clave = firma(bloque.sex ?? [], bloque.age ?? []);
    const previo = porFirma.get(clave);
    porFirma.set(clave, { veces: (previo?.veces ?? 0) + 1, sexo: bloque.sex ?? [], edad: bloque.age ?? [] });
  }
  const comun = [...porFirma.values()].sort((a, b) => b.veces - a.veces)[0];
  const plantilla: CeldaDePlantilla[] = comun
    ? [
      ...comun.sexo.map((item) => ({ clave: String(item.label), rotulo: rotuloDeCelda(item.label), meta: n(item.target), eje: "sexo" as const })),
      ...comun.edad.map((item) => ({ clave: String(item.label), rotulo: rotuloDeCelda(item.label), meta: n(item.target), eje: "edad" as const })),
    ]
    : [];

  const territorial = state?.config?.territorial;
  const variables = [
    { rotulo: "Sexo", columna: String(territorial?.sex_var ?? ""), categorias: plantilla.filter((c) => c.eje === "sexo").map((c) => c.rotulo) },
    { rotulo: "Edad", columna: String(territorial?.age_var ?? ""), categorias: plantilla.filter((c) => c.eje === "edad").map((c) => c.rotulo) },
  ].filter((variable) => variable.categorias.length);

  const distritos: FilaDeCuota[] = (cuota?.districts ?? []).map((distrito) => {
    const items = [...(distrito.sex ?? []), ...(distrito.age ?? [])];
    return {
      distrito: nombreDeDistrito(distrito.distrito),
      metas: plantilla.map((celda) => n(items.find((item) => String(item.label) === celda.clave)?.target)),
      total: Math.round(n(distrito.target)),
    };
  }).sort((a, b) => a.distrito.localeCompare(b.distrito, "es"));

  const deficits = ((avance ?? reports)?.operational_adjustments?.deficits ?? []) as unknown as Array<Record<string, unknown>>;

  return {
    disponible: Boolean(cuota?.configured) && plantilla.length > 0,
    variables,
    plantilla,
    entrevistasPorUmp: plantilla.filter((celda) => celda.eje === "sexo").reduce((suma, celda) => suma + celda.meta, 0),
    conPlantilla: comun?.veces ?? 0,
    conOtra: bloques.length - (comun?.veces ?? 0),
    distritos,
    total: {
      distrito: "Total",
      metas: plantilla.map((_, indice) => distritos.reduce((suma, fila) => suma + (fila.metas[indice] ?? 0), 0)),
      total: distritos.reduce((suma, fila) => suma + fila.total, 0),
    },
    reglas: { sexoFlexible: bandera(deficits, "sex_flexible"), edadFlexible: bandera(deficits, "age_flexible") },
  };
}

export function textoDePlantilla(plantilla: readonly CeldaDePlantilla[]): string {
  return plantilla.map((celda) => `${celda.rotulo} ${fmt(celda.meta)}`).join(" · ");
}
