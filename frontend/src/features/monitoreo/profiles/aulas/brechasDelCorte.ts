import { composicionDelAula } from "./composicionDelAula";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * Los cursos-horario con brecha, listos para decidir qué hacer con cada uno.
 *
 * Es el diagnóstico que separa el complemento (B) del refuerzo (C): «rindió
 * poco» no significa nada suelto —poco contra lo que su facultad preveía— y la
 * decisión cambia según si falta poco o no se aplicó nunca.
 *
 * **La severidad se mide contra la tasa prevista de SU facultad, no contra una
 * media del estudio.** Un 48 % es malo en Artes Escénicas, que preveía 74, y
 * bueno en una que preveía 40. Es la misma vara que usa la pestaña Efectividad,
 * y por eso viaja en la fila del plan (`tasa_facultad`).
 */

export type SeveridadDeBrecha =
  | "sin_aplicar" | "muy_por_debajo" | "por_debajo" | "cerca" | "cumplida"
  /** El parte la da por aplicada y nada lo respalda: se revisa, no se decide. */
  | "parte_en_conflicto";

export type BrechaDeCurso = {
  codigo: string;
  facultad: string;
  /** «LUN 08:00–11:00 · L104», tal como lo dice la agenda. */
  cuando: string;
  donde: string;
  /** Lo que rinde y lo que su facultad preveía, en tanto por uno. */
  observada: number | null;
  prevista: number | null;
  faltan: number;
  efectivas: number;
  esperadas: number;
  severidad: SeveridadDeBrecha;
  /** Qué toca hacer con este curso-horario, en el vocabulario del libro. */
  accion: "reemplazo" | "complemento" | "nada";
  /** Su composición por sexo: decide si un relevo suyo cerraría lo que falta. */
  mujeres: number;
  hombres: number;
  /**
   * **Cuánta gente había en el aula, según el parte.**
   *
   * Gonzalo, 2026-09-11, mirando CH 3 con «0.0 %»: «no entiendo, ¿la CH 3 no
   * hizo nada?». Sí hizo: se fue al aula y había 15 alumnos; lo que no salió
   * fue ni una encuesta válida. Un cero sin esa cifra se lee como que nadie
   * pisó el aula, y las dos cosas piden acciones muy distintas —volver a
   * aplicar donde hay gente, o agendar donde no se llegó—.
   *
   * `null` cuando el parte no lo anotó: ahí no se puede decir nada.
   */
  enElAula: number | null;
  /**
   * El parte la da por aplicada y nada lo respalda: ni fecha, ni contacto
   * cerrado, ni una encuesta. Hay que revisar el registro antes de decidir.
   */
  parteEnConflicto: boolean;
};

const texto = (v: unknown) => (v == null ? "" : String(v)).trim();
const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const opcional = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * El orden en que se atiende: **primero lo que se aplicó y rindió por debajo**.
 *
 * Gonzalo, 2026-09-10, con la tabla delante: «no entiendo por qué está mostrando
 * los sin campo cuando debería mostrar los aplicados que tienen bajo
 * rendimiento».
 *
 * Tenía razón, y el motivo es metodológico antes que visual. Un curso-horario al
 * que todavía no se ha ido **no tiene brecha medida**: le falta la meta entera
 * porque no le ha tocado, y esa cifra es el plan, no un resultado. Ponerlo
 * arriba —ordenado por `faltan`, donde siempre gana— enterraba justo lo que esta
 * tabla existe para encontrar: el aula que YA se visitó y se quedó corta, que es
 * la única que justifica meter otra aula detrás. El sin aplicar se atiende en
 * Agendación, con una llamada, no con una reserva.
 *
 * Por eso `sin_aplicar` pasa al final del peso, y además sale de las filas: se
 * cuenta en la lectura de arriba para que no desaparezca del mapa.
 */
const PESO: Record<SeveridadDeBrecha, number> = {
  // El conflicto va PRIMERO: no es un grado de rendimiento, es un registro que
  // hay que mirar antes de decidir nada sobre esa aula. Confirmado el
  // 2026-09-11 con Gonzalo — CH 3 era un duplicado del coordinador— así que va
  // a volver a pasar y tiene que saltar a la vista.
  parte_en_conflicto: -1,
  muy_por_debajo: 0, por_debajo: 1, cerca: 2, cumplida: 3, sin_aplicar: 4,
};

