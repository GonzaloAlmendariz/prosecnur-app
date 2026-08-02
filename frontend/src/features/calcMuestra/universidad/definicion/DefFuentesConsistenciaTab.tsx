import { useEffect, useRef } from "react";
import { Link2 } from "../../../../vendor/lucide-react";
import type {
  CalcMuestraAulasState,
  CalcMuestraReferenciaAsistencia,
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceSourceBinding,
} from "../../../../api/client";
import { MarcoConsistenciaTab } from "../marco/MarcoConsistenciaTab";
import { DefBasesTab } from "./DefBasesTab";
import "./fuentesConsistencia.css";

export function DefFuentesConsistenciaTab({
  focusConsistency = false,
  workspace,
  aulasState,
  referencia,
  onWorkspace,
  onSourceUpload,
  onSourceBuild,
  onReferenceSheetChange,
  uploadingSourceId,
}: {
  focusConsistency?: boolean;
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  referencia: CalcMuestraReferenciaAsistencia | null;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onSourceUpload: (binding: CalcMuestraWorkspaceSourceBinding, file: File) => void | Promise<void>;
  onSourceBuild: (workspace: CalcMuestraWorkspace) => void | Promise<void>;
  onReferenceSheetChange: (
    binding: CalcMuestraWorkspaceSourceBinding,
    workspace: CalcMuestraWorkspace,
  ) => void | Promise<void>;
  uploadingSourceId: string | null;
}) {
  const consistencyRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!focusConsistency) return;
    const target = consistencyRef.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [focusConsistency]);

  return (
    <div
      className="cmv2-fuentes-consistencia"
      data-surface-group="calc-muestra-datos"
      data-surface-contract="fuentes-y-consistencia"
      data-qa-geometry-group="calc-muestra/fuentes-consistencia"
      data-qa-geometry-contract="intrinsic"
    >
      <DefBasesTab
        workspace={workspace}
        aulasState={aulasState}
        referencia={referencia}
        onWorkspace={onWorkspace}
        onSourceUpload={onSourceUpload}
        onSourceBuild={onSourceBuild}
        onReferenceSheetChange={onReferenceSheetChange}
        uploadingSourceId={uploadingSourceId}
      />
      <section
        ref={consistencyRef}
        id="cmv2-local-def-consistencia"
        className="cmv2-fuentes-consistencia-block"
        aria-labelledby="cmv2-fuentes-consistencia-title"
        tabIndex={-1}
        data-qa-geometry-member
      >
        <header className="cmv2-fuentes-consistencia-head">
          <span aria-hidden="true"><Link2 size={18} /></span>
          <div>
            <small>Subpágina de Fuentes</small>
            <h3 id="cmv2-fuentes-consistencia-title">Consistencia entre fuentes</h3>
            <p>
              Después de declarar y construir las fuentes, comprueba que la relación estudiante–curso-horario
              conserve sus llaves. Esta auditoría vive aquí porque califica el insumo antes de Variables y Marco.
            </p>
          </div>
        </header>
        <MarcoConsistenciaTab workspace={workspace} aulasState={aulasState} />
      </section>
    </div>
  );
}
