import { Link2 } from "../../../../vendor/lucide-react";
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
      aria-labelledby="cmv2-fuentes-consistencia-title"
      data-surface-group="calc-muestra-datos"
      data-surface-contract="consistencia-entre-fuentes"
      data-qa-geometry-group="calc-muestra/consistencia-fuentes"
      data-qa-geometry-contract="intrinsic"
    >
      <header className="cmv2-fuentes-consistencia-head">
        <span aria-hidden="true"><Link2 size={18} /></span>
        <div>
          <small>Datos</small>
          <h3 id="cmv2-fuentes-consistencia-title">Consistencia entre fuentes</h3>
          {/* S3: qué califica esta pestaña, en una línea. El «después de
              declarar y construir» lo dice ya el orden del riel. */}
          <p>Comprueba que la relación estudiante–curso-horario conserve sus llaves.</p>
        </div>
      </header>
      <MarcoConsistenciaTab workspace={workspace} aulasState={aulasState} />
    </section>
  );
}
