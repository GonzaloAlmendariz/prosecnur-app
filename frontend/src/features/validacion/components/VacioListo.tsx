import type { ReactNode } from "react";

/**
 * Un vacío o un error de pestaña también es una vista terminada: declara la misma marca de
 * readiness que la vista con datos (`validacion-<pestaña>`), o el QA visual no puede juzgarla.
 * La laguna salió con hsvg2026, que no trae base: Explorar, Criterios y Cierre devolvían su
 * vacío sin marca y el runner se detenía en «sin-marca-de-readiness» (4 nov 2026).
 */
export function VacioListo({ marca, children }: { marca: string; children: ReactNode }) {
  return (
    <div data-audit-ready={marca} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
