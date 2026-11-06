// Una dirección puede pedir una pestaña de Analítica que existe en el catálogo
// pero no en ESTE estudio (Multibase o Comparativos en un estudio de una sola
// base). Antes aterrizaba muda en Datos con la URL diciendo otra cosa (L10,
// medido el 2026-10-28 sobre acnur_acg). Esto decide si hay que corregirla.

type PestanaMeta = { readonly key: string; readonly label: string };

export function pestanaPedidaNoDisponible(
  pedida: string | null,
  catalogo: readonly PestanaMeta[],
  disponibles: readonly PestanaMeta[],
): PestanaMeta | null {
  if (!pedida) return null;
  if (disponibles.some((p) => p.key === pedida)) return null;
  return catalogo.find((p) => p.key === pedida) ?? null;
}
