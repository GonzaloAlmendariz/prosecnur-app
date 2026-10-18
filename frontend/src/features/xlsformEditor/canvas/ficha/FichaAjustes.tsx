// Ajustes del formulario en la columna de la ficha: identidad (título, ID, versión, idioma) y calidad de campo.
// Movido sin cambios de comportamiento desde canvas/FocusedWorkspace.tsx (rediseño del Constructor, 2026-10-17).

import { CalidadCampo } from "../../ajustes/CalidadCampo";
import type { XlsformEditorWorkbook } from "../../types";
import { BloqueFicha, CampoTexto } from "./piezasFicha";

export function FichaAjustes({ values, onChange, workbook, onEditar }: {
  values: Record<string, string> | null;
  onChange: (field: string, value: string) => void;
  workbook: XlsformEditorWorkbook | null;
  onEditar: (mutar: (draft: XlsformEditorWorkbook) => void) => void;
}) {
  return (
    <>
      <section className="xfh-caja" data-qa-geometry-group="xlsform/ficha-bloques" data-qa-geometry-contract="intrinsic">
        <header className="xfh-cab is-simple">
          <div className="xfh-cab__txt">
            <span className="xfh-cab__tipo is-fijo">Ajustes del formulario</span>
            <span className="xfh-cab__pos">{values?.form_title || "Sin título"}</span>
          </div>
        </header>
        <BloqueFicha titulo="Identidad">
          <div className="xfh-dos-campos">
            <CampoTexto etiqueta="Título del formulario" valor={values?.form_title ?? ""} onCambio={(v) => onChange("form_title", v)} />
            <CampoTexto etiqueta="ID interno" valor={values?.form_id ?? ""} onCambio={(v) => onChange("form_id", v)} />
          </div>
          <div className="xfh-dos-campos">
            <CampoTexto etiqueta="Versión" valor={values?.version ?? ""} placeholder="1" onCambio={(v) => onChange("version", v)} />
            <CampoTexto etiqueta="Idioma por defecto" valor={values?.default_language ?? "es"} onCambio={(v) => onChange("default_language", v)} />
          </div>
        </BloqueFicha>
      </section>
      <section className="xfh-caja xfh-ajustes-calidad">
        <CalidadCampo workbook={workbook} onEditar={onEditar} />
      </section>
    </>
  );
}
