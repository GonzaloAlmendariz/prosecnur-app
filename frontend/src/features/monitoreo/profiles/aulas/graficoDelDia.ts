import type { MonitoreoAulasAvanceTabla } from "../../../../api/monitoreo";

/**
 * El día como unidad: cuántas efectivas se hicieron y cuántas se esperaban.
 *
 * Gonzalo, 2026-09-08, sobre el gráfico que medía encuestas por curso-horario:
 * «estas dimensiones por curso-horario, a mí no me importa eso; me importa
 * cuántas efectivas se hicieron en el día y cuántas se tenían mapeadas en base a
 * las aplicaciones y las esperadas por aulas en base a la tasa de rendimiento
 * del aula».
 *
 * Son dos preguntas distintas y el gráfico viejo contestaba la otra. Medir por
 * curso-horario responde «¿cuánto rinde un aula?», que es una pregunta de
 * diseño; medir el día responde «¿cómo fue la jornada?», que es la que se hace
 * quien mira el campo por la tarde.
 *
 * **No se recalcula nada.** Las cifras salen de la tabla «Avance diario» que
 * publica el motor, la misma que alimenta el libro y el Sheets, así que el
 * gráfico y la tabla no pueden discrepar. Y las esperadas son las de los
 * cursos-horario YA APLICADOS ese día, no las de todos los agendados: Gonzalo lo
 * corrigió expresamente, «lo segundo no sería justo», porque castiga a la
 * facultad por las aulas a las que todavía no ha ido y, en una jornada a
 * medias, por las horas que faltan.
 */

export type DiaDeCampo = {
  /** ISO, para ordenar y para la clave. */
  fecha: string;
  /** «lunes», «martes»…, tal como lo escribe el motor. */
  diaSemana: string;
  conseguidas: number;
  esperadas: number;
  /** Conseguidas menos esperadas. Positivo es mejor de lo previsto. */
  diferencia: number;
  /** Qué facultades aportaron ese día, de más a menos conseguidas. */
  porFacultad: Array<{ facultad: string; conseguidas: number; esperadas: number; diferencia: number }>;
};

const COL = {
  facultad: "Facultad",
  dia: "Día",
  diaSemana: "Día de la semana",
  conseguidas: "Efectivas del día",
  esperadas: "Efectivas esperadas",
  diferencia: "Diferencia de efectivas",
} as const;

function num(v: unknown): number {
  if (v === null || v === undefined || typeof v === "object") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function texto(v: unknown): string {
  if (v === null || v === undefined || typeof v === "object") return "";
  return String(v);
}

/**
 * Agrega la tabla diaria por día.
 *
 * @param tabla la tabla `diario` del endpoint, o `undefined`.
 * @param facultadEnFoco cuando hay foco, sólo esa facultad.
 * @returns un día por fecha, en orden cronológico.
 */
export function graficoDelDia(
  tabla: MonitoreoAulasAvanceTabla | undefined,
  facultadEnFoco?: string,
): DiaDeCampo[] {
  if (!tabla?.filas?.length) return [];
  // Las columnas se buscan POR NOMBRE en la cabecera que publica el motor, no
  // por índice: el orden de esa tabla ya cambió dos veces en un día y un índice
  // fijo es una dependencia invisible con el orden.
  const donde = (nombre: string) => tabla.cabecera.indexOf(nombre);
  const iFac = donde(COL.facultad);
  const iDia = donde(COL.dia);
  const iSem = donde(COL.diaSemana);
  const iCon = donde(COL.conseguidas);
  const iEsp = donde(COL.esperadas);
  const iDif = donde(COL.diferencia);
  // Sin las tres columnas que dan sentido al gráfico no se dibuja nada: mejor
  // un vacío declarado que un gráfico de ceros que parece una jornada mala.
  if (iDia < 0 || iCon < 0 || iEsp < 0) return [];

  const porFecha = new Map<string, DiaDeCampo>();
  for (const fila of tabla.filas) {
    const facultad = iFac >= 0 ? texto(fila[iFac]) : "";
    if (facultadEnFoco && facultad !== facultadEnFoco) continue;
    const fecha = texto(fila[iDia]);
    if (!fecha) continue;
    const conseguidas = num(fila[iCon]);
    const esperadas = num(fila[iEsp]);
    // La diferencia se lee de su columna cuando viene; si no, se deriva. El
    // motor es quien decide qué es una diferencia, y aquí sólo se completa el
    // caso en que esa columna no viaje.
    const diferencia = iDif >= 0 ? num(fila[iDif]) : conseguidas - esperadas;
    const dia = porFecha.get(fecha) ?? {
      fecha,
      diaSemana: iSem >= 0 ? texto(fila[iSem]) : "",
      conseguidas: 0,
      esperadas: 0,
      diferencia: 0,
      porFacultad: [],
    };
    dia.conseguidas += conseguidas;
    dia.esperadas += esperadas;
    dia.diferencia += diferencia;
    if (facultad) dia.porFacultad.push({ facultad, conseguidas, esperadas, diferencia });
    porFecha.set(fecha, dia);
  }

  const dias = [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const d of dias) {
    d.porFacultad.sort((a, b) => b.conseguidas - a.conseguidas || a.facultad.localeCompare(b.facultad));
  }
  return dias;
}
