import type { AulasStageNoticeModel, AulasSurfaceStage } from "./aulasSurfaceState";

/**
 * El recorrido de Selección que pinta el aviso de etapa.
 *
 * `resolveAulasStageNotice` resuelve UNA causa en un orden fijo —Marco →
 * Cálculo → Método → Selección → Reemplazos—, así que la causa que devuelve
 * dice también dónde está el estudio en ese camino: lo anterior está hecho, esa
 * es la que falta y lo que sigue espera. El aviso viejo sólo decía la causa, y
 * la pestaña quedaba con un párrafo y un panel en blanco debajo; el recorrido
 * enseña el camino completo sin pedirle nada nuevo al modelo.
 */

export type EstadoPaso = "hecho" | "falta" | "espera";

export type PasoRecorrido = { id: string; label: string; estado: EstadoPaso };

const PASOS = [
  { id: "marco", label: "Marco" },
  { id: "calculo", label: "Cálculo" },
  { id: "metodo", label: "Método" },
  { id: "seleccion", label: "Selección" },
  { id: "reemplazos", label: "Reemplazos" },
] as const;

const PASO_DE_CAUSA: Record<AulasStageNoticeModel["kind"], number> = {
  "missing-frame": 0,
  "missing-objective": 1,
  "stored-unaccredited": 1,
  "missing-comparison": 2,
  "missing-selection": 3,
  "missing-replacements": 4,
};

export function recorridoDeLaCausa(kind: AulasStageNoticeModel["kind"]): PasoRecorrido[] {
  const actual = PASO_DE_CAUSA[kind];
  return PASOS.map((paso, i) => ({
    ...paso,
    estado: i < actual ? "hecho" : i === actual ? "falta" : "espera",
  }));
}

/** Lo que la pestaña entrega cuando el camino llega a ella: el vacío dice qué se va a ver. */
const PROMESA: Record<AulasSurfaceStage, string> = {
  objetivo: "Las cuotas por facultad y los cursos-horario que hay que intentar.",
  metodo: "Los cuatro métodos de sorteo medidos con la misma regla: representatividad, balance, cobertura y repetidos.",
  laboratorio: "La estabilidad de los pesos, la frecuencia con que sale cada aula y la variabilidad del diseño.",
  seleccion: "Los cursos-horario titulares, con su facultad, su peso y su cadena de reemplazos.",
  relato: "La corrida contada escena por escena, del marco al sorteo.",
  reemplazos: "Las rutas de reemplazo de cada curso-horario y lo que aporta cada una.",
  auditoria: "Las fórmulas con los valores reales del estudio, y sus campos, pesos y fuentes.",
  "salidas-monitoreo": "Los titulares y reemplazos que recibe Monitoreo, con su trazabilidad.",
};

export function promesaDeLaPestana(etapa: AulasSurfaceStage | undefined): string | null {
  return etapa ? PROMESA[etapa] : null;
}
