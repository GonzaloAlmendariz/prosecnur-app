// Mandos de la tarjeta del gráfico que el motor lee sólo desde `overrides` (U6 del checklist de mandos del mazo,
// 2026-11-05). El constructor `p_*()` no los tiene como formal: suelto en `args`, `.clean_rebuild_args` los descarta y la
// lámina no cambia. La tarjeta los lee de `args` (como todo campo de la lista blanca), así que cada escritura va en
// espejo a los dos lados. El backend completa el lado que falte en planes viejos y, si difieren, manda `overrides`
// (api/R/graficos_migrar_args_overrides.R, `.GRAFICOS_ARGS_ESPEJO_OVERRIDES`). Las dos listas son la misma.

// U10 (2026-11-05): `mostrar_frecuencia` del histograma tampoco es formal de `p_histograma()`; su `...` lo pasaría a
// `overrides`, pero `.clean_rebuild_args` descarta antes todo lo que no es formal con nombre (router_graficos.R).
export const MANDOS_ESPEJO_OVERRIDES: ReadonlySet<string> = new Set(["pista_barras", "colorear_por_opcion", "marca_mediana", "mostrar_frecuencia", "referencia_barra"]);

/**
 * B8 (ronda 20): «Referencia de las barras» viaja por `overrides` en las barras agrupadas y categóricas, pero en
 * `p_cobertura` es formal del constructor (graficos_cobertura_plan.R lo pasa él a `overrides`): ahí se guarda sólo en
 * `args`. El backend tiene la misma excepción (`.GRAFICOS_ARGS_ESPEJO_FORMAL_EN`, 3c70f4ab5) y completa el lado que falte
 * en planes viejos en los demás graficadores.
 */
export const FORMAL_EN: Readonly<Record<string, ReadonlySet<string>>> = { referencia_barra: new Set(["p_cobertura"]) };

/** ¿El mando va en espejo en este graficador? Sin graficador, por el nombre. */
export function vaEnEspejo(name: string, graficador?: string): boolean {
  if (!MANDOS_ESPEJO_OVERRIDES.has(name)) return false;
  return !(graficador && FORMAL_EN[name]?.has(graficador));
}

const esRegistro = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Lo guardado de un campo de la tarjeta. Para un mando en espejo manda `overrides` si lo trae, como en el backend: un plan
 * escrito a mano que sólo lo pone ahí no se ve apagado en la tarjeta mientras la lámina lo dibuja encendido.
 */
export function valorDeMando(args: Readonly<Record<string, unknown>>, name: string, graficador?: string): unknown {
  if (vaEnEspejo(name, graficador) && esRegistro(args.overrides)) {
    const v = args.overrides[name];
    if (v !== undefined && v !== null) return v;
  }
  return args[name];
}

/**
 * El parche con su copia en `overrides` para los mandos en espejo: un valor se escribe también ahí y un `null` (borrar)
 * lo borra de los dos lados. Sin mandos en espejo devuelve el mismo parche.
 */
export function conEspejoEnOverrides(
  actuales: Readonly<Record<string, unknown>> | undefined,
  parche: Record<string, unknown>,
  graficador?: string,
): Record<string, unknown> {
  const claves = Object.keys(parche).filter((k) => vaEnEspejo(k, graficador));
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
