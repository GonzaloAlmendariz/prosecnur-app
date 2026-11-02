// Estado de la pestaña «Impreso»: el mismo `PdfDialogState` del diálogo que reemplaza. Arranca con la copia local
// (localStorage por proyecto + formulario, instantánea) y, si el .pulso trae opciones y la persona aún no tocó
// nada, adopta las del proyecto (L36 · D-L36-16). Cada cambio se guarda en localStorage al momento y en el
// proyecto tras una espera. Las matrices se recuerdan por la firma de sus miembros. La pestaña se monta con `key`
// por formulario, así que cambiar de formulario relee.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiImpresoGuardar,
  apiImpresoGuardarVersion,
  apiImpresoLeer,
  type ImpresoVersion,
} from "../../../api/xlsformImpreso";
import type { MatrixCandidate } from "../parsing/detectMatrixCandidates";
import {
  loadPdfDialogState,
  matrixSignature,
  parsePdfDialogState,
  savePdfDialogState,
  serializePdfDialogState,
  type PdfDialogState,
  type PdfMatrixChoice,
} from "../shell/pdfExportPreference";

/** Espera antes de guardar en el proyecto: escribir un título no hace un POST por tecla. */
export const ESPERA_GUARDADO_MS = 800;

/** Dónde están las opciones respecto del proyecto. `error` lleva la causa. */
export type SincroniaImpreso =
  | { fase: "local" }
  | { fase: "guardando" }
  | { fase: "guardado"; en: string }
  | { fase: "error"; causa: string };

export type ControlEstadoImpreso = {
  estado: PdfDialogState;
  actualizar: (patch: Partial<PdfDialogState>) => void;
  actualizarMatriz: (candidata: MatrixCandidate, patch: PdfMatrixChoice) => void;
  sincronia: SincroniaImpreso;
  versiones: readonly ImpresoVersion[];
  /** Guarda las opciones actuales como versión con nombre (D-L36-17). */
  guardarVersion: (nombre: string) => Promise<boolean>;
  /** Restaura una versión como opciones actuales, sin borrarla. */
  usarVersion: (version: ImpresoVersion) => void;
};

function causaDe(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "el servidor no respondió";
}

export function useEstadoImpreso(
  storageKey: string | null,
  candidatas: readonly MatrixCandidate[],
  formId: string | null = null,
): ControlEstadoImpreso {
  const [estado, setEstado] = useState<PdfDialogState>(() => loadPdfDialogState(storageKey));
  const [tocado, setTocado] = useState(false);
  const tocadoRef = useRef(false);
  const [sincronia, setSincronia] = useState<SincroniaImpreso>({ fase: "local" });
  const [versiones, setVersiones] = useState<readonly ImpresoVersion[]>([]);

  // Lo que trae el proyecto. Si la persona ya cambió algo mientras llegaba, gana lo suyo.
  useEffect(() => {
    if (!formId) return;
    let vigente = true;
    apiImpresoLeer(formId)
      .then((guardado) => {
        if (!vigente) return;
        setVersiones(guardado.versiones);
        if (guardado.opciones && !tocadoRef.current) {
          setEstado(parsePdfDialogState(guardado.opciones));
          setSincronia({ fase: "guardado", en: guardado.guardado_en });
        }
      })
      .catch(() => undefined); // Sin proyecto que responda, la copia local sigue sirviendo.
    return () => { vigente = false; };
  }, [formId]);

  useEffect(() => {
    if (!tocado) return;
    savePdfDialogState(storageKey, estado, candidatas);
    if (!formId) return;
    let vigente = true;
    const t = setTimeout(() => {
      setSincronia({ fase: "guardando" });
      apiImpresoGuardar(formId, serializePdfDialogState(estado, candidatas))
        .then((g) => { if (vigente) setSincronia({ fase: "guardado", en: g.guardado_en }); })
        .catch((error: unknown) => { if (vigente) setSincronia({ fase: "error", causa: causaDe(error) }); });
    }, ESPERA_GUARDADO_MS);
    return () => { vigente = false; clearTimeout(t); };
  }, [tocado, storageKey, estado, candidatas, formId]);

  const tocar = useCallback(() => {
    tocadoRef.current = true;
    setTocado(true);
  }, []);

  const actualizar = useCallback((patch: Partial<PdfDialogState>) => {
    tocar();
    setEstado((prev) => ({ ...prev, ...patch }));
  }, [tocar]);

  const actualizarMatriz = useCallback((candidata: MatrixCandidate, patch: PdfMatrixChoice) => {
    const firma = matrixSignature(candidata);
    tocar();
    setEstado((prev) => ({
      ...prev,
      matrices: { ...prev.matrices, [firma]: { ...prev.matrices[firma], ...patch } },
    }));
  }, [tocar]);

  const guardarVersion = useCallback(async (nombre: string) => {
    if (!formId || !nombre.trim()) return false;
    try {
      const g = await apiImpresoGuardarVersion(formId, nombre.trim(), serializePdfDialogState(estado, candidatas));
      setVersiones(g.versiones);
      setSincronia({ fase: "guardado", en: g.guardado_en });
      return true;
    } catch (error) {
      setSincronia({ fase: "error", causa: causaDe(error) });
      return false;
    }
  }, [formId, estado, candidatas]);

  const usarVersion = useCallback((version: ImpresoVersion) => {
    tocar();
    setEstado(parsePdfDialogState(version.opciones));
  }, [tocar]);

  return { estado, actualizar, actualizarMatriz, sincronia, versiones, guardarVersion, usarVersion };
}
