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
 */

/** La fila ya saneada: cifras finitas o `null`, nunca un NaN que se cuele al formato. */
export type AulaMedida = {
  codigo: string;
  facultad: string;
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
      conformes: AulaMedida[];
      sinMedir: GrupoSinContrastar[];
      /**
       * Señales que esta pantalla no reconoce. Se enseñan con su nombre en vez
       * de caer a un grupo equivocado: una lista cerrada que se traga lo que no
       * reconoce es el defecto más caro del repo.
       */
      desconocidos: AulaMedida[];
      /** Todos los cursos-horario del bloque: nadie sale del conteo por su señal. */
      medidos: number;
    };

/**
 * Sólo un número finito pasa; lo demás es `null`. Cubre el NaN de un cálculo
 * roto y las formas raras que un serializador pueda colar en un campo ausente.
 */
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const texto = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

function sanear(a: MonitoreoAulasDosTasasAula): AulaMedida {
  return {
    codigo: texto(a.codigo) ?? "(sin código)",
    facultad: texto(a.facultad) ?? "",
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
 * Los motivos, uno por señal y dichos hacia quien mira la pantalla. El límite
 * de los 16 elegibles y el ±25 vienen del motor (`.madt_ELEGIBLES_MINIMOS`):
 * aquí sólo se traducen, no se deciden.
 */
const MOTIVOS: Record<GrupoSinContrastar["senal"], string> = {
  sin_banda:
    "con tan pocos elegibles el margen mediría más de ±25 puntos y cualquier cifra saldría conforme; la tasa se enseña sin juzgarla",
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

  const conocidas = new Set(["bajo", "sobre", "conforme", "sin_banda", "sin_previsto", "sin_datos"]);

  return {
    estado: "medido",
    senalados,
    conformes: de("conforme"),
    sinMedir,
    desconocidos: aulas.filter((a) => !conocidas.has(a.senal)),
    medidos: aulas.length,
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
