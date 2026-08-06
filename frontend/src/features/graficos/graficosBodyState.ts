/**
 * Qué muestra el cuerpo de Gráficos, como decisión aparte de su render.
 *
 * Vive fuera de la página porque el estado que importa —«todavía no hidrató»—
 * es inalcanzable desde el navegador una vez que la sesión hidrató: `hydrated`
 * no vuelve a `false` en la misma vida de la página, así que dos sondas en vivo
 * no lograron observarlo. Como función pura sí se prueba, y de paso la
 * precedencia queda escrita en un solo sitio.
 *
 * La precedencia NO es intercambiable: la hidratación va primero porque
 * `prepOk` sale del estado de sesión y todavía es `false` mientras se carga.
 * Sin ese orden, el usuario veía «Primero prepara los datos en Analítica»
 * aunque los datos ya estuvieran preparados — un aviso que acusa al usuario de
 * algo que sí hizo.
 */
export type GraficosBodyState =
  | "cargando"
  | "reintentando"
  | "editor"
  | "prep-bloqueado";

export function graficosBodyState({
  hydrated,
  hydrationRetrying,
  isSharedReport,
  prepOk,
}: {
  hydrated: boolean;
  hydrationRetrying: boolean;
  isSharedReport: boolean;
  prepOk: boolean;
}): GraficosBodyState {
  if (!hydrated) return hydrationRetrying ? "reintentando" : "cargando";
  if (isSharedReport || prepOk) return "editor";
  return "prep-bloqueado";
}

export function graficosBodyLoadingLabel(state: GraficosBodyState): string {
  return state === "reintentando"
    ? "No se pudo leer el plan de láminas. Reintentando…"
    : "Cargando el plan de láminas y las variables de cada base…";
}
