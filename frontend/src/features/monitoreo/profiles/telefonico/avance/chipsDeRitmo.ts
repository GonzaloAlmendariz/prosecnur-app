import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { metaDelProyecto } from "./metaDelProyecto";
import { efectivasPorDia, fechaCorta, resumenDeRitmo } from "./ritmoModel";

/**
 * «Pico de 133 el 03/07» y «Meta de 400 cruzada el 04/07», para la cabecera de
 * Avance › Ritmo. Lee la misma serie que la pestaña (`efectivasPorDia`).
 */
export function chipsDeRitmo(reports: MonitoreoAcreditacionReports | null, state?: MonitoreoState | null): string[] {
  const dias = efectivasPorDia(reports);
  if (!dias.length) return [];
  const porFecha = Object.fromEntries(dias.map((dia) => [dia.fecha, dia.casos]));
  const meta = metaDelProyecto(state);
  const resumen = resumenDeRitmo({ fechas: dias.map((dia) => dia.fecha), porFecha, total: dias.reduce((suma, dia) => suma + dia.casos, 0) }, meta);
  const fmt = (n: number) => n.toLocaleString("es-PE");
  return [
    ...(resumen.pico ? [`Pico de ${fmt(resumen.pico.casos)} el ${fechaCorta(resumen.pico.fecha)}`] : []),
    ...(meta ? [resumen.metaCruzada ? `Meta de ${fmt(meta)} cruzada el ${fechaCorta(resumen.metaCruzada)}` : `Meta de ${fmt(meta)} sin cruzar`] : []),
  ];
}
