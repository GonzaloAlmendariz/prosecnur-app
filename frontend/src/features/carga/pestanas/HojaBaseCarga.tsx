import { Table2 } from "../../../vendor/lucide-react";
import { apiCargaBaseSheet, type EstudioBase } from "../../../api/client";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { repeatContextFromBase } from "../../../lib/rosterExplorer";
import { ProcessingSheetViewer } from "../../procesamiento/ProcessingSheetViewer";
import { cargaBaseLabel, cargaBaseMeta } from "./cargaPaginaModelo";

export function CargaBaseSheetPane({
  isMultiBase = false,
  allReady,
  busy,
  error,
  baseOptions,
  selectedBase,
  onSelectedBaseChange,
}: {
  isMultiBase?: boolean;
  allReady: boolean;
  busy: string;
  error: string;
  baseOptions: readonly EstudioBase[];
  selectedBase: string;
  onSelectedBaseChange: (base: string) => void;
}) {
  const activeBase = baseOptions.find((base) => base.nombre === selectedBase) ?? baseOptions[0] ?? null;
  const hasMultiBase = isMultiBase && baseOptions.length > 0;
  const activeBaseHasData = Boolean(activeBase?.data_file_id);
  const enabled = isMultiBase ? hasMultiBase && activeBaseHasData && !busy && !error : allReady && !busy && !error;
  const disabledMessage = isMultiBase
    ? activeBase
      ? "La base seleccionada todavía no tiene respuestas cargadas."
      : "Agrega al menos una base para ver sus respuestas cargadas."
    : "Carga el formulario y las respuestas para ver la base completa.";
  const sourceLabel = isMultiBase && activeBase
    ? `Carga de ${cargaBaseLabel(activeBase)}, antes de validación, limpieza y codificación`
    : "Carga, antes de validación, limpieza y codificación";

  if (!enabled) {
    return (
      <section className="pulso-carga-base-shell" data-carga-surface="data" aria-label="Base de carga">
        <EstadoVacio
          tamano="normal"
          icono={<Table2 size={18} />}
          titulo="Aún no hay datos de Carga para explorar"
          descripcion={disabledMessage}
        />
      </section>
    );
  }

  return (
    <section className="pulso-carga-base-shell" data-carga-surface="data" aria-label="Base de carga">
      {isMultiBase && baseOptions.length > 1 && (
        <div className="pulso-carga-base-picker">
          <div>
            <strong>Base visible</strong>
            <span>{activeBase ? cargaBaseMeta(activeBase) : "Sin bases cargadas"}</span>
          </div>
          <label>
            <span className="pulso-sr-only">Seleccionar base de carga</span>
            <select
              value={activeBase?.nombre ?? ""}
              onChange={(event) => onSelectedBaseChange(event.target.value)}
              disabled={!baseOptions.length || !!busy}
            >
              {baseOptions.map((base) => (
                <option key={base.nombre} value={base.nombre}>
                  {cargaBaseLabel(base)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <ProcessingSheetViewer
        title="Base de carga"
        sourceLabel={sourceLabel}
        enabled={enabled}
        disabledMessage={disabledMessage}
        highlightCoding
        request={activeBase ? { base_nombre: activeBase.nombre } : undefined}
        repeat={repeatContextFromBase(activeBase)}
        load={apiCargaBaseSheet}
      />
    </section>
  );
}
