// =============================================================================
// shell/EditorSmImportNotice.tsx — lo que queda por hacer tras traer de SM
// =============================================================================
// Un formulario traducido de SurveyMonkey llega con dos pendientes que el
// importador no resuelve solo:
//   · H7: escalas idénticas repetidas como listas distintas («list_p13_1»,
//     «list_p13_2»…). Una línea las cuenta y abre «Listas de opciones».
//   · H9: lo que la encuesta trae y el formulario no importa (variables
//     personalizadas como `cv_id`, imágenes), dicho con su causa.
// Se puede cerrar; vuelve a aparecer al abrir otro formulario con pendientes.
// No pinta nada si no hay nada que decir.
// =============================================================================

import { useState } from "react";
import { X } from "../../../vendor/lucide-react";
import type { XlsformFormSource } from "../../../api/multiIntegrado";
import { SmFueraDelFormulario, fueraDelFormularioDe } from "./SmImportResumen";

export type EditorSmImportNoticeProps = {
  formId: string | null;
  source: XlsformFormSource | null;
  repetidas: number;
  onOpenListas: () => void;
};

export function EditorSmImportNotice({ formId, source, repetidas, onOpenListas }: EditorSmImportNoticeProps) {
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  if (source?.kind !== "surveymonkey") return null;
  const fuera = fueraDelFormularioDe(source);
  if (repetidas <= 0 && fuera.length === 0) return null;
  if (dismissedFor != null && dismissedFor === (formId ?? "")) return null;

  return (
    <aside className="pulso-xf-sm-pendientes" aria-label="Pendientes de la traducción desde SurveyMonkey">
      <div className="pulso-xf-sm-pendientes-cuerpo">
        {repetidas > 0 && (
          <p className="pulso-xf-sm-pendientes-linea">
            <strong>
              {repetidas} {repetidas === 1 ? "escala se repite" : "escalas se repiten"}
            </strong>
            {" "}como listas distintas.{" "}
            <button type="button" className="pulso-xf-sm-pendientes-accion" onClick={onOpenListas}>
              Unifícalas
            </button>
          </p>
        )}
        <SmFueraDelFormulario items={fuera} />
      </div>
      <button
        type="button"
        className="pulso-icon pulso-xf-sm-pendientes-cerrar"
        onClick={() => setDismissedFor(formId ?? "")}
        aria-label="Ocultar pendientes de la traducción"
        title="Ocultar"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </aside>
  );
}