export function brechasDelCorte(
  filas: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined,
): BrechaDeCurso[] {
  const salida: BrechaDeCurso[] = [];
  for (const f of filas ?? []) {
    const faltan = Math.round(numero(f.brecha));
    const efectivas = Math.round(numero(f.respuestas_validas));
    const esperadas = Math.round(numero(f.expected_valid));
    if (faltan <= 0 && efectivas === 0 && esperadas === 0) continue;

    const elegibles = numero(f.eligible_n);
    const observada = elegibles > 0 ? efectivas / elegibles : null;
    const prevista = opcional((f as Record<string, unknown>).tasa_facultad)
      ?? opcional((f as Record<string, unknown>).efectividad_tau);

    // **Sin aplicar NO es rendir cero.** Un aula a la que todavía no se ha ido
    // no ha fallado: le falta todo porque no le ha tocado, y su salida es la
    // agenda, no un relevo. Se distingue por el parte, no por la cifra.
    /**
     * **Un «aplicada» que nada respalda es un dato en conflicto, no un hecho.**
     *
     * Gonzalo, 2026-09-11: «yo no veo que CH 3 se haya aplicado». Medido sobre
     * las 1 392 filas del plan, la contradicción existe y son DOS: CH 3 y
     * CH 143, las dos con «Número no existe» y el contacto sin cerrar.
     *
     * CH 143 se resuelve sola —trajo 23 encuestas, luego se aplicó y lo que no
     * se actualizó fue el estado de contacto—. CH 3 no: decía «aplicada» sin
     * fecha, sin contacto cerrado y sin una sola encuesta, y **resultó ser un
     * duplicado que el coordinador marcó por error**; él lo corrigió en el libro
     * al verlo. Esa es la razón de que esto exista: tratarla como aplicada la
     * mete entre las que rinden mal y le ofrece complemento; tratarla como
     * pendiente esconde que alguien marcó esa casilla. Ninguna de las dos deja
     * ver el error, así que se marca y se pide revisar.
     */
    const diceAplicada = texto(f.application_status).toLowerCase() === "aplicada";
    const sinFecha = !texto((f as Record<string, unknown>).scheduled_date);
    const contactoAbierto = ["en_contacto", "sin_contactar", ""]
      .includes(texto(f.sample_status).toLowerCase());
    const parteEnConflicto = diceAplicada && efectivas === 0 && sinFecha && contactoAbierto;

    const aplicada = !parteEnConflicto && (efectivas > 0
      || diceAplicada
      || numero((f as Record<string, unknown>).applied_surveys) > 0);

    // Lo que el parte anotó como observado. Se distingue el «no lo anotó» del
    // «había cero»: son cosas distintas y la fila sólo puede hablar del primero.
    const bruto = texto((f as Record<string, unknown>).observed_students);
    const enElAula = bruto === "" ? null : numero(bruto);

    let severidad: SeveridadDeBrecha;
    if (parteEnConflicto) severidad = "parte_en_conflicto";
    else if (!aplicada) severidad = "sin_aplicar";
    else if (faltan <= 0) severidad = "cumplida";
    else if (observada == null || prevista == null) severidad = "por_debajo";
    else {
      const cuanto = observada / prevista;
      severidad = cuanto < 0.5 ? "muy_por_debajo" : cuanto < 0.85 ? "por_debajo" : "cerca";
    }

    const { mujeres, hombres } = composicionDelAula(f);
    salida.push({
      codigo: texto(f.operational_code) || texto(f.classroom_id),
      facultad: texto(f.faculty),
      cuando: texto((f as Record<string, unknown>).sesiones_dia_hora) || texto(f.schedule),
      donde: texto(f.venue),
      observada, prevista, faltan, efectivas, esperadas, severidad,
      // Un aula sin aplicar se agenda; una aplicada que se quedó corta se
      // complementa. Nunca al revés: complementar la que no se visitó sería
      // gastar una reserva por un hueco que nadie ha intentado llenar.
      // Un parte en conflicto no ofrece acción: lo que toca es revisarlo, y
      // proponer complemento sobre un registro dudoso lo da por bueno.
      accion: severidad === "parte_en_conflicto" ? "nada"
        : severidad === "sin_aplicar" ? "reemplazo"
        : severidad === "cumplida" ? "nada" : "complemento",
      mujeres, hombres, enElAula, parteEnConflicto,
    });
  }
  return salida.sort((a, b) =>
    PESO[a.severidad] - PESO[b.severidad] || b.faltan - a.faltan || a.codigo.localeCompare(b.codigo));
}

/** Cuántos hay de cada severidad, para la lectura de arriba. */
export function repartoDeBrechas(brechas: ReadonlyArray<BrechaDeCurso>) {
  const cuenta = (s: SeveridadDeBrecha) => brechas.filter((b) => b.severidad === s).length;
  return {
    total: brechas.length,
    sinAplicar: cuenta("sin_aplicar"),
    muyPorDebajo: cuenta("muy_por_debajo"),
    porDebajo: cuenta("por_debajo"),
    cerca: cuenta("cerca"),
    faltanEnTotal: brechas.reduce((n, b) => n + Math.max(0, b.faltan), 0),
  };
}
