// "Usar el formulario del editor": el formulario hecho en Formularios del mismo
// proyecto pasa a ser el formulario de la base sin exportarlo y volver a
// subirlo (ítem 23 del checklist de validación del practicante).
import { useEffect, useState } from "react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoSelect } from "../../../../components/PulsoSelect";
import type { FormularioDelEditor as Formulario } from "./formularioDelEditorModelo";
import "./formularioDelEditor.css";

export function FormularioDelEditor({
  formularios,
  ocupado,
  onUsar,
}: {
  formularios: readonly Formulario[];
  ocupado: boolean;
  onUsar: (formulario: Formulario) => void;
}) {
  const [elegido, setElegido] = useState<string | undefined>(formularios[0]?.id);
  useEffect(() => {
    if (!formularios.some((f) => f.id === elegido)) setElegido(formularios[0]?.id);
  }, [elegido, formularios]);
  if (!formularios.length) return null;
  const formulario = formularios.find((f) => f.id === elegido) ?? null;
  return (
    <div className="pulso-carga-editor" data-audit-ready="carga-formulario-del-editor">
      <span className="pulso-carga-editor-titulo">Formulario del editor</span>
      <div className="pulso-carga-editor-fila">
        {formularios.length > 1 ? (
          <PulsoSelect
            size="sm"
            ariaLabel="Formulario del editor"
            value={elegido}
            onValueChange={setElegido}
            options={formularios.map((f) => ({ value: f.id, label: f.rotulo, textValue: f.nombre }))}
            disabled={ocupado}
          />
        ) : (
          <span className="pulso-carga-editor-nombre">{formularios[0]!.rotulo}</span>
        )}
        <PulsoButton
          variant="secondary"
          size="sm"
          disabled={ocupado || !formulario}
          onClick={() => { if (formulario) onUsar(formulario); }}
        >
          Usar el formulario del editor
        </PulsoButton>
      </div>
      <small className="pulso-carga-editor-nota">
        Se usa como está guardado ahora; lo que cambies después en Formularios no llega a la base hasta volver a usarlo.
      </small>
    </div>
  );
}
