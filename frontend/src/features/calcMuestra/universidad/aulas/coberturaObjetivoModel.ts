/**
 * ¿La selección vigente alcanza la muestra objetivo?
 *
 * La pestaña de selección publicaba cuántos titulares salieron, cuántos
 * reemplazos y qué score de representatividad tienen — pero no la única cifra
 * que decide si se puede salir a campo: los estudiantes que esos titulares
 * cubren frente a los que hacen falta. Sin ese contraste, una selección que
 * cubre el 82% de la muestra objetivo se ve exactamente igual que una que
 * cubre el 130%.
 *
 * Nada se recalcula acá: `cubiertos` es la métrica de estudiantes únicos que
 * publica el motor y `objetivo` es el n del resultado.
 */
import type { CalcMuestraAulasCerteza } from "../../../../api/client";

export type CoberturaObjetivoEstado = "sin_datos" | "corta" | "justa" | "holgada";

export type CoberturaObjetivo = {
  cubiertos: number | null;
  objetivo: number | null;
  ratio: number | null;
  /** Σ efectivas_esperadas de los titulares (calibración del diseño); null si
   *  el motor no la anotó. Es LA métrica que decide: la cuota se logra con
   *  efectivas, no con elegibles sentados (Gonzalo, 2026-08-20: «239% me
   *  parece bien alta — ¿está contando solo elegibles?»). */
  esperadas: number | null;
  ratioEsperadas: number | null;
  estado: CoberturaObjetivoEstado;
  /** Facultades que la certeza marcó como cortas o agotadas, si se midió. */
  facultadesCortas: string[];
};

/**
 * Umbral de holgura. Por debajo de 1 la selección no llega; entre 1 y 1.1 llega
 * sin margen —y en campo el margen es lo que absorbe un aula que no se pudo
 * aplicar—, así que se nombra "justa" y no "lista".
 */
const HOLGURA_MINIMA = 1.1;

function finito(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export function coberturaObjetivo({
  cubiertos,
  objetivo,
  esperadas,
  certeza,
}: {
  cubiertos: unknown;
  objetivo: unknown;
  /** Σ efectivas_esperadas de los titulares; opcional (marcos sin calibración). */
  esperadas?: unknown;
  certeza?: CalcMuestraAulasCerteza | null;
}): CoberturaObjetivo {
  const cub = finito(cubiertos);
  const obj = finito(objetivo);
  const esp = finito(esperadas);
  const ratio = cub != null && obj != null ? cub / obj : null;
  const ratioEsperadas = esp != null && obj != null ? esp / obj : null;
  // El veredicto lo decide el rendimiento esperado cuando existe: sentar
  // 2,4× la cuota en elegibles no es cubrirla — con τ rinden ~1,26×. El ratio
  // físico queda de fallback para marcos sin calibración.
  const ratioJuez = ratioEsperadas ?? ratio;
  const estado: CoberturaObjetivoEstado = ratioJuez == null
    ? "sin_datos"
    : ratioJuez < 1
      ? "corta"
      : ratioJuez < HOLGURA_MINIMA
        ? "justa"
        : "holgada";

  const facultadesCortas = Array.isArray(certeza?.filas)
    ? certeza.filas
        .filter((fila) => fila.agotado || (typeof fila.brecha === "number" && fila.brecha > 0))
        .map((fila) => fila.label)
    : [];

  return { cubiertos: cub, objetivo: obj, ratio, esperadas: esp, ratioEsperadas, estado, facultadesCortas };
}
