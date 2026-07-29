/**
 * Qué columna de la base sirve para segmentar el avance de un actor.
 *
 * El catálogo del motor trae todas las columnas de cada hoja de universo —27
 * en Egresados, 28 en Docentes— y ahí conviven la que interesa («Ciclo de
 * egreso», «Categoría») con un correlativo `N°` y columnas vacías como
 * `Whatsapp` al 0%. Listarlas al mismo nivel repite el problema que este plan
 * viene quitando: obliga a leerlas todas para descubrir cuál sirve.
 *
 * El orden lo manda la **cobertura**: una columna al 40% no sirve de
 * denominador por bien que puntúe en lo demás. Lo que no puede segmentar no se
 * esconde —se marca con su motivo—, porque un desplegable que oculta opciones
 * sin decir por qué se lee como un error de la app.
 */

import type { MonitoreoSourceVariableStat } from "../../../api/monitoreo";

export type MotivoNoSegmenta =
  | "sin-datos"
  | "identificador"
  | "categoria-unica"
  | "dato-personal"
  /** El catálogo viene de un corte anterior y todavía no trae el reparto. */
  | "sin-analizar";

export type VariableCandidata = {
  name: string;
  label: string;
  cobertura: number;
  categorias: number;
  /** Reparto listo para dibujar; vacío si la columna no es categórica. */
  valores: { value: string; count: number }[];
  otrasCategorias: number;
  otrosCasos: number;
  /** `"anio"` cuando los valores parecen ciclos `AAAA-S`. */
  normalizacionSugerida: "ninguna" | "anio";
  /** `null` cuando la columna sí puede segmentar. */
  motivoNoSegmenta: MotivoNoSegmenta | null;
};

/** Columnas que identifican a una persona: no segmentan y además son sensibles. */
const TIPOS_PERSONALES = new Set(["pucp", "cell", "email", "name"]);

export const EXPLICACION_NO_SEGMENTA: Record<MotivoNoSegmenta, string> = {
  "sin-datos": "la columna está vacía en esta base",
  identificador: "hay un valor distinto por persona",
  "categoria-unica": "todas las filas caen en la misma categoría",
  "dato-personal": "identifica a la persona, no a un grupo",
  "sin-analizar": "su reparto aparece al actualizar la fuente",
};

function motivoDe(stat: MonitoreoSourceVariableStat): MotivoNoSegmenta | null {
  const dist = stat.distribucion;
  const noVacios = dist?.non_empty ?? stat.non_empty ?? 0;
  if (!noVacios) return "sin-datos";
  if (TIPOS_PERSONALES.has(String(stat.kind ?? ""))) return "dato-personal";
  // Un `.pulso` guardado antes de que el catálogo trajera reparto no dice nada
  // sobre las categorías. Tratar esa ausencia como «una sola categoría» marcaba
  // TODAS las columnas como inservibles —las 27 de Egresados incluidas— cuando
  // el dato simplemente no se había calculado todavía.
  if (!dist) return "sin-analizar";
  if (!dist.categorical) return "identificador";
  if (dist.distinct_count <= 1) return "categoria-unica";
  return null;
}

export function variableCandidata(stat: MonitoreoSourceVariableStat): VariableCandidata {
  const dist = stat.distribucion;
  const sugerida = stat.normalizacion_sugerida === "anio" ? "anio" : "ninguna";
  return {
    name: stat.name,
    label: stat.label || stat.name,
    cobertura: Math.max(0, Math.min(100, Number(stat.coverage_pct ?? 0) || 0)),
    categorias: dist?.distinct_count ?? 0,
    valores: dist?.categories ?? [],
    otrasCategorias: dist?.otras_categorias ?? 0,
    otrosCasos: dist?.otras_casos ?? 0,
    normalizacionSugerida: sugerida,
    motivoNoSegmenta: motivoDe(stat),
  };
}

/**
 * Ordena las columnas de una base para elegir entre ellas.
 *
 * Primero las que pueden segmentar, y dentro de cada bloque por cobertura
 * descendente. Con la misma cobertura gana la de menos categorías: entre dos
 * columnas al 100%, una de 4 categorías se lee y una de 40 no.
 */
export function variablesDeInteres(
  stats: readonly MonitoreoSourceVariableStat[] = [],
): VariableCandidata[] {
  return stats
    .map(variableCandidata)
    .sort((a, b) => {
      const rango = (motivo: MotivoNoSegmenta | null) => (
        motivo === null ? 0 : motivo === "sin-analizar" ? 1 : 2
      );
      const utilA = rango(a.motivoNoSegmenta);
      const utilB = rango(b.motivoNoSegmenta);
      if (utilA !== utilB) return utilA - utilB;
      if (a.cobertura !== b.cobertura) return b.cobertura - a.cobertura;
      if (a.categorias !== b.categorias) return a.categorias - b.categorias;
      return a.label.localeCompare(b.label, "es");
    });
}

/** Las que de verdad se pueden elegir. */
/**
 * Las que se pueden elegir.
 *
 * Incluye las que aún no se han analizado: no consta que no sirvan, y
 * bloquearlas dejaría al usuario sin nada que elegir hasta el próximo sync.
 */
export function variablesSegmentables(stats: readonly MonitoreoSourceVariableStat[] = []) {
  return variablesDeInteres(stats).filter(
    (item) => !item.motivoNoSegmenta || item.motivoNoSegmenta === "sin-analizar",
  );
}

/**
 * Aplica la normalización al reparto ya calculado.
 *
 * Agrupar aquí y no pedirle otro corte al motor mantiene la vista viva mientras
 * el usuario prueba «con año» y «sin año»: es la misma tabla contada de otra
 * forma, no otro dato.
 */
export function normalizarValores(
  valores: readonly { value: string; count: number }[],
  normalizacion: "ninguna" | "anio",
): { value: string; count: number }[] {
  if (normalizacion !== "anio") return [...valores];
  const porAnio = new Map<string, number>();
  valores.forEach((item) => {
    const anio = /^((?:19|20)\d{2})/.exec(item.value.trim())?.[1];
    // Sin año reconocible el valor se conserva: inventar un grupo sería peor
    // que dejar la categoría como está.
    const clave = anio ?? item.value;
    porAnio.set(clave, (porAnio.get(clave) ?? 0) + item.count);
  });
  return [...porAnio.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "es"));
}
