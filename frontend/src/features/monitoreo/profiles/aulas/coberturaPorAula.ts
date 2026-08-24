import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * La distribución de cobertura por curso-horario.
 *
 * Es el gráfico que sólo tiene sentido en aulas: aquí cada unidad tiene su
 * propia meta —el aforo elegible por su factor—, así que el promedio esconde la
 * forma. Sesenta aulas al 50 % y sesenta al 100 % dan el mismo avance global que
 * ciento veinte al 75 %, y piden decisiones opuestas: insistir donde ya hay
 * tracción, o abrir aulas que nadie ha tocado.
 *
 * En telefónico esta pregunta no existe porque la unidad es una llamada y no
 * lleva meta propia.
 */
export type TramoDeCobertura = {
  /** Clave del tramo; la misma que publica el motor R. */
  clave: string;
  /** Etiqueta del tramo, tal como se lee en el eje. */
  etiqueta: string;
  /** Cuántos cursos-horario caen en él. */
  aulas: number;
  /** Color del tramo; sale del vocabulario de resultado compartido. */
  tono: "pendiente" | "parcial" | "efectiva";
};

/**
 * Los seis tramos, de sin tocar a pleno.
 *
 * **Las claves son las del motor y el empalme va por clave, no por posición.**
 * Antes el gráfico pareaba `claves[i]` con `tramos[i]`: dos listas en dos
 * lenguajes que tenían que coincidir en orden sin que nada lo obligara, así que
 * recortar una banda movía los números de etiqueta sin romper ningún test.
 *
 * El corte anterior metía en una sola banda todo lo que estuviera entre el 51 %
 * y el 99 %. Medido sobre las 194 aulas aplicadas de 2025 son 82 aulas que van
 * de 8 a 270 encuestas faltantes: tapaba justo la diferencia entre «le faltó
 * una» y «no fue casi nadie».
 *
 * Cada etiqueta lleva su denominador: quien lee la barra no tiene que recordar
 * dónde cae el corte.
 */
const TRAMOS = [
  { clave: "nulo", etiqueta: "Sin respuestas", hasta: 0, tono: "pendiente" as const },
  { clave: "critico", etiqueta: "Crítico (≤50 %)", hasta: 0.5, tono: "parcial" as const },
  { clave: "insuficiente", etiqueta: "Insuficiente (50–75 %)", hasta: 0.75, tono: "parcial" as const },
  { clave: "parcial", etiqueta: "Parcial (75–90 %)", hasta: 0.9, tono: "parcial" as const },
  { clave: "satisfactorio", etiqueta: "Satisfactorio (90–100 %)", hasta: 0.9999, tono: "parcial" as const },
  { clave: "pleno", etiqueta: "Pleno (≥100 %)", hasta: Infinity, tono: "efectiva" as const },
];

/** Las claves del motor, en el orden del eje. Exportadas para que el gráfico
 *  empareje por clave y para que un test pueda comparar las dos definiciones. */
export const CLAVES_DE_COBERTURA = TRAMOS.map((t) => t.clave);

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Agrupa las filas de `course_status` en tramos de cobertura.
 *
 * Un aula **sin meta** (`expected_valid` en 0 o ausente) no se puede repartir en
 * una escala relativa: se cuenta aparte en `sinMeta` en vez de forzarla al 0 % o
 * al 100 %, que serían dos mentiras distintas.
 */
export function coberturaPorAula(filas: ReadonlyArray<MonitoreoAulasPlanRow>) {
  const tramos: TramoDeCobertura[] = TRAMOS.map((t) => ({
    clave: t.clave, etiqueta: t.etiqueta, aulas: 0, tono: t.tono,
  }));
  let sinMeta = 0;

  for (const fila of filas) {
    const meta = numero(fila.expected_valid);
    if (meta <= 0) { sinMeta += 1; continue; }
    const validas = numero(fila.respuestas_validas);
    const razon = validas / meta;
    // El 0 va SIEMPRE al primer tramo aunque la razón sea 0: «sin respuestas»
    // no es lo mismo que «poquísimas», y es la distinción operativa que decide
    // si el aula ni siquiera se abrió.
    const indice = validas <= 0
      ? 0
      : TRAMOS.findIndex((t, i) => i > 0 && razon <= t.hasta);
    tramos[indice < 0 ? TRAMOS.length - 1 : indice].aulas += 1;
  }

  return {
    tramos,
    sinMeta,
    total: filas.length,
    /**
     * Las que no han recibido NI UNA respuesta.
     *
     * Se publica para que nadie la vuelva a derivar por su cuenta: el pie del
     * gráfico de estados la sacaba sumando los dos primeros tramos DE OTRO eje
     * —el de agendamiento, y por posición— y decía 14 mientras este panel, un
     * dedo más abajo, decía 48. El eje del agendamiento no sabe de respuestas.
     */
    sinRespuestas: tramos[0].aulas,
  };
}
