// Mandos de la tarjeta del gráfico que el motor lee sólo desde `overrides` (U6 del checklist de mandos del mazo,
// 2026-11-05). El constructor `p_*()` no los tiene como formal: suelto en `args`, `.clean_rebuild_args` los descarta y la
// lámina no cambia. La tarjeta los lee de `args` (como todo campo de la lista blanca), así que cada escritura va en
// espejo a los dos lados. El backend completa el lado que falte en planes viejos y, si difieren, manda `overrides`
// (api/R/graficos_migrar_args_overrides.R, `.GRAFICOS_ARGS_ESPEJO_OVERRIDES`). Las dos listas son la misma.

export const MANDOS_ESPEJO_OVERRIDES: ReadonlySet<string> = new Set(["pista_barras", "colorear_por_opcion", "marca_mediana"]);

const esRegistro = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * El parche con su copia en `overrides` para los mandos en espejo: un valor se escribe también ahí y un `null` (borrar)
 * lo borra de los dos lados. Sin mandos en espejo devuelve el mismo parche.
 */
export function conEspejoEnOverrides(
  actuales: Readonly<Record<string, unknown>> | undefined,
  parche: Record<string, unknown>,
): Record<string, unknown> {
  const claves = Object.keys(parche).filter((k) => MANDOS_ESPEJO_OVERRIDES.has(k));
  if (!claves.length) return parche;
  const base = esRegistro(parche.overrides) ? parche.overrides : esRegistro(actuales?.overrides) ? actuales.overrides : {};
  const overrides: Record<string, unknown> = { ...base };
  for (const k of claves) {
    const v = parche[k];
    if (v === null || v === undefined) delete overrides[k];
    else overrides[k] = v;
  }
  return { ...parche, overrides: Object.keys(overrides).length ? overrides : null };
}
