// Estado de la pestaña «Impreso»: el mismo `PdfDialogState` del diálogo que reemplaza, restaurado de localStorage
// por proyecto + formulario y guardado en cada cambio (pdfExportPreference.ts). Las matrices se recuerdan por la
// firma de sus miembros. La pestaña se monta con `key` por formulario, así que cambiar de formulario relee.

import { useCallback, useEffect, useState } from "react";
import type { MatrixCandidate } from "../parsing/detectMatrixCandidates";
import {
  loadPdfDialogState,
  matrixSignature,
  savePdfDialogState,
  type PdfDialogState,
  type PdfMatrixChoice,
} from "../shell/pdfExportPreference";

export type ControlEstadoImpreso = {
  estado: PdfDialogState;
  actualizar: (patch: Partial<PdfDialogState>) => void;
  actualizarMatriz: (candidata: MatrixCandidate, patch: PdfMatrixChoice) => void;
};

export function useEstadoImpreso(storageKey: string | null, candidatas: readonly MatrixCandidate[]): ControlEstadoImpreso {
  const [estado, setEstado] = useState<PdfDialogState>(() => loadPdfDialogState(storageKey));
  const [tocado, setTocado] = useState(false);

  useEffect(() => {
    if (!tocado) return;
    savePdfDialogState(storageKey, estado, candidatas);
  }, [tocado, storageKey, estado, candidatas]);

  const actualizar = useCallback((patch: Partial<PdfDialogState>) => {
    setTocado(true);
    setEstado((prev) => ({ ...prev, ...patch }));
  }, []);

  const actualizarMatriz = useCallback((candidata: MatrixCandidate, patch: PdfMatrixChoice) => {
    const firma = matrixSignature(candidata);
    setTocado(true);
    setEstado((prev) => ({
      ...prev,
      matrices: { ...prev.matrices, [firma]: { ...prev.matrices[firma], ...patch } },
    }));
  }, []);

  return { estado, actualizar, actualizarMatriz };
}
