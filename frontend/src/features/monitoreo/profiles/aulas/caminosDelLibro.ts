import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { aulasQueSeMetieron, type AulaQueSeMetio } from "./aporteDelAbc";

/**
 * **Los tres caminos del libro, cada uno con su naturaleza.**
 *
 * Gonzalo, 2026-09-10: «ni siquiera estamos diferenciando bien esto de qué nos
 * dieron y las que se metieron, de quizás diferenciando se fue una situación A,
 * se fue una situación B, se fue una situación C, porque son las naturalezas
 * distintas y con lógicas distintas».
 *
 * Es la primera sección del ensayo —«Qué pasó, y por dónde se sale»— y lo que
 * la sostiene: los tres se escriben en la MISMA columna del libro (`STATUS DE
 * APLICACIÓN`) y lo que los separa no es el trámite, es **qué le pasó al
 * titular**.
 *
 * - **A · Reemplazo.** El docente rechazó o el aula no se pudo aplicar. El
 *   titular sale del operativo y entra su reserva. Se resuelve en el Sheets.
 * - **B · Complemento.** El aula se aplicó y rindió poco. El titular no sale:
 *   se le suma una reserva y los dos cuentan. Se decide en la app.
 * - **C · Refuerzo.** No es de un aula: a la FACULTAD le falta un sexo para su
 *   cuota y se sale a una reserva por decisión operativa. Se decide en la app.
 *
 * Y de ahí la consecuencia que ordena toda la pestaña: **sólo A sale del
 * titular**. B y C entran por otra puerta —uno por el rendimiento del aula, el
 * otro por la cuota de la facultad—, y por eso no pueden compartir superficie.
 */

export type LetraDelCamino = "A" | "B" | "C";

export type CaminoDelLibro = {
  letra: LetraDelCamino;
  nombre: string;
  /** Qué le pasó al titular. Es lo que separa los tres, no el trámite. */
  circunstancia: string;
  /** Dónde se toma la decisión: el Sheets de agendación o esta app. */
  donde: "sheets" | "app";
  /** Cuántos hay, contando el HECHO y no sólo el verbo tecleado. */
  enCurso: number;
  /** De ésos, cuántos lo llevan escrito en el libro. */
  declarados: number;
  /** Los que ya rindieron por este camino. */
  aplicados: AulaQueSeMetio[];
  /**
   * Lo que aportaron. En A es REPOSICIÓN —el plan ya contaba con esas
   * respuestas, sólo que de otra aula—; en B y C es ganancia entera, porque no
   * estaban previstas.
   */
  respuestas: number;
  /** `null` si alguna de las que aportan no publica su reparto por sexo. */
  porSexo: { mujeres: number; hombres: number } | null;
};

const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Un bloque de `reemplazos_por_tipo`, tal como lo publica el motor. */
type BloqueDelMotor = { total?: unknown; declarados?: unknown; en_curso?: unknown };

export function caminosDelLibro(
  filas: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined,
  porTipo: Record<string, unknown> | null | undefined,
): CaminoDelLibro[] {
  const bloque = (clave: string): BloqueDelMotor =>
    ((porTipo ?? {})[clave] ?? {}) as BloqueDelMotor;

  const metidas = aulasQueSeMetieron(filas);
  // A repone y B/C suman: el papel lo decide si el titular salió, no el verbo.
  const reponen = metidas.filter((a) => a.papel === "repone");
  const netas = metidas.filter((a) => a.papel === "neta");
  // Dentro de lo neto, C es lo que viene de la reserva adicional —nunca tuvo
  // titular— y B lo que acompaña a un titular que sí salió.
  const deRefuerzo = netas.filter((a) => a.deLaReserva || !a.titular);
  const deComplemento = netas.filter((a) => !a.deLaReserva && a.titular);

  const conteo = (bl: BloqueDelMotor, aplicados: AulaQueSeMetio[]) => {
    const declarados = Math.round(numero(bl.declarados));
    const enCurso = Math.max(
      Math.round(numero(bl.total)) || Math.round(numero(bl.en_curso)) + declarados,
      aplicados.length,
    );
    return { declarados, enCurso };
  };

  /**
   * El reparto por sexo de UN camino, sea el que sea.
   *
   * `repartoDelAporte` separa por su cuenta lo neto de lo que repone y sólo
   * publica el sexo de lo primero, así que la tarjeta de A —que repone— se
   * quedaba sin su reparto aunque el dato estuviera: «10 respuestas repuestas»
   * a secas, con las 1.392 filas del plan trayendo ya `validas_mujeres`.
   * Y el sexo de lo repuesto importa igual: repone una celda, y con qué la
   * repone decide si la cuota de la facultad se mueve o no.
   *
   * **Sólo se publica si TODAS lo traen.** Con la mitad sin sexo, «trajo 40
   * mujeres» sería una cifra sobre parte de los cursos-horario presentada como
   * si fuera sobre todos.
   */
  const cifras = (aplicados: AulaQueSeMetio[]) => {
    const conSexo = aplicados.filter((a) => a.porSexo);
    const completo = aplicados.length > 0 && conSexo.length === aplicados.length;
    return {
      respuestas: aplicados.reduce((n, a) => n + a.efectivas, 0),
      porSexo: completo
        ? {
          mujeres: conSexo.reduce((n, a) => n + a.porSexo!.mujeres, 0),
          hombres: conSexo.reduce((n, a) => n + a.porSexo!.hombres, 0),
        }
        : aplicados.length ? null : { mujeres: 0, hombres: 0 },
    };
  };

  return [
    {
      letra: "A",
      nombre: "Reemplazo",
      circunstancia:
        "El docente rechazó o el curso-horario no se pudo aplicar. El titular sale del operativo y entra su reserva.",
      donde: "sheets",
      ...conteo(bloque("reemplazadas"), reponen),
      aplicados: reponen,
      ...cifras(reponen),
    },
    {
      letra: "B",
      nombre: "Complemento",
      circunstancia:
        "El curso-horario se aplicó y rindió poco. El titular no sale: se le suma una reserva y los dos cuentan.",
      donde: "app",
      ...conteo(bloque("complementadas"), deComplemento),
      aplicados: deComplemento,
      ...cifras(deComplemento),
    },
    {
      letra: "C",
      nombre: "Refuerzo",
      circunstancia:
        "No sale de un curso-horario: a la facultad le falta un sexo para su cuota y se sale a una reserva por decisión operativa.",
      donde: "app",
      ...conteo(bloque("refuerzos"), deRefuerzo),
      aplicados: deRefuerzo,
      ...cifras(deRefuerzo),
    },
  ];
}
