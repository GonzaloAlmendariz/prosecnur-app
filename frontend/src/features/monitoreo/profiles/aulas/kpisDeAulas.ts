import type { MonitoreoAulasDashboard, MonitoreoRow } from "../../../../api/monitoreo";
import { pct } from "../../core/formatoComun";
import { cuotasResumen } from "./cuotasResumen";

/**
 * La banda de KPIs del perfil de cursos-horario.
 *
 * Vive fuera de la página por una razón concreta: **el KPI de cuota y el panel
 * de Avance decían cosas distintas del mismo hecho**. Arriba, «2/12 celdas»;
 * dos dedos más abajo, «701 personas por recoger». Las dos cifras eran ciertas
 * y juntas se leían como una contradicción. Ahora las dos salen de
 * `cuotasResumen()`, así que no pueden discrepar, y el cálculo se puede probar
 * sin montar la página entera.
 */

export type AulasKpi = {
  label: string;
  value: string;
  tone?: "neutral" | "warn";
  /** Lectura larga del mismo dato; va al `title`, así que no ocupa alto (C2). */
  detalle?: string;
};

export function fmt(value: unknown, fallback = "0") {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (Number.isFinite(n)) return new Intl.NumberFormat("es-PE").format(n);
  return String(value);
}

/**
 * Banda canónica: unifica los KPIs que antes estaban repartidos entre la
 * cabecera (3) y la fila de stats de avance (5). El color semántico (`warn`) se
 * reserva para brechas y cuotas con déficit real; el resto queda neutral para no
 * meter ruido verde en conteos que aún están en 0.
 */
export function aulasKpis(dashboard: MonitoreoAulasDashboard | null): AulasKpi[] {
  const kpis = dashboard?.kpis;
  const brechas = Number(kpis?.brechas ?? 0);
  // `quotas_sex_faculty` viaja en TODOS los scopes —comprobado pidiendo
  // `report_scope=source`, que devuelve las 12 celdas—, así que el KPI no se
  // vacía en Fuentes ni en Agenda, que piden ese scope.
  const cuota = cuotasResumen((dashboard?.quotas_sex_faculty ?? []) as MonitoreoRow[]).general;
  return [
    { label: "Cursos-horario", value: fmt(kpis?.total_aulas) },
    { label: "Aplicadas", value: fmt(kpis?.aulas_aplicadas) },
    { label: "Válidas", value: fmt(kpis?.respuestas_validas) },
    { label: "Representatividad", value: pct(kpis?.representativity_effective_score) },
    {
      // En personas, que es la unidad del operativo: doce celdas pueden estar a
      // una respuesta o a doscientas y el contador de celdas se ve igual.
      label: "Cuota por recoger",
      value: cuota.celdas ? fmt(cuota.faltan) : "S/D",
      tone: cuota.faltan ? "warn" : "neutral",
      // La última frase contesta la resta que no cuadra: 4 376 − 3 700 son 676
      // y el KPI dice 701. No es un error —lo que falta se suma celda a celda,
      // porque pasarse en una facultad no cubre lo que falta en otra— pero sin
      // decirlo el lector encuentra la diferencia y desconfía de las dos cifras.
      detalle: cuota.celdas
        ? `${fmt(cuota.logrado)} de ${fmt(cuota.meta)} personas · ${fmt(cuota.celdasCumplidas)} de ${fmt(cuota.celdas)} celdas cumplidas · lo que falta se suma celda a celda`
        : "el plan no declara cuotas de sexo por facultad",
    },
    { label: "Brechas", value: fmt(kpis?.brechas), tone: brechas ? "warn" : "neutral" },
  ];
}
