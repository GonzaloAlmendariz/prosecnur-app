import { create } from "zustand";
import type { MonitoreoAcreditacionReports, MonitoreoGoal, MonitoreoInternalQueryTotal } from "../../../../../api/client";
import { normalizeInternalQueries } from "../../../internalQueries";
import { normalizeSourceMatch } from "../formato";
import { advanceCardsFromRows, type AcreditacionAdvanceCard } from "../avance/tarjetasDeAvance";
import { casosDelCorte, type CasosDelCorte } from "../control/casos/tiposDeCaso";
import { conRespuestaPor, personasDe } from "../control/casos/personasModelo";

/**
 * Lo último que el corte dijo del avance y de los casos, para que la barra del
 * modo y Avance › Resumen lo muestren en cualquier sección.
 *
 * Cada sección pide su propio corte (`report_scope`): Avance trae los públicos
 * y Control trae los casos. Sin esta memoria, la insignia de Control
 * desaparecería al pasar a Avance y la de Avance al pasar a Insumos. No es
 * estado duro —se reconstruye del corte que llegue— y vive solo mientras la
 * página está montada (`olvidar` al desmontar o cambiar de proyecto).
 */

/** El barrido de un público, sumado de «Operación por responsable». */
export type BarridoDelPublico = { asignados: number; barridos: number; noBarridos: number; efectivasAlTelefono: number };

/** Barrido por público (clave normalizada) desde la hoja telefónica del corte, si viene. */
export function barridoDeReports(reports: MonitoreoAcreditacionReports | null | undefined): Map<string, BarridoDelPublico> | null {
  const hoja = (Array.isArray(reports?.sheets) ? reports.sheets : []).find((item) => item.id === "monitoreo_telefonico");
  const bloque = hoja?.blocks?.find((item) => String(item.id).toLowerCase() === "operacion_responsable");
  const filas = Array.isArray(bloque?.rows) ? bloque.rows as Array<Record<string, unknown>> : [];
  if (!filas.length) return null;
  const numero = (valor: unknown) => (Number.isFinite(Number(valor)) ? Number(valor) : 0);
  const porPublico = new Map<string, BarridoDelPublico>();
  for (const fila of filas) {
    const clave = normalizeSourceMatch(fila.Actor);
    if (!clave) continue;
    const previo = porPublico.get(clave) ?? { asignados: 0, barridos: 0, noBarridos: 0, efectivasAlTelefono: 0 };
    previo.asignados += numero(fila["Casos asignados"]);
    previo.barridos += numero(fila.Barridos);
    previo.noBarridos += numero(fila["No barridos"]);
    previo.efectivasAlTelefono += numero(fila["Efectivas telefónicas"]);
    porPublico.set(clave, previo);
  }
  return porPublico;
}

export type AvanceDelCorte = {
  tarjetas: AcreditacionAdvanceCard[];
  efectivas: number;
  meta: number;
};

type EstadoDelResumen = {
  avance: AvanceDelCorte | null;
  casos: CasosDelCorte | null;
  /** Issues tal como vinieron, para filtrar por público en el inspector. */
  issues: ReturnType<typeof normalizeInternalQueries>["issues"] | null;
  barrido: Map<string, BarridoDelPublico> | null;
  /** Efectivas por fuente y canal del reporte del cliente (`client_report.sources`). */
  fuentes: Array<Record<string, unknown>> | null;
  /** Respuestas y efectivas por recopilador (`internal_queries.totals.collector`), del corte de Control. */
  recopiladores: MonitoreoInternalQueryTotal[] | null;
  /** Cómo cruzó con el padrón quien respondió, por rótulo (`case_rollup`), del corte de Control. */
  cruces: Array<{ rotulo: string; casos: number }> | null;
  /** La lectura de casos falló: las vistas dejan de esperarla. */
  casosFallaron: boolean;
  marcarFalloDeCasos: () => void;
  observar: (reports: MonitoreoAcreditacionReports | null | undefined, goals: readonly MonitoreoGoal[]) => void;
  olvidar: () => void;
};

/** Las tarjetas del corte y su total: la misma cuenta que usan las vistas de Avance. */
export function avanceDeReports(
  reports: MonitoreoAcreditacionReports | null | undefined,
  goals: readonly MonitoreoGoal[],
): AvanceDelCorte | null {
  const crudos = reports?.client_report?.actors;
  const actores = Array.isArray(crudos) ? crudos : [];
  if (!actores.length) return null;
  const tarjetas = advanceCardsFromRows(actores as Array<Record<string, unknown>>, [...goals]);
  return {
    tarjetas,
    efectivas: tarjetas.reduce((suma, tarjeta) => suma + tarjeta.effective, 0),
    meta: tarjetas.reduce((suma, tarjeta) => suma + (tarjeta.meta ?? 0), 0),
  };
}

export const useResumenDelCorte = create<EstadoDelResumen>()((set) => ({
  avance: null,
  casos: null,
  issues: null,
  barrido: null,
  fuentes: null,
  recopiladores: null,
  cruces: null,
  casosFallaron: false,
  marcarFalloDeCasos: () => set({ casosFallaron: true }),
  observar: (reports, goals) => {
    if (!reports) return;
    const avance = avanceDeReports(reports, goals);
    const consultas = reports.report_scope === "queries_summary" || reports.report_scope === "full"
      || (Array.isArray(reports.internal_queries?.issues) && reports.internal_queries.issues.length > 0);
    const normalizadas = consultas ? normalizeInternalQueries(reports.internal_queries) : null;
    const issues = normalizadas ? normalizadas.issues : null;
    const recopiladores = normalizadas?.totals.collector.length ? normalizadas.totals.collector : null;
    const casosDelRollup = normalizadas ? (normalizadas.case_rollup?.length ? normalizadas.case_rollup : normalizadas.cases) : [];
    const cruces = casosDelRollup.length ? conRespuestaPor(personasDe(casosDelRollup), "comoCruzo") : null;
    const barrido = barridoDeReports(reports);
    const crudas = reports.client_report?.sources;
    const fuentes = Array.isArray(crudas) && crudas.length ? crudas as Array<Record<string, unknown>> : null;
    set((previo) => ({
      fuentes: fuentes ?? previo.fuentes,
      recopiladores: recopiladores ?? previo.recopiladores,
      cruces: cruces ?? previo.cruces,
      avance: avance ?? previo.avance,
      barrido: barrido ?? previo.barrido,
      casos: issues ? casosDelCorte(issues) : previo.casos,
      casosFallaron: issues ? false : previo.casosFallaron,
      issues: issues ?? previo.issues,
    }));
  },
  olvidar: () => set({ avance: null, casos: null, issues: null, barrido: null, fuentes: null, recopiladores: null, cruces: null, casosFallaron: false }),
}));

/** Para quien observa fuera de React (el prefetch de scopes). */
export function observarCorte(reports: MonitoreoAcreditacionReports | null | undefined, goals: readonly MonitoreoGoal[]) {
  useResumenDelCorte.getState().observar(reports, goals);
}
