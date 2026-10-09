import type {
  MonitoreoAulasEfectividadSeguimiento,
} from "../../../../api/monitoreo";

/**
 * Cómo le va a cada facultad, y **en qué sexo** le va mal.
 *
 * Gonzalo, 2026-09-10: «¿qué tan bajo en comparación con qué, cómo va la
 * facultad, le está yendo bien, le está yendo mal? ¿Cuáles son las facultades a
 * las que mejor les está yendo, a las que peor? […] ojo, no siempre es que le
 * esté yendo mal a nivel general, sino le puede estar yendo mal en un sexo en
 * particular».
 *
 * **Ese matiz es el que la cifra global esconde.** Ciencias Sociales va en cero
 * en hombres y debe siete mujeres: su «−7» no dice que toda la deuda esté de un
 * lado, y un relevo de mayoría masculina allí gasta una reserva sin mover nada.
 *
 * No se calcula nada nuevo: se cruzan dos bloques que el motor ya publica —la
 * efectividad por facultad y la misma partida por sexo— porque cada uno cuenta
 * la mitad de la respuesta.
 */

export type VeredictoDeFacultad =
  | "sin_campo" | "debe_en_los_dos" | "debe_mujeres" | "debe_hombres"
  | "en_lo_previsto" | "por_encima";

export type DeudaDeFacultad = {
  facultad: string;
  clave: string;
  aulas: number;
  /** Respuestas de más (+) o de menos (−) frente a lo que la tasa prevista pedía. */
  mujeres: number;
  hombres: number;
  /** La suma de las dos. Es lo que ordena la lista. */
  deuda: number;
  prevista: number | null;
  observada: number | null;
  veredicto: VeredictoDeFacultad;
  /** La lectura, ya redactada: es lo que se publica junto al nombre. */
  frase: string;
};

const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const PALABRA: Record<VeredictoDeFacultad, string> = {
  sin_campo: "Sin campo",
  debe_en_los_dos: "Debe en los dos",
  debe_mujeres: "Debe en mujeres",
  debe_hombres: "Debe en hombres",
  en_lo_previsto: "En lo previsto",
  por_encima: "Por encima",
};

export function palabraDelVeredicto(v: VeredictoDeFacultad): string { return PALABRA[v]; }

export function deudaPorFacultad(
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined,
  porSexo: ReadonlyArray<Record<string, unknown>> | null | undefined,
): DeudaDeFacultad[] {
  const filas = bloque?.facultades ?? [];
  if (!filas.length) return [];

  // Las celdas llegan como una lista de facultad × sexo; se indexan por la
  // clave del motor, que es con la que él mismo agregó.
  const celdas = new Map<string, { F: number; M: number }>();
  for (const c of porSexo ?? []) {
    const clave = String(c?.faculty_key ?? "").trim();
    const sexo = String(c?.sexo ?? "").trim().toUpperCase();
    if (!clave || (sexo !== "F" && sexo !== "M")) continue;
    const par = celdas.get(clave) ?? { F: 0, M: 0 };
    par[sexo as "F" | "M"] = Math.round(numero(c?.diferencia));
    celdas.set(clave, par);
  }

  const salida = filas.map((f) => {
    const par = celdas.get(String(f.faculty_key ?? "").trim()) ?? { F: 0, M: 0 };
    const mujeres = par.F;
    const hombres = par.M;
    const deuda = mujeres + hombres;
    const sinCampo = f.tau_observado == null || numero(f.aulas_aplicadas) === 0;

    // **El veredicto mira los dos sexos por separado, no su suma.** Una
    // facultad que sobra en uno y debe en el otro puede dar cero en total y
    // tener trabajo pendiente en la mitad de su cuota.
    const veredicto: VeredictoDeFacultad = sinCampo ? "sin_campo"
      : mujeres < 0 && hombres < 0 ? "debe_en_los_dos"
      : mujeres < 0 ? "debe_mujeres"
      : hombres < 0 ? "debe_hombres"
      : deuda === 0 ? "en_lo_previsto"
      : "por_encima";

    const frase = sinCampo
      ? "Todavía no tiene cursos-horario aplicados: de ésta no se sabe."
      : veredicto === "debe_en_los_dos"
        ? `Debe ${Math.abs(mujeres)} mujeres y ${Math.abs(hombres)} hombres.`
        : veredicto === "debe_mujeres"
          ? `Va en lo previsto en hombres y debe ${Math.abs(mujeres)} mujeres.`
          : veredicto === "debe_hombres"
            ? `Va en lo previsto en mujeres y debe ${Math.abs(hombres)} hombres.`
            : veredicto === "en_lo_previsto"
              ? "Justo en lo que su tasa prevista pedía."
              : `Por encima de lo previsto en los dos sexos: +${deuda}.`;

    return {
      facultad: String(f.facultad ?? ""),
      clave: String(f.faculty_key ?? ""),
      aulas: numero(f.aulas_aplicadas),
      mujeres, hombres, deuda,
      prevista: f.tau_previsto ?? null,
      observada: f.tau_observado ?? null,
      veredicto, frase,
    };
  });

  // Primero la que más debe: es la pregunta con la que se entra, y el orden es
  // la respuesta. Las que no tienen campo van al final, porque de ésas no se
  // sabe y mezclarlas con las que van bien diría que van bien.
  return salida.sort((a, b) => {
    const sinA = a.veredicto === "sin_campo" ? 1 : 0;
    const sinB = b.veredicto === "sin_campo" ? 1 : 0;
    return sinA - sinB || a.deuda - b.deuda || a.facultad.localeCompare(b.facultad, "es");
  });
}

/** El reparto del conjunto, para la lectura de arriba. */
export function repartoDeDeudas(filas: ReadonlyArray<DeudaDeFacultad>) {
  const cuenta = (v: VeredictoDeFacultad) => filas.filter((f) => f.veredicto === v).length;
  const deben = filas.filter((f) => f.veredicto !== "sin_campo" && f.deuda < 0);
  return {
    total: filas.length,
    conCampo: filas.filter((f) => f.veredicto !== "sin_campo").length,
    sinCampo: cuenta("sin_campo"),
    deben: deben.length,
    // Las que van mal en UN solo sexo: el caso que la cifra global esconde.
    deUnSoloSexo: cuenta("debe_mujeres") + cuenta("debe_hombres"),
    porEncima: cuenta("por_encima"),
    enLoPrevisto: cuenta("en_lo_previsto"),
  };
}
