import type { ReactNode } from "react";

/**
 * La forma de la tabla compartida del perfil de aulas.
 *
 * `DataTable` sigue viviendo en `AulasMonitoreoPage.tsx` y las pestañas
 * extraídas la reciben como prop. El tipo se declara aquí, y no como
 * `Record<string, unknown>`, porque con un tipo laxo el typecheck dejaba pasar
 * una llamada sin `rows` ni `empty` — y la tabla vacía no falla, se pinta.
 */
export type TablaDelPerfil = (props: {
  rows: Array<Record<string, unknown>>;
  empty: string;
  preferredColumns?: string[];
  totalReal?: number;
  maxColumns?: number;
}) => ReactNode;
