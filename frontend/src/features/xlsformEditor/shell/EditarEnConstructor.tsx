// =============================================================================
// shell/EditarEnConstructor.tsx — la única salida de una pestaña al Constructor
// =============================================================================
// Regla de las pestañas del editor (checklist exportación-formulario, ítem 50):
// un clic sobre un elemento nunca saca de la pestaña; abre su detalle ahí mismo.
// Ir al Constructor es siempre explícito, con este botón, al pie de la ficha o
// panel de detalle y alineado a la derecha en todas las pestañas.
//
// `discreto` es el enlace corto «Editar» de una lista densa (las preguntas de
// una sección desplegada en «Resumen»): misma acción, menos peso visual.
// `data-accion` marca la acción para el contrato de clics de las pestañas.
// =============================================================================

import { PencilLine } from "../../../vendor/lucide-react";
import { PulsoButton } from "../../../components/PulsoButton";
import "../styles/xf-detalle.css";

export const ACCION_EDITAR_EN_CONSTRUCTOR = "editar-en-constructor";

export type EditarEnConstructorProps = {
  onEditar: () => void;
  /** Qué se edita («la pregunta P12»): completa el nombre accesible del enlace discreto. */
  que?: string;
  /** `id` del título de la ficha: describe el botón para el lector de pantalla. */
  describedBy?: string;
  discreto?: boolean;
};

export function EditarEnConstructor({ onEditar, que, describedBy, discreto = false }: EditarEnConstructorProps) {
  if (discreto) {
    return (
      <button
        type="button"
        className="pulso-xf-editar-discreto"
        onClick={onEditar}
        aria-label={que ? `Editar ${que} en Constructor` : "Editar en Constructor"}
        title="Editar en Constructor"
        data-accion={ACCION_EDITAR_EN_CONSTRUCTOR}
      >
        <PencilLine size={12} aria-hidden="true" />
        Editar
      </button>
    );
  }
  return (
    <div className="pulso-xf-editar-pie">
      <PulsoButton
        variant="secondary"
        size="sm"
        className="pulso-xf-editar"
        onClick={onEditar}
        aria-describedby={describedBy}
        data-accion={ACCION_EDITAR_EN_CONSTRUCTOR}
      >
        <PencilLine size={14} aria-hidden="true" />
        Editar en Constructor
      </PulsoButton>
    </div>
  );
}
