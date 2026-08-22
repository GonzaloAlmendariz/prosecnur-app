// materialesDelPlanVigente.ts — qué materiales salieron del plan que sigue vigente.
//
// El motor ya sabe declarar `stale` cuando cambia la huella del plan, pero sólo
// para el DEPLOYMENT (`collection_engine.R:527`). Los artefactos ya generados
// —las fichas QR, los afiches, el consolidado— se listaban con nombre, páginas y
// checksum y nada más, aunque cada recibo guarda su `plan_fingerprint`.
//
// El resultado: se rehace el plan y las fichas viejas siguen ahí, con el mismo
// aspecto que las buenas. Se descargan y se llevan a campo con los cursos-horario
// del sorteo anterior. Es el mismo defecto del plan desfasado, un eslabón más
// adelante y con peores consecuencias, porque un papel impreso ya no avisa de
// nada.
//
// El dato estaba entero desde el principio; lo que faltaba era compararlo.

/** Lo mínimo que hace falta de un recibo de artefacto. */
export type MaterialConProcedencia = {
  receipt_id: string;
  plan_fingerprint?: string | null;
};

export type MaterialJuzgado<T> = {
  material: T;
  /** `true` sólo cuando consta que salió de OTRO plan. */
  desfasado: boolean;
};

const limpia = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Marca los materiales que no salieron del plan vigente.
 *
 * Dos abstenciones deliberadas, porque una marca falsa aquí desprestigia todas
 * las demás:
 *
 * - **Sin huella vigente no se juzga nada.** Un proyecto que todavía no tiene
 *   plan no vuelve obsoletos sus materiales; simplemente no hay con qué
 *   comparar.
 * - **Un material sin huella tampoco se marca.** Un recibo viejo, anterior a que
 *   se guardara la procedencia, no es prueba de desfase: es falta de dato, y
 *   tratarlo como desfase acusaría por no saber.
 */
export function juzgarMaterialesDelPlan<T extends MaterialConProcedencia>(
  materiales: ReadonlyArray<T>,
  huellaVigente: unknown,
): MaterialJuzgado<T>[] {
  const vigente = limpia(huellaVigente);
  return materiales.map((material) => {
    const suya = limpia(material.plan_fingerprint);
    return {
      material,
      desfasado: Boolean(vigente) && Boolean(suya) && suya !== vigente,
    };
  });
}

/** Cuántos de los materiales salieron de un plan que ya no está. */
export function contarDesfasados<T extends MaterialConProcedencia>(
  materiales: ReadonlyArray<T>,
  huellaVigente: unknown,
): number {
  return juzgarMaterialesDelPlan(materiales, huellaVigente).filter((x) => x.desfasado).length;
}
