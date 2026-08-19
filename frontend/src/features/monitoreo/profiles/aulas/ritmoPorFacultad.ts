import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * El ritmo diario de cada facultad, y hacia dónde va.
 *
 * `ritmo_diario` existe desde hace tiempo pero es del estudio ENTERO, y Gonzalo
 * dirige por facultad: «cuál es el ritmo por facultad, siempre todo es por
 * facultad». Un estudio que en agregado va bien puede tener tres facultades
 * paradas desde hace cuatro días y nadie lo ve.
 *
 * La forma no se inventa: la hoja «Tabla - Resumen» del libro real hace
 * exactamente esto —una columna por fecha con el conteo del día— y esta función
 * la reproduce por facultad.
 *
 * **No proyecta nada.** La tendencia que devuelve compara días YA OCURRIDOS; lo
 * que venga después es pronóstico y tiene su propio contrato.
 */

export type DiaDeFacultad = { fecha: string; efectivas: number };

export type RitmoDeFacultad = {
  facultad: string;
  dias: DiaDeFacultad[];
  efectivas: number;
  /** Días del rango en los que esa facultad recogió algo. */
  diasConCampo: number;
  /** Media por día CON CAMPO, no por día del calendario. */
  mediaDiaria: number;
  /**
   * Cuánto cambió el ritmo entre la primera y la segunda mitad de los días con
   * campo, en puntos porcentuales. `null` si no hay al menos dos días a cada
   * lado: con menos, la «tendencia» es ruido y decirlo sería inventar.
   */
  tendencia: number | null;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor).trim();
}

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/** «2026-08-11 10:00» → «2026-08-11». Devuelve "" si no hay fecha reconocible. */
export function fechaDeAplicacion(valor: unknown): string {
  const m = texto(valor).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : "";
}

/**
 * @param partes filas del parte YA unidas a su facultad (`parteDeCampo`).
 */
export function ritmoPorFacultad(partes: ReadonlyArray<MonitoreoRow>): {
  facultades: RitmoDeFacultad[];
  fechas: string[];
} {
  const porFacultad = new Map<string, Map<string, number>>();
  const fechas = new Set<string>();

  for (const fila of partes) {
    const fecha = fechaDeAplicacion(fila.applied_at ?? fila.applied_date);
    if (!fecha) continue;
    const efectivas = numero(fila.effective_surveys);
    const facultad = texto(fila.faculty) || "Sin facultad";
    fechas.add(fecha);
    let serie = porFacultad.get(facultad);
    if (!serie) { serie = new Map(); porFacultad.set(facultad, serie); }
    serie.set(fecha, (serie.get(fecha) ?? 0) + efectivas);
  }

  // El rango COMPLETO y compartido: un día sin recoger tiene que salir como cero
  // y no desaparecer, porque una facultad parada tres días es justo lo que hay
  // que ver. Y compartido entre facultades para que las series se puedan
  // comparar columna a columna.
  const orden = [...fechas].sort();

  const facultades = [...porFacultad.entries()].map(([facultad, serie]) => {
    const dias = orden.map((fecha) => ({ fecha, efectivas: serie.get(fecha) ?? 0 }));
    const conCampo = dias.filter((d) => d.efectivas > 0);
    const efectivas = dias.reduce((n, d) => n + d.efectivas, 0);
    // La media se calcula sobre los días CON CAMPO: dividir por los del
    // calendario mezcla el ritmo con cuántos días no se salió, que son dos
    // cosas distintas.
    const mediaDiaria = conCampo.length
      ? Math.round((10 * efectivas) / conCampo.length) / 10
      : 0;
    let tendencia: number | null = null;
    if (conCampo.length >= 4) {
      const mitad = Math.floor(conCampo.length / 2);
      const antes = conCampo.slice(0, mitad);
      const despues = conCampo.slice(conCampo.length - mitad);
      const mA = antes.reduce((n, d) => n + d.efectivas, 0) / antes.length;
      const mD = despues.reduce((n, d) => n + d.efectivas, 0) / despues.length;
      if (mA > 0) tendencia = Math.round((1000 * (mD - mA)) / mA) / 10;
    }
    return { facultad, dias, efectivas, diasConCampo: conCampo.length, mediaDiaria, tendencia };
  });

  // La que MÁS cae primero: es donde hay que intervenir. Las que no tienen
  // tendencia calculable van al final, no en medio, para no mezclarlas con las
  // estables.
  facultades.sort((x, y) => {
    if ((x.tendencia == null) !== (y.tendencia == null)) return x.tendencia == null ? 1 : -1;
    return (x.tendencia ?? 0) - (y.tendencia ?? 0) || y.efectivas - x.efectivas;
  });

  return { facultades, fechas: orden };
}
