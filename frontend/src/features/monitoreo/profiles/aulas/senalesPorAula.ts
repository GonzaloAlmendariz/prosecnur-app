import type { MonitoreoAulasDosTasas, MonitoreoAulasDosTasasAula } from "../../../../api/monitoreo";
import { pctPerfil } from "./kpisDeAulas";

/**
 * La señal por curso-horario, ordenada para leerse: lo que pide una mirada
 * primero, lo conforme agregado, y lo que no se pudo contrastar con su motivo.
 *
 * Mandato de la unidad B3 (Gonzalo, 2026-08-31): «poder tener márgenes de los
 * esperados y no descartar algo o catalogarlo como algo simplemente porque la
 * tasa de efectividad no es la esperada». Este módulo por eso NO fabrica
 * veredictos: proyecta la señal que publica `monitoreo_aulas_dos_tasas()` y lo
 * único que decide es el ORDEN de lectura. Si recalculara tasas o bandas, dos
 * superficies del mismo número acabarían discrepando —así nacieron las tres
 * tasas homónimas que el ADR 0082 vino a separar—.
 *
 * Tras el rechazo metodológico (B1): el contraste es CONDICIONAL al estado
 * aplicado. `pendiente` (pre-aplicación) y `retirada` (su desenlace ya no es
 * aplicarse por esta vía) son grupos con motivo propio y JAMÁS se mezclan con
 * «bajo» —eso era catalogar por agenda—; `descuadre` (más efectivas que
 * elegibles) tiene nombre propio porque es una inconsistencia de números, no
 * un logro disfrazable de «sobre».
 */

/** La fila ya saneada: cifras finitas o `null`, nunca un NaN que se cuele al formato. */
export type AulaMedida = {
  /**
   * La clave de React: el código cuando existe y un sustituto estable por
   * posición cuando viene vacío (N5) — dos filas sin código no pueden
   * compartir clave. El rótulo VISIBLE es otra cosa: «(sin código)».
   */
  clave: string;
  codigo: string;
  facultad: string;
  /** El `operational_status` literal («agendada», «reemplazada»…), si viajó. */
  estadoOperativo: string | null;
  elegibles: number | null;
  efectivas: number | null;
  numerador: string | null;
  tasaPrevista: number | null;
  tasaFacultad: number | null;
  tasaObservada: number | null;
  banda: number | null;
  senal: string;
};

export type GrupoSinContrastar = {
  senal: "sin_banda" | "sin_previsto" | "sin_datos";
  /** Por qué no se contrasta: un vacío que diagnostica, no un hueco. */
  motivo: string;
  aulas: AulaMedida[];
};

export type SenalesPorAula =
  | { estado: "sin_bloque" }
  | { estado: "sin_cursos" }
  | {
      estado: "medido";
      /** Bajo primero (el más hundido delante), luego sobre (el más pasado delante). */
      senalados: AulaMedida[];
      /**
       * Más efectivas que elegibles: ALGÚN número está mal (atribución, aforo
       * o plataforma). Grupo propio y no «sobre»: disfrazado de logro, un
       * error de datos se leería como buena noticia. Tampoco suma al «se
       * salen» del encabezado: su tasa no es contrastable.
       */
      descuadres: AulaMedida[];
      conformes: AulaMedida[];
      sinMedir: GrupoSinContrastar[];
      /**
       * Aún sin aplicar (B1): la prevista del diseño es condicional a
       * aplicarse, así que todavía no hay rendimiento que juzgar. Se enseña lo
       * que se espera de cada uno, con su estado literal.
       */
      pendientes: AulaMedida[];
      /** Su desenlace ya no es aplicarse por esta vía; el estado literal dice cuál. */
      retiradas: AulaMedida[];
      /**
       * Señales que esta pantalla no reconoce. Se enseñan con su nombre en vez
       * de caer a un grupo equivocado: una lista cerrada que se traga lo que no
       * reconoce es el defecto más caro del repo.
       */
      desconocidos: AulaMedida[];
      /** Todos los cursos-horario del bloque: nadie sale del conteo por su señal. */
      medidos: number;
      /**
       * Los textos del motor, consumidos tal cual (M4): el umbral de la banda
       * y la clasificación por estado se dicen donde se calculan, no se
       * reescriben aquí — si cambia el mínimo de elegibles o la z, la UI no
       * puede quedarse mintiendo.
       */
      criterio: { banda: string | null; estados: string | null };
    };

/**
 * Sólo un número finito pasa; lo demás es `null`. Cubre el NaN de un cálculo
 * roto y las formas raras que un serializador pueda colar en un campo ausente.
 */
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const texto = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

