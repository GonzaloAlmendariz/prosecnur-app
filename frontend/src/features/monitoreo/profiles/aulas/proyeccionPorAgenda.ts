import type { MonitoreoRow } from "../../../../api/monitoreo";
import { serieDeRendimiento } from "./serieDeRendimiento";

/**
 * Si lo que ya está agendado alcanza la cuota de cada sexo, y cuándo.
 *
 * Gonzalo lo dijo así y es lo que ordena este módulo: «**la inferencia no es
 * inferencia a secas, es inferencia en base a lo que se agende**. Si yo sé que
 * al día siguiente o en los próximos tres días voy a ir a determinadas aulas, no
 * porque me las he inventado, sino porque están agendadas, yo puedo empezar a
 * inferir cuánta efectividad voy a tener»; y «cada facultad tiene una meta por
 * hombre y por mujer [...] tengo que ver si voy a llegar a la cuota, y si lo que
 * tengo agendado ya es suficiente para llegar a esa meta o no. ¿Y cuándo
 * llegaría?».
 *
 * La diferencia con proyectar «al ritmo observado» no es de precisión: es de
 * naturaleza. Un ritmo inventa días; la agenda son aulas con fecha, y
 * multiplicarlas por lo que rinde esa facultad es aritmética sobre un hecho.
 *
 * ## De dónde sale cada pieza
 *
 * - **Las aulas por venir**: filas del plan con fecha de aplicación posterior al
 *   último parte y sin parte propio. Ninguna se inventa.
 * - **Lo que rinde cada aula**: el esperado Gamma-Poisson de
 *   `serieDeRendimiento`, que ya encoge hacia la media del estudio cuando la
 *   facultad tiene pocas aulas.
 * - **El reparto por sexo**: la proporción YA OBSERVADA en esa facultad. Si
 *   todavía no respondió nadie, se usa la de la meta y **se declara**, porque son
 *   dos supuestos distintos y el segundo es más frágil.
 *
 * ## Lo que NO hace
 *
 * **No proyecta más allá de la agenda.** Si a una facultad le quedan tres aulas
 * agendadas y con ellas no llega, la respuesta es «no llega con lo agendado», no
 * una fecha inventada suponiendo que aparecerán más. Ese es justo el momento en
 * que hay que salir a agendar, y decirlo es el punto de todo esto.
 */

export type CuotaProyectada = {
  sexo: string;
  meta: number;
  observadas: number;
  faltan: number;
  /** Encuestas de ese sexo que aportan las aulas ya agendadas. */
  esperadasDeLaAgenda: number;
  alcanza: boolean;
  /** Primer día en que lo agendado cubriría la meta. `null` si no la cubre. */
  fechaDeCruce: string | null;
  /** Lo que seguiría faltando cuando se acabe la agenda. 0 si alcanza. */
  faltanAlCerrarAgenda: number;
};

export type ProyeccionDeFacultad = {
  facultad: string;
  /** Encuestas por aula que cabe esperar de esa facultad. */
  esperadoPorAula: number;
  /** Aulas del plan con fecha por delante y sin parte. */
  aulasAgendadas: number;
  /** Las fechas de esas aulas, en orden. */
  dias: Array<{ fecha: string; aulas: number; esperadas: number; acumuladas: number }>;
  cuotas: CuotaProyectada[];
  /** `observada` o `meta`, según de dónde salió el reparto por sexo. */
  reparto: "observada" | "meta" | "sin dato";
  /** Todas sus cuotas cubiertas con lo agendado. */
  alcanzaTodo: boolean;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor).trim();
}

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function soloFecha(valor: unknown): string {
  const m = texto(valor).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : "";
}

const redondea = (n: number) => Math.round(n * 10) / 10;

