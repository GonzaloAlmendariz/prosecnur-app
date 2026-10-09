import type { MonitoreoAulasProyeccionFila, MonitoreoRow } from "../../../../api/monitoreo";
import { cierrePorAgenda } from "./cierrePorAgenda";

/**
 * El seguimiento desgranado de UNA facultad, que es lo que Resumen no tenía.
 *
 * Gonzalo, 2026-09-10, y son siete preguntas seguidas:
 *
 * > «Si estamos viendo una facultad en particular en el resumen, sería
 * > interesante ver cuántas aulas tienen agendadas, cuántas faltan, cuándo se van
 * > a llenar todas las aulas que tenemos planificadas, si es que hay alguna aula
 * > adicional que estamos planteando o debería plantearse, si se están llegando
 * > las cuotas con las aulas agendadas hasta ahora, si se está llegando a la
 * > cuota de hombres, si se está llegando a la cuota de mujeres. Eso sería muy
 * > interesante tenerlo en resumen por facultad, y ya que tenemos el selector en
 * > el encabezado, sería interesante poder verlo de esa forma para poder tener el
 * > seguimiento desgranado de cada facultad y poder saber qué hacer en cada una.»
 *
 * **Casi todo esto ya existía, repartido entre tres pestañas.** Este módulo no
 * calcula casi nada: junta en una lectura lo que el motor ya publica —la
 * proyección de metas de «Metas», la agenda del pronóstico, la reserva de
 * «Efectividad»— y lo pone en la pregunta operativa, que las cruza: *¿me alcanzan
 * las aulas que tengo agendadas para llegar a la cuota de mujeres de esta
 * facultad?*
 *
 * **Y contesta de paso a qué mapea Resumen** —«¿por aulas, por cuotas, por
 * ambas?»—: por las dos, porque separadas no contestan nada.
 */

export type SeguimientoDeFacultad = {
  facultad: string;
  /** Cursos-horario con fecha y todavía sin aplicar. */
  agendados: number;
  aplicados: number;
  /** En juego, sin fecha: el plan de esta facultad no cierra sin ellos. */
  sinAgendar: number;
  /** Última fecha agendada, o «» si no queda nada por delante. */
  ultimaFecha: string;
  /** Reservas de cadena vivas y extras del banco que se podrían activar. */
  relevosVivos: number;
  extrasDisponibles: number;
  /** Las tres metas, con lo conseguido y lo que se espera de lo agendado. */
  cuotas: Array<{
    clave: "total" | "hombres" | "mujeres";
    etiqueta: string;
    meta: number;
    obtenidas: number;
    proyectadas: number | null;
    /** `obtenidas + proyectadas − meta`. Negativo = no llega. */
    brecha: number | null;
  }>;
  /** Si con lo agendado NO llega ninguna de las tres. */
  faltaAlguna: boolean;
};

const texto = (v: unknown) => (v == null ? "" : String(v)).trim();
const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const opcional = (v: unknown) => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const igual = (a: string, b: string) =>
  a.trim().toUpperCase() === b.trim().toUpperCase();

/**
 * @param proyeccion La fila de esa facultad en la combinación elegida de
 *   `proyeccion_metas`. Sin ella se devuelven las cuotas en cero y `faltaAlguna`
 *   en `false`: no se sabe si llega, que no es lo mismo que llegar.
 */
export function seguimientoDeFacultad(
  facultad: string,
  agenda: ReadonlyArray<MonitoreoRow> | null | undefined,
  proyeccion: MonitoreoAulasProyeccionFila | null | undefined,
  corte = "",
  relevos: Record<string, { disponibles: number }> | null | undefined = null,
  extras: ReadonlyArray<{ facultad?: string; disponibles?: number }> | null | undefined = null,
): SeguimientoDeFacultad | null {
  const nombre = texto(facultad);
  if (!nombre) return null;

  const suyas = (agenda ?? []).filter((f) => igual(texto(f.faculty), nombre));
  const cierre = cierrePorAgenda(suyas, corte);
  const agendados = cierre.dias.reduce((n, d) => n + d.cursos, 0);
  const aplicados = suyas.filter((f) =>
    texto(f.application_state) === "en_aplicacion" || texto(f.application_state) === "cerrando").length;

  // Los relevos vivos de esta facultad: reservas que el sorteo dejó y que
  // todavía se pueden activar. Es lo que contesta «¿hay alguna aula adicional
  // que estamos planteando?» sin salir a pedir aulas nuevas.
  const codigos = new Set(suyas.map((f) => texto(f.operational_code)).filter(Boolean));
  let relevosVivos = 0;
  for (const [codigo, dato] of Object.entries(relevos ?? {})) {
    if (codigos.has(codigo)) relevosVivos += numero(dato?.disponibles);
  }
  const extrasDisponibles = (extras ?? [])
    .filter((e) => igual(texto(e?.facultad), nombre))
    .reduce((n, e) => n + numero(e?.disponibles), 0);

  const cuota = (clave: "total" | "hombres" | "mujeres", etiqueta: string,
                 meta: number, obtenidas: number, proyectadas: number | null) => {
    const brecha = proyectadas == null ? null
      : Math.round((obtenidas + proyectadas - meta) * 10) / 10;
    return { clave, etiqueta, meta, obtenidas, proyectadas, brecha };
  };

  const cuotas = proyeccion ? [
    cuota("total", "En total", numero(proyeccion.meta), numero(proyeccion.obtenidas),
      opcional(proyeccion.proyectadas)),
    cuota("hombres", "Hombres", numero(proyeccion.meta_M), numero(proyeccion.obtenidas_M),
      opcional(proyeccion.proyectadas_M)),
    cuota("mujeres", "Mujeres", numero(proyeccion.meta_F), numero(proyeccion.obtenidas_F),
      opcional(proyeccion.proyectadas_F)),
  ] : [];

  return {
    facultad: nombre,
    agendados,
    aplicados,
    sinAgendar: cierre.sinAgendar,
    ultimaFecha: cierre.ultimaFecha,
    relevosVivos,
    extrasDisponibles,
    cuotas,
    // **Sólo cuenta como «no llega» lo que se SABE que no llega.** Una brecha
    // `null` es «no se puede proyectar», y tratarla como falta convertiría la
    // falta de dato en una alarma, que es el defecto que este perfil lleva media
    // sesión desmontando.
    faltaAlguna: cuotas.some((c) => c.brecha != null && c.brecha < 0),
  };
}
