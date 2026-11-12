// Propuestas de muestra de un barrido (PPT y Excel desde Cálculo de muestra): qué actores entran, la meta de cada
// uno en cada propuesta y la lectura que justifica cada meta (margen de referencia y respuesta que exige frente a la
// esperada). Puro: se prueba sin React ni red. Las propuestas viven en `workspace.propuesta` del estudio.
import type {
  CalcMuestraComponente,
  CalcMuestraPropuestaPayload,
  CalcMuestraWorkspacePropuesta,
} from "../../../api/calcMuestra";
import { metaCuotaFijada, sugerenciaCuota } from "../criterioSalida";
import { safeNumber } from "../sharedCore";

const CUANTITATIVOS = new Set(["estudiantes", "docentes", "administrativos", "egresados"]);

export const MAX_PROPUESTAS = 4;
const LETRAS = ["A", "B", "C", "D"] as const;
/** Fracción de la meta del actor con que parte cada propuesta: la A es la meta, la B dos tercios, la C la mitad. */
const FRACCIONES = [1, 2 / 3, 1 / 2] as const;

export type FilaPropuesta = {
  id: string;
  actor: string;
  poblacion: number;
  /** Respuesta esperada del actor (0 a 1), la que se declara en Actores; `null` si no hay. */
  respuestaEsperada: number | null;
};

export type EscenarioPropuesta = { nombre: string; metas: Record<string, number> };
export type EstadoPropuesta = CalcMuestraWorkspacePropuesta;

/** Actores que entran en la propuesta: los cuantitativos con N declarado, en el orden del estudio. */
export function actoresDePropuesta(componentes: readonly CalcMuestraComponente[]): FilaPropuesta[] {
  return componentes
    .filter((c) => safeNumber(c.marco?.marco_validado, 0) > 0 && CUANTITATIVOS.has(c.actor_categoria))
    .map((c) => {
      const tasa = safeNumber(c.parametros?.tasa_respuesta, 0);
      return {
        id: c.id,
        actor: c.actor?.trim() || c.actor_id || c.id,
        poblacion: safeNumber(c.marco?.marco_validado, 0),
        respuestaEsperada: tasa > 0 && tasa <= 1 ? tasa : null,
      };
    });
}

export function nombrePropuesta(indice: number): string {
  return `Propuesta ${LETRAS[indice] ?? String(indice + 1)}`;
}

/** Meta de partida del actor: la fijada en Actores o la que calculó el motor. */
function metaBase(c: CalcMuestraComponente): number {
  return metaCuotaFijada(c) ?? sugerenciaCuota(c) ?? 0;
}

/**
 * Propuestas de partida: A, B y C con la meta del actor, dos tercios y la mitad. Son puntos de partida editables,
 * no decisiones.
 */
export function propuestasIniciales(componentes: readonly CalcMuestraComponente[]): EscenarioPropuesta[] {
  const actores = componentes.filter((c) => safeNumber(c.marco?.marco_validado, 0) > 0 && CUANTITATIVOS.has(c.actor_categoria));
  return FRACCIONES.map((f, i) => ({
    nombre: nombrePropuesta(i),
    metas: Object.fromEntries(actores.map((c) => [c.id, Math.round(metaBase(c) * f)])),
  }));
}

/**
 * Lo que se ve y se exporta: lo guardado en el estudio, completado con la meta de partida para un actor que se
 * agregó después; sin nada guardado, las tres propuestas de partida.
 */
export function propuestaVigente(
  guardada: CalcMuestraWorkspacePropuesta | null | undefined,
  componentes: readonly CalcMuestraComponente[],
): EstadoPropuesta {
  const iniciales = propuestasIniciales(componentes);
  const escenarios = guardada?.escenarios?.length ? guardada.escenarios.slice(0, MAX_PROPUESTAS) : iniciales;
  return {
    escenarios: escenarios.map((e, i) => {
      const partida = iniciales[Math.min(i, iniciales.length - 1)]?.metas ?? {};
      const metas = Array.isArray(e.metas) ? {} : e.metas ?? {};
      return { nombre: e.nombre?.trim() || nombrePropuesta(i), metas: { ...partida, ...metas } };
    }),
    solicitante: guardada?.solicitante ?? "",
    incluir_portada: guardada?.incluir_portada ?? true,
    incluir_diseno: guardada?.incluir_diseno ?? true,
  };
}

