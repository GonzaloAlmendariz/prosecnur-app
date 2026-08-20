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
  /**
   * Si ese cambio es más grande que el vaivén normal de esta facultad.
   *
   * **Medido, y es la razón de que exista este campo**: sobre el corte, la
   * producción diaria del ESTUDIO es plana —de 313 a 390 efectivas al día, entre
   * 14 y 17 aulas— y aun así siete facultades salían «a menos ritmo que al
   * empezar», con caídas de hasta el 47,9 %. Educación es el caso: 165 efectivas
   * en la primera mitad y 86 en la segunda… con **5 aulas contra 4** y **una
   * sola aula al día**, en un estudio donde un aula deja entre 13 y 74. Media
   * docena de observaciones de ese tamaño producen un −48 % sin que haya pasado
   * nada.
   *
   * Un panel que fabrica alarmas manda a alguien a investigar un problema que no
   * existe, y a la tercera vez deja de mirarse. Se compara la diferencia contra
   * **dos errores estándar de las dos medias**, calculados con la propia
   * variabilidad diaria de esa facultad. La cifra se sigue enseñando —el dato es
   * el dato— pero sólo se llama tendencia a lo que el ruido no explica.
   */
  distinguible: boolean;
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
    let distinguible = false;
    if (conCampo.length >= 4) {
      const mitad = Math.floor(conCampo.length / 2);
      const antes = conCampo.slice(0, mitad);
      const despues = conCampo.slice(conCampo.length - mitad);
      const mA = antes.reduce((n, d) => n + d.efectivas, 0) / antes.length;
      const mD = despues.reduce((n, d) => n + d.efectivas, 0) / despues.length;
      if (mA > 0) {
        tendencia = Math.round((1000 * (mD - mA)) / mA) / 10;
        // El vaivén normal de ESTA facultad, con sus propios días. Se usa la
        // desviación de la muestra (n−1): con cuatro días, dividir entre n la
        // subestima justo donde más falta hace no subestimarla.
        const valores = conCampo.map((d) => d.efectivas);
        const media = valores.reduce((n, v) => n + v, 0) / valores.length;
        const varianza = valores.length > 1
          ? valores.reduce((n, v) => n + (v - media) ** 2, 0) / (valores.length - 1)
          : 0;
        const errorDeLaDiferencia = Math.sqrt(varianza * (1 / antes.length + 1 / despues.length));
        distinguible = Math.abs(mD - mA) > 2 * errorDeLaDiferencia;
      }
    }
    return { facultad, dias, efectivas, diasConCampo: conCampo.length, mediaDiaria, tendencia, distinguible };
  });

  // La que MÁS cae primero, **entre las que caen de verdad**: es donde hay que
  // intervenir. Después las que se mueven dentro de su propio ruido, y al final
  // las que no tienen tendencia calculable. Ordenar por la cifra a secas ponía
  // arriba a la que más vaivén tiene, que no es lo mismo.
  facultades.sort((x, y) => {
    const rango = (f: RitmoDeFacultad) =>
      f.tendencia == null ? 2 : f.distinguible ? 0 : 1;
    return rango(x) - rango(y)
      || (x.tendencia ?? 0) - (y.tendencia ?? 0)
      || y.efectivas - x.efectivas;
  });

  return { facultades, fechas: orden };
}
