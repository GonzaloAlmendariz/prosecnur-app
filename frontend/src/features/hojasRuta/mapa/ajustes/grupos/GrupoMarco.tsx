import type { ReactNode } from "react";

/**
 * Grupo 5 de «Ajustes del diseño», Marco elegible (M5): el panel que estaba en el inspector de Manzanas
 * (mínimo de viviendas, áreas excluidas), montado tal cual por la página. Se aplica al sortear.
 */
export function GrupoMarco({ panel }: { panel: ReactNode }) {
  return (
    <div className="hr-ajustes-grupo-cuerpo">
      <section className="hr-ajustes-bloque hr-ajustes-marco">{panel}</section>
    </div>
  );
}
