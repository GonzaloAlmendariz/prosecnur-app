import { useMemo } from "react";
import type { ExploradorVariablesList, ReglaCustom } from "../types";
import { PanelRegla } from "../reglas/panel/PanelRegla";
import { comoCuerpoDelCliente, comoReglaPropia } from "../reglas/tiposDelMotor";

// =============================================================================
// ReglaEditor: el editor de una regla propia, con la firma de siempre.
// =============================================================================
// Hasta la rebanada V2 del plan de fidelidad era un asistente de tres pasos
// (tipo, preguntas, condición). Ese asistente se retiró: sus campos y su estado
// pasaron a `reglas/` (`borradorDeRegla.ts`, `campos/`, `panel/`) y el editor
// es ahora el panel de regla (`reglas/panel/PanelRegla.tsx`), siempre abierto.
// Queda esta envoltura para quien monte el editor con la firma vieja
// (`reglas/payloadDeRegla.test.tsx`). La pestaña de reglas abre el panel por
// la dirección (`panel=regla`); el resto se retira en V6, con confirmación.

type Props = {
  inv: ExploradorVariablesList;
  baseNombre?: string | null;
  inicial?: ReglaCustom | null;
  onSubmit: (payload: Omit<ReglaCustom, "id" | "created_at"> & { id?: string }) => Promise<void>;
  onCancel: () => void;
};

export default function ReglaEditor({ inv, baseNombre, inicial, onSubmit, onCancel }: Props) {
  const variables = useMemo(() => inv.secciones.flatMap((s) => s.variables), [inv.secciones]);
  return (
    <PanelRegla
      abierto
      onCerrar={onCancel}
      inicial={inicial ? comoReglaPropia(inicial) : null}
      variables={variables}
      baseNombre={baseNombre ?? null}
      semillas={[]}
      onGuardar={(cuerpo) => onSubmit(comoCuerpoDelCliente(cuerpo))}
    />
  );
}
