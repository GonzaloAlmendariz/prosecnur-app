// =============================================================================
// shell/AddFormCard.tsx — tarjeta "＋ Nuevo formulario" del espacio de trabajo
// =============================================================================
// La vía de creación dentro de la grilla del hub. Es una sola celda, del mismo
// tamaño que una tarjeta de formulario: colapsada muestra "＋ Nuevo
// formulario"; al pulsarla se expande in situ y revela las tres vías.
//
// Antes tenía dos variantes: `hero` (biblioteca vacía) ocupaba la fila entera,
// nacía expandida y titulaba "Crea tu primer formulario", mientras `tile`
// (biblioteca poblada) era un slot compacto. Esa diferencia era la mitad del
// problema del "otro homepage": al pasar de cero a un formulario, la superficie
// se reconstruía. Ahora la celda es la misma con 0 o con 5 formularios.
//
// No pinta contadores: mientras hay cupo el tono es de invitación, no de aviso.
// El bloqueo al llegar a 6 lo resuelve FormsLibrary quitando esta tarjeta.
// =============================================================================

import { useState } from "react";
import { Plus, X } from "../../../vendor/lucide-react";
import { NewFormActions } from "./NewFormActions";

export type AddFormCardProps = {
  onNewBlank: () => void;
  onImportXls: () => void;
  onImportSurveyMonkey: () => void;
};

export function AddFormCard({
  onNewBlank,
  onImportXls,
  onImportSurveyMonkey,
}: AddFormCardProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className="pulso-xf-home-add pulso-xf-home-add--tile"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        title="Crear un formulario nuevo"
      >
        <span className="pulso-xf-home-add-plus" aria-hidden="true">
          <Plus size={22} />
        </span>
        <span className="pulso-xf-home-add-label">Nuevo formulario</span>
        <span className="pulso-xf-home-add-hint">
          Empieza de cero o importa uno existente
        </span>
      </button>
    );
  }

  return (
    <div className="pulso-xf-home-add pulso-xf-home-add--expanded">
      <div className="pulso-xf-home-add-head">
        <div className="pulso-xf-home-add-head-text">
          <span className="pulso-xf-home-add-eyebrow" aria-hidden="true">
            <Plus size={13} /> Nuevo formulario
          </span>
          <h3 className="pulso-xf-home-add-title">¿Cómo quieres empezar?</h3>
        </div>
        <button
          type="button"
          className="pulso-xf-home-add-close"
          onClick={() => setOpen(false)}
          aria-label="Cerrar las opciones de creación"
          title="Cerrar"
        >
          <X size={16} />
        </button>
      </div>
      <NewFormActions
        onNewBlank={onNewBlank}
        onImportXls={onImportXls}
        onImportSurveyMonkey={onImportSurveyMonkey}
      />
    </div>
  );
}