export function proyeccionPorAgenda(
  agenda: ReadonlyArray<MonitoreoRow>,
  partes: ReadonlyArray<MonitoreoRow>,
  cuotas: ReadonlyArray<MonitoreoRow>,
): ProyeccionDeFacultad[] {
  const serie = serieDeRendimiento(partes);
  const esperadoPorFacultad = new Map(serie.facultades.map((f) => [f.facultad, f.esperadoFinal]));
  const media = serie.mediaDelEstudio;
  // El corte es el último día con parte: lo agendado para ese día o antes ya
  // ocurrió —tenga parte o no— y proyectarlo sería contar dos veces.
  const ultimoConParte = serie.fechas[serie.fechas.length - 1] ?? "";

  const conParte = new Set(
    partes.map((p) => texto(p.operational_code)).filter(Boolean),
  );

  const porFacultad = new Map<string, Map<string, number>>();
  for (const fila of agenda) {
    const codigo = texto(fila.operational_code);
    if (codigo && conParte.has(codigo)) continue;
    const fecha = soloFecha(fila.scheduled_date);
    if (!fecha || (ultimoConParte && fecha <= ultimoConParte)) continue;
    const facultad = texto(fila.faculty) || "Sin facultad";
    if (!porFacultad.has(facultad)) porFacultad.set(facultad, new Map());
    const dias = porFacultad.get(facultad)!;
    dias.set(fecha, (dias.get(fecha) ?? 0) + 1);
  }

  // Las cuotas de cada facultad, tal como las publica el motor.
  const cuotasPorFacultad = new Map<string, MonitoreoRow[]>();
  for (const fila of cuotas) {
    const facultad = texto(fila.faculty) || "Sin facultad";
    if (!cuotasPorFacultad.has(facultad)) cuotasPorFacultad.set(facultad, []);
    cuotasPorFacultad.get(facultad)!.push(fila);
  }

  const facultades = new Set([...porFacultad.keys(), ...cuotasPorFacultad.keys()]);

  return [...facultades].map((facultad) => {
    const esperadoPorAula = esperadoPorFacultad.get(facultad) ?? media;
    const agendaDeLaFacultad = [...(porFacultad.get(facultad) ?? new Map())]
      .sort(([a], [b]) => a.localeCompare(b));
    let acumuladas = 0;
    const dias = agendaDeLaFacultad.map(([fecha, aulas]) => {
      const esperadas = aulas * esperadoPorAula;
      acumuladas += esperadas;
      return { fecha, aulas, esperadas: redondea(esperadas), acumuladas: redondea(acumuladas) };
    });
    const aulasAgendadas = agendaDeLaFacultad.reduce((n, [, aulas]) => n + aulas, 0);

    const filas = cuotasPorFacultad.get(facultad) ?? [];
    const observadasTotal = filas.reduce((n, f) => n + numero(f.observed), 0);
    const metaTotal = filas.reduce((n, f) => n + numero(f.target), 0);
    const reparto: ProyeccionDeFacultad["reparto"] = observadasTotal > 0
      ? "observada"
      : metaTotal > 0 ? "meta" : "sin dato";
    const base = reparto === "observada" ? observadasTotal : metaTotal;

    const cuotasProyectadas = filas.map((fila) => {
      const meta = numero(fila.target);
      const observadas = numero(fila.observed);
      const faltan = Math.max(0, meta - observadas);
      const peso = base > 0
        ? (reparto === "observada" ? observadas : meta) / base
        : 0;
      // El día en que lo acumulado de ESE sexo cubre lo que falta.
      let fechaDeCruce: string | null = null;
      for (const dia of dias) {
        if (dia.acumuladas * peso >= faltan) { fechaDeCruce = dia.fecha; break; }
      }
      const esperadasDeLaAgenda = redondea(acumuladas * peso);
      return {
        sexo: texto(fila.sex) || "Sin dato",
        meta,
        observadas,
        faltan,
        esperadasDeLaAgenda,
        alcanza: faltan === 0 || fechaDeCruce != null,
        fechaDeCruce: faltan === 0 ? null : fechaDeCruce,
        faltanAlCerrarAgenda: Math.max(0, Math.round(faltan - esperadasDeLaAgenda)),
      } satisfies CuotaProyectada;
    });

    return {
      facultad,
      esperadoPorAula: redondea(esperadoPorAula),
      aulasAgendadas,
      dias,
      cuotas: cuotasProyectadas,
      reparto,
      alcanzaTodo: cuotasProyectadas.length > 0 && cuotasProyectadas.every((c) => c.alcanza),
    } satisfies ProyeccionDeFacultad;
  }).sort((a, b) => Number(a.alcanzaTodo) - Number(b.alcanzaTodo)
    || a.facultad.localeCompare(b.facultad, "es"));
}
