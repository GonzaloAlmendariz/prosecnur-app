import type { CalcMuestraAulasState, CalcMuestraWorkspace } from "../../../../api/client";
import { MarcoConsistenciaTab } from "../marco/MarcoConsistenciaTab";
import "./fuentesConsistencia.css";

/**
 * D10 · Consistencia entre fuentes, pestaña propia de Datos.
 *
 * I18 la integró **dentro** de Fuentes como subpágina provisional; Gonzalo
 * decidió que su hogar es una pestaña propia inmediatamente después. Juntas
 * medían 5,3 pantallas y mezclaban dos actos distintos: declarar y construir
 * las fuentes, y auditar que la relación estudiante–curso-horario conserve sus
 * llaves.
 */
export function DefConsistenciaTab({
  workspace,
  aulasState,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
}) {
  return (
    <section
      className="cmv2-fuentes-consistencia-block"
      aria-label="Consistencia entre fuentes"
      data-surface-group="calc-muestra-datos"
      data-surface-contract="consistencia-entre-fuentes"
      data-qa-geometry-group="calc-muestra/consistencia-fuentes"
      data-qa-geometry-contract="intrinsic"
    >
      {/* Sin cabecera propia: el chrome de la pestaña ya pinta el MISMO icono
          de enlace, el mismo título y su detalle («Consistencia · llaves entre
          estudiante y curso-horario»). Esta repetía las tres cosas y añadía un
          «Datos» que el riel ya dice — parafrasear el título es sobreexplicar,
          y la duplicación se veía a simple vista en 1024×600, donde ocupaba
          dos tercios de lo visible antes del primer dato. */}
      <MarcoConsistenciaTab workspace={workspace} aulasState={aulasState} />
    </section>
  );
}
