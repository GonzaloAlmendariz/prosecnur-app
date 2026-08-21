/**
 * Modelo de la tarjeta «La tasa de efectividad de cada facultad» (plan 1b/E7).
 *
 * Mandato de Gonzalo: «sumamente explicada de forma visual y didáctica en
 * Cursos-horario requeridos, porque ahí se pide cuántas aulas se requieren
 * por facultad sabiendo la tasa de efectividad por facultad».
 *
 * Junta el bloque publicado por el motor (tasas por facultad) con los
 * estratos del componente activo (cuota, P25, cupos) para poder ENSEÑAR la
 * aritmética viva: cuota ÷ (P25 × tasa) → cupos. Si la cuenta local no
 * reproduce los cupos del motor, la fila lo declara (descuadre) en vez de
 * fingir coherencia.
 */
import {
  normalizeCalcMuestraTasasFacultad,
  type CalcMuestraTasaFacultad,
} from "../../../../api/calcMuestraTasasFacultad";

export type EstratoDimensionado = {
  estrato?: unknown;
  cuota?: unknown;
  avg_conglomerado?: unknown;
  aulas_base?: unknown;
  tau?: unknown;
};

export type FilaTasaFacultad = {
  facultad: string;
  tasa: number;
  conResidual: boolean;
  k: number | null;
  nAulasMarco: number;
  /** Aritmética del dimensionamiento; null cuando el estrato no está. */
  cuota: number | null;
  p25: number | null;
  cupos: number | null;
  /** ceil(cuota/(p25×tasa)) reproducido en el front === cupos del motor. */
  cuentaCuadra: boolean | null;
  /**
   * Los dos factores de la tasa (tasa = mix × residual), para poder mostrar de
   * dónde sale. Ambos null cuando el motor no los publica o cuando no
   * reconstruyen la tasa vigente — nunca se enseña una cuenta que no cuadra.
   */
  mix: number | null;
  residual: number | null;
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function tasasFacultad(
  raw: unknown,
  estratos: EstratoDimensionado[] | null | undefined,
): FilaTasaFacultad[] {
  const tasas: CalcMuestraTasaFacultad[] = normalizeCalcMuestraTasasFacultad(raw);
  if (!tasas.length) return [];
  const porFac = new Map<string, { cuota: number; p25: number; cupos: number; tau: number | null }>();
  for (const e of estratos ?? []) {
    const key = String(e.estrato ?? "").trim().toUpperCase();
    const cuota = num(e.cuota);
    const p25 = num(e.avg_conglomerado);
    const cupos = num(e.aulas_base);
    if (!key || cuota == null || p25 == null || p25 <= 0 || cupos == null) continue;
    porFac.set(key, { cuota, p25, cupos, tau: num(e.tau) });
  }
  return tasas
    .map((t) => {
      const dim = porFac.get(t.facultad.toUpperCase()) ?? null;
      // La tasa que dimensiona es la del ESTRATO (sellada); la del marco es la
      // misma por construcción, pero si divergieran manda el estrato y la
      // cuenta lo delataría.
      const tasaVigente = dim?.tau != null && dim.tau > 0 ? dim.tau : t.tasa;
      const cuposLocal = dim ? Math.ceil(dim.cuota / (dim.p25 * tasaVigente)) : null;
      // El desglose sólo se ofrece si reconstruye la tasa QUE SE VA A MOSTRAR.
      // Cuando manda la del estrato y difiere de la del marco, los factores del
      // marco explicarían otro número: mejor sin desglose que con uno que miente.
      const desglosaLaVigente =
        t.rendimiento_mix != null && t.factor_residual != null &&
        Math.abs(t.rendimiento_mix * t.factor_residual - tasaVigente) <= 0.0005;
      return {
        facultad: t.facultad,
        tasa: tasaVigente,
        mix: desglosaLaVigente ? t.rendimiento_mix : null,
        residual: desglosaLaVigente ? t.factor_residual : null,
        conResidual: t.con_residual,
        k: t.facultad_k,
        nAulasMarco: t.n_aulas,
        cuota: dim?.cuota ?? null,
        p25: dim?.p25 ?? null,
        cupos: dim?.cupos ?? null,
        cuentaCuadra: dim && cuposLocal != null ? cuposLocal === dim.cupos : null,
      };
    })
    .sort((a, b) => (b.cuota ?? 0) - (a.cuota ?? 0) || b.tasa - a.tasa);
}

/**
 * De dónde sale REALMENTE la tasa que se muestra por facultad.
 *
 * Había dos etiquetas —«medida en el histórico» o «derivada de su mix de
 * tamaños»— y un tercer caso sin nombre que es justo el de quien estrena la
 * app: sin histórico, el factor de cada facultad es 1 y la tasa que se pinta es
 * la de referencia del preset, plana e idéntica en las quince. Llamar a eso
 * «derivada de su mix» promete un cálculo propio del estudio que no ocurrió.
 *
 * Se distingue por evidencia, no por configuración: si alguna facultad trae
 * residual medido, hay histórico; si no lo hay pero las tasas difieren, la
 * derivación por mix de tamaños sí ocurrió; si todas comparten exactamente la
 * misma, no se derivó nada.
 */
export function origenTasaFacultades(
  filas: Array<{ tasa: number; conResidual: boolean }>,
): "historico" | "mix" | "general" {
  if (!filas.length) return "general";
  if (filas.some((f) => f.conResidual)) return "historico";
  const primera = filas[0].tasa;
  return filas.every((f) => Math.abs(f.tasa - primera) < 1e-9) ? "general" : "mix";
}