function sanear(a: MonitoreoAulasDosTasasAula, i: number): AulaMedida {
  return {
    clave: texto(a.codigo) ?? `sin-codigo-${i + 1}`,
    codigo: texto(a.codigo) ?? "(sin código)",
    facultad: texto(a.facultad) ?? "",
    estadoOperativo: texto(a.estado_operativo),
    elegibles: num(a.elegibles),
    efectivas: num(a.efectivas),
    numerador: texto(a.numerador),
    tasaPrevista: num(a.tasa_prevista),
    tasaFacultad: num(a.tasa_facultad),
    tasaObservada: num(a.tasa_observada),
    banda: num(a.banda),
    senal: texto(a.senal) ?? "",
  };
}

/** Cuánto se aparta de SU prevista; el orden de lectura sale de aquí. */
const desvio = (a: AulaMedida): number =>
  a.tasaObservada != null && a.tasaPrevista != null ? a.tasaObservada - a.tasaPrevista : 0;

/**
 * Los motivos, uno por señal y dichos hacia quien mira la pantalla. Aquí no va
 * NINGUNA cifra del motor (M4): ni el mínimo de elegibles ni el ancho que
 * tendría la banda —esas viven en `criterio.banda` del payload y la vista las
 * enseña tal cual—. El «±25 puntos» que estuvo tecleado aquí habría mentido en
 * cuanto el motor cambiara su `ELEGIBLES_MINIMOS` o su z.
 */
const MOTIVOS: Record<GrupoSinContrastar["senal"], string> = {
  sin_banda:
    "con tan pocos elegibles el margen sería tan ancho que cualquier cifra saldría conforme; la tasa se enseña sin juzgarla",
  sin_previsto:
    "el diseño no publicó una tasa prevista para estos, así que no hay margen que trazar",
  sin_datos:
    "sin efectiva de plataforma ni parte de campo todavía no hay qué contrastar",
};

export function senalesPorAula(
  bloque: MonitoreoAulasDosTasas | null | undefined,
): SenalesPorAula {
  if (!bloque || !Array.isArray(bloque.aulas)) return { estado: "sin_bloque" };
  if (bloque.aulas.length === 0) return { estado: "sin_cursos" };

  const aulas = bloque.aulas.map(sanear);
  const de = (senal: string) => aulas.filter((a) => a.senal === senal);

  // Bajo primero y dentro de cada dirección el desvío mayor delante: es la fila
  // que hay que mirar antes. `sort` muta, así que se ordena una copia.
  const senalados = [
    ...de("bajo").slice().sort((a, b) => desvio(a) - desvio(b)),
    ...de("sobre").slice().sort((a, b) => desvio(b) - desvio(a)),
  ];

  const sinMedir: GrupoSinContrastar[] = (["sin_banda", "sin_previsto", "sin_datos"] as const)
    .map((senal) => ({ senal, motivo: MOTIVOS[senal], aulas: de(senal) }))
    .filter((g) => g.aulas.length > 0);

  const conocidas = new Set([
    "bajo", "sobre", "conforme", "descuadre",
    "sin_banda", "sin_previsto", "sin_datos",
    "pendiente", "retirada",
  ]);

  return {
    estado: "medido",
    senalados,
    descuadres: de("descuadre"),
    conformes: de("conforme"),
    sinMedir,
    // En orden de plan, tal como viajan: el estado literal de cada fila es lo
    // que distingue una «agendada» de una «en_campo» o una «reemplazada» de
    // una «sin_acceso».
    pendientes: de("pendiente"),
    retiradas: de("retirada"),
    desconocidos: aulas.filter((a) => !conocidas.has(a.senal)),
    medidos: aulas.length,
    // `criterio.estados` es opcional: el bloque existió antes de la regla B1 y
    // un backend anterior no lo emite; la vista degrada callando esa línea.
    criterio: {
      banda: texto(bloque.criterio?.banda),
      estados: texto(bloque.criterio?.estados),
    },
  };
}

/**
 * La banda en puntos porcentuales enteros, la misma regla que `margenError` del
 * panel de facultad de al lado: dos superficies vecinas que hablan del mismo
 * margen tienen que decirlo igual. Una banda que redondea a cero se calla:
 * «± 0 pts» afirmaría una precisión que no existe.
 */
export function ptsDeBanda(banda: number | null | undefined): string | null {
  if (banda == null || !Number.isFinite(banda)) return null;
  const pts = Math.round(banda * 100);
  return pts > 0 ? `± ${pts} pts` : null;
}

/**
 * Una tasa como porcentaje legible; la ausente es una raya, nunca un cero. El
 * formato es el del perfil (`pctPerfil`): un decimal y espacio antes del «%».
 */
export function tasaEnPct(tasa: number | null | undefined): string {
  if (tasa == null || !Number.isFinite(tasa)) return "—";
  return pctPerfil(tasa * 100);
}
