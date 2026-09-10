import { fmt } from "./kpisDeAulas";
import type {
  MonitoreoAulasDesenlace, MonitoreoAulasReemplazosPorTipo,
} from "../../../../api/monitoreo";

/**
 * Los tres desenlaces del libro, listos para leerse.
 *
 * Gonzalo, 2026-09-10: «quiero empezar a ver la parte de reemplazos para aulas
 * complementarias (B) o aulas de refuerzo (C)».
 *
 * **Las letras son suyas y las definiciones también** (viven en
 * `carga_aulas_libro_formato.R`):
 *
 * - **A · reemplazo** — el aula cayó y otra ocupa su lugar. El titular sale.
 * - **B · complemento** — el aula rindió poco y se le suma una reserva. El
 *   titular NO sale: los dos cuentan.
 * - **C · refuerzo** — no es del aula: faltaban alumnos o un sexo para la meta
 *   y se sale a una reserva por decisión operativa.
 *
 * **Y cada uno se cuenta por dos caminos.** El verbo del libro se teclea al
 * aplicar, así que un desenlace ocurre antes de que nadie lo escriba: el motor
 * separa `declarados` de `en_curso`, y la diferencia dice cuánto le falta al
 * registro para estar al día con el campo. Él lo vio en el primer reparto: «si
 * ya han habido tipo A, en Derecho por ejemplo».
 */

export type LecturaDeDesenlace = {
  letra: "A" | "B" | "C";
  nombre: string;
  /** Qué es, en una línea, para el cursor. */
  detalle: string;
  total: number;
  declarados: number;
  enCurso: number;
  /**
   * **En qué punto está el aula que resuelve cada caso.** Gonzalo, viendo el
   * primer reparto: «de los 4 reemplazos cuántos ya han sido aplicados, cuántos
   * agendados y cuántos sin agendar». Un reemplazo cuya reserva nadie ha
   * llamado todavía y otro ya aplicado son el mismo 1 en la cifra y dos
   * situaciones opuestas.
   */
  aplicados: number;
  agendados: number;
  sinAgendar: number;
  porFacultad: Array<{ facultad: string; aulas: number }>;
};

export type DesenlacesDelLibro = {
  tipos: LecturaDeDesenlace[];
  total: number;
  caidosSinRelevo: number;
  sinAulaUtilizada: number;
  /** La frase de arriba, ya redactada. */
  frase: string;
};

const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function unTipo(
  letra: "A" | "B" | "C", nombre: string, detalle: string,
  bloque: MonitoreoAulasDesenlace | undefined,
): LecturaDeDesenlace {
  return {
    letra, nombre, detalle,
    total: numero(bloque?.total),
    declarados: numero(bloque?.declarados),
    enCurso: numero(bloque?.en_curso),
    aplicados: numero(bloque?.aplicados),
    agendados: numero(bloque?.agendados),
    sinAgendar: numero(bloque?.sin_agendar),
    porFacultad: (bloque?.por_facultad ?? [])
      .map((f) => ({ facultad: String(f?.facultad ?? "").trim(), aulas: numero(f?.aulas) }))
      .filter((f) => f.facultad && f.aulas > 0),
  };
}

export function desenlacesDelLibro(
  bloque: MonitoreoAulasReemplazosPorTipo | null | undefined,
  facultad?: string,
): DesenlacesDelLibro | null {
  if (!bloque) return null;
  const clave = (v: string) =>
    v.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const buscada = facultad ? clave(facultad) : "";

  let tipos = [
    unTipo("A", "Reemplazos",
      "El curso-horario cayó y otro ocupa su lugar: el titular sale.",
      bloque.reemplazadas),
    unTipo("B", "Complementos",
      "El curso-horario rindió poco y se le sumó una reserva: el titular NO sale, los dos cuentan.",
      bloque.complementadas),
    unTipo("C", "Refuerzos",
      "No es del curso-horario: faltaban alumnos o un sexo para la meta y se salió a una reserva.",
      bloque.refuerzos),
  ];

  /**
   * **Con una facultad puesta, cada tipo cuenta los SUYOS.**
   *
   * El reparto por facultad lo trae el motor sobre el plan entero, así que
   * recortar aquí no inventa nada: se elige la fila de esa facultad. Lo que NO
   * se puede recortar son `declarados` y `en_curso`, que el motor sólo publica
   * en total; con foco se dejan en el total del tipo y la lectura no los
   * promete por facultad.
   */
  if (buscada) {
    tipos = tipos.map((t) => {
      const suya = t.porFacultad.find((f) => clave(f.facultad) === buscada);
      const n = suya?.aulas ?? 0;
      // El reparto por punto lo publica el motor en TOTAL, no por facultad: con
      // foco se apaga en vez de repartirlo a ojo, que sería inventarlo.
      return {
        ...t, total: n, declarados: 0, enCurso: n,
        aplicados: 0, agendados: 0, sinAgendar: 0,
        porFacultad: suya ? [suya] : [],
      };
    });
  }

  const total = tipos.reduce((n, t) => n + t.total, 0);
  const enCurso = tipos.reduce((n, t) => n + t.enCurso, 0);
  const declarados = tipos.reduce((n, t) => n + t.declarados, 0);

  const frase = total === 0
    ? "Ningún curso-horario ha necesitado reemplazo, complemento ni refuerzo todavía."
    : [
        `${fmt(total)} ${total === 1 ? "curso-horario ha necesitado" : "cursos-horario han necesitado"} relevo`,
        declarados && enCurso
          ? `${fmt(declarados)} ${declarados === 1 ? "declarado" : "declarados"} en el libro y ${fmt(enCurso)} que el campo ya vive y el libro todavía no dice.`
          : enCurso
            ? `${fmt(enCurso)} que el campo ya vive y el libro todavía no dice: el verbo se teclea al aplicar.`
            : "todos declarados en el libro.",
      ].join(": ");

  return {
    tipos,
    total,
    caidosSinRelevo: numero(bloque.caidos_sin_relevo),
    sinAulaUtilizada: numero(bloque.sin_aula_utilizada),
    frase,
  };
}
