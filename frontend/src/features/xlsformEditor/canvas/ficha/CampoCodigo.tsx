// Código en la base (C23): se edita sobre un borrador y, antes de aplicar, dice cuántas referencias `${x}` se
// reescriben. El renombre y su propagación los hace la página (updateSurveyField con `name`).

import { useId, useMemo } from "react";
import { NameField } from "../../inspector/NameField";
import type { XlsformEditorSheet } from "../../types";
import { contarReferencias } from "./modeloFicha";

export function CampoCodigo({ valor, survey, onCambio }: { valor: string; survey: XlsformEditorSheet | null; onCambio: (v: string) => void }) {
  const id = useId();
  const referencias = useMemo(() => contarReferencias(survey, valor), [survey, valor]);
  return (
    <div className="xfh-campo xfh-campo--codigo">
      <label htmlFor={id}>Código en la base</label>
      <NameField id={id} value={valor} onChange={onCambio} referencias={referencias} />
    </div>
  );
}
