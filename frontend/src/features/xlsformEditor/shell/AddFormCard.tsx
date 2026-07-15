// =============================================================================
// shell/AddFormCard.tsx — tarjeta "＋ Nuevo formulario" del espacio de trabajo
// =============================================================================
// La vía de creación dentro de la grilla de slots del hub. Dos modos:
//   - `hero` (biblioteca vacía): protagonista, siempre expandida, ocupa la fila
//     completa y muestra las 3 vías (NewFormActions en tarjetas) como el primer
//     paso obvio del proyecto.
//   - `tile` (biblioteca poblada, 1..5 formularios): un slot compacto dashed
//     "＋ Nuevo formulario"; al pulsarlo se expande inline a la fila completa y
//     revela las 3 vías en filas compactas. Cerrar vuelve al slot compacto.
//
// No pinta contadores: mientras hay cupo el tono es de invitación, no de aviso.
// El bloqueo al llegar a 6 lo resuelve FormsLibrary quitando esta tarjeta.
// =============================================================================

import { useState } from "react";
import { Plus, X } from "../../../vendor/lucide-react";
import { NewFormActions } from "./NewFormActions";

export type AddFormCardProps = {
  variant: "hero" | "tile";
  onNewBlank: () => void;
  onImportXls: () => void;
  onImportSurveyMonkey: () => void;
};

export function AddFormCard({
  variant,
  onNewBlank,
  onImportXls,
  onImportSurveyMonkey,
}: AddFormCardProps) {
  // El hero nace expandido; el tile arranca colapsado y se abre bajo demanda.
  const [open, setOpen] = useState(variant === "hero");
  const expanded = variant === "hero" || open;

  if (!expanded) {
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

  const isHero = variant === "hero";

  return (
    <div
      className={`pulso-xf-home-add pulso-xf-home-add--expanded${
        isHero ? " pulso-xf-home-add--hero" : ""
      }`}
    >
      <div className="pulso-xf-home-add-head">
        <div className="pulso-xf-home-add-head-text">
          <span className="pulso-xf-home-add-eyebrow" aria-hidden="true">
            <Plus size={13} /> Nuevo formulario
          </span>
          <h3 className="pulso-xf-home-add-title">
            {isHero ? "Crea tu primer formulario" : "¿Cómo quieres empezar?"}
          </h3>
          <p className="pulso-xf-home-add-copy">
            Elige un punto de partida. Puedes tener hasta seis formularios en
            paralelo dentro de este proyecto.
          </p>
        </div>
        {!isHero && (
          <button
            type="button"
            className="pulso-xf-home-add-close"
            onClick={() => setOpen(false)}
            aria-label="Cerrar las opciones de creación"
            title="Cerrar"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <NewFormActions
        variant={isHero ? "cards" : "menu"}
        onNewBlank={onNewBlank}
        onImportXls={onImportXls}
        onImportSurveyMonkey={onImportSurveyMonkey}
      />
    </div>
  );
}
