import type { SessionState } from "../../api/core";

// Vara V4. `graficos_ppt_ok` y `graficos_word_ok` son escalares de la base
// ACTIVA. En un estudio multibase el riel de etapas y la tarjeta del Home los
// leían directo y daban Gráficos por hecho aunque alguna base no tuviera ni un
// mazo: en `acrconta_mazo`, `egresados` no tiene PPT ni Word y las otras dos
// sí. El motor lo sabía —`graficos_status_por_base` se persiste en el .pulso—
// y ese mapa nunca salía al cliente.

export type CoberturaGraficos = {
  /** La etapa está hecha sólo si NINGUNA base quedó sin entregable. */
  hecho: boolean;
  /** Bases sin PPT ni Word. Vacío cuando no falta ninguna. */
  pendientes: string[];
  /** Frase para el motivo del riel; `null` cuando no hay nada que explicar. */
  motivo: string | null;
};

function listaDeBases(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((x) => x.length > 0);
}

/**
 * Si Gráficos está entregado, y qué falta si no.
 *
 * Sin `graficos_bases_sin_mazo` —un `.pulso` abierto contra una versión
 * anterior— cae al comportamiento de siempre: el escalar manda. Suponer que no
 * falta nada porque el campo no llegó sería afirmar de más.
 */
export function coberturaGraficos(state: SessionState | null | undefined): CoberturaGraficos {
  const algunEntregable = Boolean(state?.graficos_ppt_ok) || Boolean(state?.graficos_word_ok);
  const pendientes = listaDeBases(state?.graficos_bases_sin_mazo);
  if (!pendientes.length) return { hecho: algunEntregable, pendientes: [], motivo: null };

  // Con TODAS las bases pendientes no hay nada generado todavía: es el estado
  // inicial normal y no merece un motivo, que sonaría a incidencia.
  const totalBases = listaDeBases(state?.bases_nombres).length;
  if (totalBases > 0 && pendientes.length >= totalBases) {
    return { hecho: false, pendientes, motivo: null };
  }

  const cuales = pendientes.join(", ");
  const motivo = pendientes.length === 1
    ? `Falta el mazo de ${cuales}.`
    : `Faltan los mazos de ${cuales}.`;
  return { hecho: false, pendientes, motivo };
}
