// Las acciones de una fila de "Revisar emparejado" (ADR 0135 §7): se confirma, se cambia o se descarta fila por fila; el
// único lote es «Confirmar los idénticos» (X6), en el pie del diálogo. Una fila de la matriz no se edita aquí: la matriz se edita en Carga, Equivalencias.
// Q4-5 (prueba con Arte, 1440x1000): «Confirmar · Cambiar · Descartar» no cabían en la columna y el tercero quedaba
// cortado. La acción principal de la fila conserva su texto; las secundarias van como íconos con nombre y tooltip (C4).

import { Link2Off, Pencil, X } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";
import type { FilaEmparejado } from "./modeloEmparejado";

type Props = {
  fila: FilaEmparejado;
  buscando: boolean;
  onConfirmar: () => void;
  onBuscar: () => void;
  onCancelar: () => void;
  onDescartar: () => void;
  onQuitar: () => void;
};

export function AccionesEmparejado({ fila, buscando, onConfirmar, onBuscar, onCancelar, onDescartar, onQuitar }: Props) {
  const de = `"${fila.pregunta.etiqueta}"`;
  if (fila.estado === "matriz") return null;
  if (buscando) {
    return (
      <span className="pulso-f6-emp-acciones" data-emp-acciones={fila.clave}>
        <PulsoButton variant="ghost" size="sm" onClick={onCancelar} aria-label={`Cancelar la búsqueda del par de ${de}`}>Cancelar</PulsoButton>
      </span>
    );
  }
  return (
    <span className="pulso-f6-emp-acciones" data-emp-acciones={fila.clave}>
      {fila.estado === "sugerido" && (
        <PulsoButton variant="secondary" size="sm" onClick={onConfirmar} aria-label={`Confirmar el par sugerido de ${de}`}>Confirmar</PulsoButton>
      )}
      {(fila.estado === "sugerido" || fila.estado === "confirmado") && (
        <PulsoButton variant="icon" size="sm" onClick={onBuscar} aria-label={`Cambiar el par de ${de}`} title="Cambiar el par">
          <Pencil size={13} aria-hidden="true" />
        </PulsoButton>
      )}
      {fila.estado === "sugerido" && (
        <PulsoButton variant="icon" size="sm" intent="remove" onClick={onDescartar} aria-label={`Descartar la sugerencia para ${de}`} title="Descartar la sugerencia">
          <X size={13} aria-hidden="true" />
        </PulsoButton>
      )}
      {fila.estado === "confirmado" && (
        <PulsoButton variant="icon" size="sm" intent="remove" onClick={onQuitar} aria-label={`Quitar de la lámina el par de ${de}`} title="Quitar de la lámina">
          <Link2Off size={13} aria-hidden="true" />
        </PulsoButton>
      )}
      {fila.estado === "sin_par" && (
        <PulsoButton variant="secondary" size="sm" onClick={onBuscar} aria-label={`Buscar el par de ${de}`}>Buscar par</PulsoButton>
      )}
    </span>
  );
}
