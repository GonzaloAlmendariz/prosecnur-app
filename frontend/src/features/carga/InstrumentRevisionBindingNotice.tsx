// =============================================================================
// InstrumentRevisionBindingNotice — el enlace de la base con su revisión
// =============================================================================
// Al cerrar la carga, el backend compara el hash canónico del XLSForm cargado
// contra las revisiones publicadas en el Editor y liga la base con la que
// coincida. De ese enlace dependen las decisiones que Validación y Analítica
// heredan del instrumento sellado.
//
// Sin esta superficie el resultado era invisible: el usuario publicaba en el
// Editor, cargaba un archivo distinto en Procesamiento y nunca se enteraba de
// que su revisión no estaba surtiendo efecto. Solo hablamos cuando hay algo
// que decir — si no hay revisiones publicadas en el proyecto, callamos.
// =============================================================================

import { ShieldCheck, TriangleAlert } from "../../vendor/lucide-react";
import type { EstudioBase } from "../../api/estudio";

export type InstrumentRevisionBindingNoticeProps = {
  /**
   * Estado del enlace. Se acepta suelto porque la única fuente disponible en
   * un estudio de una sola base es `session/state`: la página solo consulta
   * `/api/estudio` en modo multibase, que es justo donde esto no hace falta.
   */
  binding?: string | null;
  /** Alternativa cuando sí hay una base del estudio a mano (multibase). */
  base?: EstudioBase | null;
};

export function InstrumentRevisionBindingNotice({
  binding: bindingProp,
  base,
}: InstrumentRevisionBindingNoticeProps) {
  const binding = bindingProp ?? base?.instrument_revision_binding ?? null;

  // `none_published` es el estado normal de un proyecto que no usa el Editor:
  // no hay nada que explicar y un aviso sería ruido.
  if (!binding || binding === "none_published") return null;

  if (binding === "matched") {
    return (
      <div className="pulso-instrument-binding is-ok" role="note">
        <ShieldCheck size={13} aria-hidden="true" />
        <span>
          Este formulario corresponde a una revisión publicada en el Editor.
          Validación y Analítica aplicarán sus decisiones.
        </span>
      </div>
    );
  }

  const detalle = binding === "unreadable"
    ? "No pudimos leer este archivo como XLSForm para compararlo con las revisiones publicadas."
    : "El archivo cargado no coincide con ninguna revisión publicada en el Editor, así que sus decisiones no se aplicarán a esta base. Exporta el instrumento desde el Editor y cárgalo aquí, o publica una revisión del formulario que estás usando.";

  return (
    <div className="pulso-instrument-binding is-warn" role="note">
      <TriangleAlert size={13} aria-hidden="true" />
      <span>{detalle}</span>
    </div>
  );
}