export function fijarMeta(estado: EstadoPropuesta, indice: number, id: string, valor: number): EstadoPropuesta {
  return {
    ...estado,
    escenarios: estado.escenarios.map((e, i) => (
      i === indice ? { ...e, metas: { ...e.metas, [id]: Math.max(0, Math.round(valor)) } } : e
    )),
  };
}

/** Una propuesta más, al final, con tres cuartos de la última: es más pequeña, como las que la preceden. */
export function agregarPropuesta(estado: EstadoPropuesta): EstadoPropuesta {
  if (estado.escenarios.length >= MAX_PROPUESTAS) return estado;
  const ultima = estado.escenarios[estado.escenarios.length - 1]?.metas ?? {};
  const metas = Object.fromEntries(Object.entries(ultima).map(([id, n]) => [id, Math.round(n * 0.75)]));
  return { ...estado, escenarios: [...estado.escenarios, { nombre: nombrePropuesta(estado.escenarios.length), metas }] };
}

/** Se quita la última, para que las letras sigan en orden. Siempre queda una. */
export function quitarUltimaPropuesta(estado: EstadoPropuesta): EstadoPropuesta {
  if (estado.escenarios.length <= 1) return estado;
  return { ...estado, escenarios: estado.escenarios.slice(0, -1) };
}

export function totalPropuesta(metas: Record<string, number>, filas: readonly FilaPropuesta[]): number {
  return filas.reduce((suma, f) => suma + (metas[f.id] ?? 0), 0);
}

/**
 * Margen de referencia al 95 % con p = 0.5 y corrección por población finita, el mismo que publica el PPT
 * (`.cmp_margen_ref`). Referencial: el barrido no es una muestra aleatoria.
 */
export function margenReferencia(n: number, N: number): number | null {
  if (!(n > 0) || !(N > 1)) return null;
  if (n >= N) return 0;
  return 1.96 * Math.sqrt((0.25 / n) * ((N - n) / (N - 1)));
}

export type LecturaMeta = {
  margen: number | null;
  /** Respuesta que exige la meta sobre la población invitada (meta / N). */
  respuestaNecesaria: number | null;
  /** La meta exige más respuesta que la esperada del actor: no se alcanzaría invitando a todos. */
  excede: boolean;
};

export function lecturaMeta(n: number, fila: FilaPropuesta): LecturaMeta {
  const necesaria = n > 0 && fila.poblacion > 0 ? n / fila.poblacion : null;
  return {
    margen: margenReferencia(n, fila.poblacion),
    respuestaNecesaria: necesaria,
    excede: necesaria != null && fila.respuestaEsperada != null && necesaria > fila.respuestaEsperada,
  };
}

/** "9.6 %": un decimal con punto, como en el PPT. */
export function fmtPorcentaje(x: number): string {
  return `${(x * 100).toFixed(1)} %`;
}

export function payloadPropuesta(
  formato: "pptx" | "xlsx",
  estado: EstadoPropuesta,
  filas: readonly FilaPropuesta[],
): CalcMuestraPropuestaPayload {
  const solo = (m: Record<string, number>) => Object.fromEntries(filas.map((f) => [f.id, Math.max(0, Math.round(m[f.id] ?? 0))]));
  const solicitante = estado.solicitante.trim();
  return {
    formato,
    escenarios: estado.escenarios.map((e) => ({ nombre: e.nombre, metas: solo(e.metas) })),
    incluir_portada: estado.incluir_portada,
    incluir_diseno: estado.incluir_diseno,
    ...(solicitante ? { solicitante: solicitante.startsWith("Solicitante") ? solicitante : `Solicitante: ${solicitante}` } : {}),
  };
}
