// La acción principal de Frecuencias y Cruces, en la cabecera: genera el Excel
// con la config guardada. Se deshabilita mientras se genera y cuando hay un
// motivo (ajustes sin guardar, base sin preparar, archivo sin tablas); el
// motivo se lee en el panel Archivo y el botón lo nombra (`aria-describedby`).

import { PulsoButton } from "../../../components/PulsoButton";
import { FileSpreadsheet } from "../../../vendor/lucide-react";

export function BotonGenerar({ generando, bloqueo, idDelMotivo, onGenerar }: {
  generando: boolean;
  /** Por qué no se puede generar todavía. Sin motivo, el botón está activo. */
  bloqueo?: string;
  /** El `id` del texto del motivo, en el panel Archivo. */
  idDelMotivo: string;
  onGenerar: () => void;
}) {
  return (
    <PulsoButton
      variant="primary"
      onClick={onGenerar}
      disabled={generando || Boolean(bloqueo)}
      aria-describedby={bloqueo ? idDelMotivo : undefined}
      title={bloqueo}
    >
      <FileSpreadsheet size={15} aria-hidden="true" />
      Generar Excel
    </PulsoButton>
  );
}
