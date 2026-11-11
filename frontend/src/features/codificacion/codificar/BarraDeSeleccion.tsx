import { forwardRef } from "react";
import type { MarcaPrevia } from "../../../api/codificacion";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo } from "../../../lib/formatoNumero";
import { X } from "../../../vendor/lucide-react";
import type { CodigoTabla } from "../tabla/tablaCodificarModelo";
import { AsignarACodigo, type AsignarACodigoRef } from "./AsignarACodigo";

export type BarraDeSeleccionProps = {
  seleccionadas: number;
  /** Cuántas de las seleccionadas tienen algún código: sin ninguna, no hay código que quitar. */
  conCodigo: number;
  /** Las cifras del número de código que se están escribiendo, si hay alguna. */
  cifras: string;
  /** Lo que no se pudo hacer con lo tecleado ("Ningún código lleva el número 7"). */
  aviso: string;
  codigos: readonly CodigoTabla[];
  comunes: readonly CodigoTabla[];
  marcas: readonly MarcaPrevia[];
  veces: number;
  onAsignar: (grupoId: string) => void;
  onCrear: (nombre: string) => void;
  onQuitar: () => void;
  onSoltar: () => void;
  /** El foco vuelve a la lista de respuestas. */
  onSalir: () => void;
};

/**
 * Acciones sobre las respuestas seleccionadas: asignarlas a un código o quitarles el que tienen.
 * Flota sobre el pie de la lista y no empuja las filas.
 */
export const BarraDeSeleccion = forwardRef<AsignarACodigoRef, BarraDeSeleccionProps>(function BarraDeSeleccion(
  { seleccionadas, conCodigo, cifras, aviso, codigos, comunes, marcas, veces, onAsignar, onCrear, onQuitar, onSoltar, onSalir },
  ref,
) {
  return (
    <div className="pulso-cc-seleccion" role="toolbar" aria-label="Respuestas seleccionadas">
      <span className="pulso-cc-seleccion-n" role="status">
        <strong>{formatoConteo(seleccionadas)}</strong> {seleccionadas === 1 ? "seleccionada" : "seleccionadas"}
      </span>
      {cifras ? (
        <span className="pulso-cc-seleccion-cifras">
          Código <kbd>{cifras}</kbd>
        </span>
      ) : aviso ? (
        <span className="pulso-cc-seleccion-aviso" role="status">
          {aviso}
        </span>
      ) : null}
      <AsignarACodigo
        ref={ref}
        codigos={codigos}
        comunes={comunes}
        marcas={marcas}
        veces={veces}
        seleccionadas={seleccionadas}
        onAsignar={onAsignar}
        onCrear={onCrear}
        onSalir={onSalir}
      />
      <PulsoButton variant="ghost" size="sm" disabled={conCodigo === 0} onClick={onQuitar}>
        Quitar código
      </PulsoButton>
      <PulsoButton variant="icon" size="sm" aria-label="Soltar la selección" title="Soltar la selección (Esc)" onClick={onSoltar}>
        <X aria-hidden="true" />
      </PulsoButton>
    </div>
  );
});
