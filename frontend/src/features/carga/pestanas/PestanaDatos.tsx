import type { EstudioBase } from "../../../api/client";
import { CargaBaseSheetPane } from "./HojaBaseCarga";

export type PestanaDatosProps = {
  varias: boolean;
  todoListo: boolean;
  ocupado: string;
  error: string;
  /** Todas las bases del estudio, repeats incluidos. Con una base no se usa. */
  bases: EstudioBase[];
  baseElegida: string;
  onCambiarBase: (nombre: string) => void;
};

/** Datos: la hoja de la base cargada, antes de validación, limpieza y codificación. */
export function PestanaDatos({
  varias,
  todoListo,
  ocupado,
  error,
  bases,
  baseElegida,
  onCambiarBase,
}: PestanaDatosProps) {
  return (
    <CargaBaseSheetPane
      isMultiBase={varias}
      allReady={todoListo}
      busy={ocupado}
      error={error}
      baseOptions={varias ? bases : []}
      selectedBase={varias ? baseElegida : ""}
      onSelectedBaseChange={onCambiarBase}
    />
  );
}
