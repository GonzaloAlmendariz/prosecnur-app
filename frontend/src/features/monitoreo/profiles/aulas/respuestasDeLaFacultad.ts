import type { MonitoreoAulasRespuestasCuenta } from "../../../../api/monitoreo";

export type DesgloseDeRespuestas = {
  total: MonitoreoAulasRespuestasCuenta & {
    sin_aula: number;
    /** La misma cuenta sobre las EFECTIVAS; ausente en payloads anteriores. */
    sin_aula_efectivas?: number;
  };
  facultades: Array<MonitoreoAulasRespuestasCuenta & { facultad: string }>;
};

/**
 * Qué cuenta enseñar: la del conjunto o la de la facultad en foco.
 *
 * **El foco es el que ya existe** (`foco=facultad:DERECHO`, el param canónico
 * del perfil), no un selector propio. El boceto dibujaba un ◀ Facultad ▶ suyo y
 * habría sido un segundo mando para lo mismo: dos sitios decidiendo qué
 * facultad se mira acaban discrepando, y encima el suyo no sería enlazable.
 *
 * Un foco que no es de facultad —`sexo:F`, `aula:CH 31`— no acota este bloque:
 * las respuestas se desglosan por facultad y nada más. Se devuelve el conjunto,
 * no un vacío: el bloque sigue contestando su pregunta mientras otro panel usa
 * el foco para lo suyo.
 *
 * Una facultad enfocada que no aparece en el desglose —porque no tiene ni una
 * respuesta— devuelve sus ceros CON su nombre, no el total: decir «944
 * efectivas» bajo el rótulo de una facultad sin respuestas sería mentir.
 */
export function respuestasDeLaFacultad(
  desglose: DesgloseDeRespuestas | null | undefined,
  facultadEnFoco: string | undefined,
): {
  cuenta: MonitoreoAulasRespuestasCuenta | null;
  /** Sólo tiene sentido en el conjunto: una facultad no tiene «sin aula». */
  sinAula: number;
  rotulo: string;
} | null {
  if (!desglose?.total) return null;
  const foco = (facultadEnFoco ?? "").trim();
  if (!foco) {
    // **La cuenta que hace cuadrar lo que el panel enseña.** La nota explica
    // por qué sumar las facultades no llega al total, y ese total son las
    // EFECTIVAS; `sin_aula` cuenta sobre las observadas. Coinciden mientras
    // nada se descarte, y dejan de coincidir en cuanto se declara un
    // `descartes` —los QR de capacitación y prueba—: entonces la nota decía
    // «19 … cuentan en el total» con 8 de ellas ya fuera de él.
    const t = desglose.total;
    return { cuenta: t, sinAula: t.sin_aula_efectivas ?? t.sin_aula ?? 0, rotulo: "" };
  }
  const suya = (desglose.facultades ?? []).find(
    (f) => f.facultad.trim().toUpperCase() === foco.toUpperCase(),
  );
  if (suya) return { cuenta: suya, sinAula: 0, rotulo: suya.facultad };
  return {
    cuenta: { observadas: 0, efectivas: 0, fuera_del_operativo: 0, no_pasan_criterio: 0 },
    sinAula: 0,
    rotulo: foco,
  };
}
