/** Paso 1, plan de reglas del formulario: controles del operativo, roles y acciones del plan. Salió de `tabs/InstrumentoTab.tsx` (rebanada V1 de P6). */
import { Download, FileText, ListTree, RefreshCcw, Upload } from "../../../vendor/lucide-react";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import InstrumentoOperationalControls from "../components/InstrumentoOperationalControls";
import RolesDeclarados from "../components/RolesDeclarados";
import { PasoDeValidacion } from "../components/PasoDeValidacion";
import type { InstrumentoEstado } from "../types";
import type { Instrumento } from "./useInstrumento";

export default function PlanDelFormulario({ inst, estado }: { inst: Instrumento; estado: InstrumentoEstado }) {
  const { baseNombre, busy, jobId, entregaPlan, entregaPaquete, cerrarPlan, cerrarPaquete, exportando, drill, operationalConfig, setOperationalConfig, operationalDirty, operationalValid, onBuildPlan, onExport, onMethodologyPackage, onImport } = inst;
  return (
    <PasoDeValidacion
      className={`pulso-instrumento-step--plan${estado.plan_construido ? "" : " is-setup"}`}
      paso={1}
      de={3}
      titulo="Plan de reglas"
      detalle={
        <>
          Obligatorias, saltos, rangos, cálculos y filtros declarados en el formulario{" "}
          <span className="pulso-vv2-tech">XLSForm</span>.
        </>
      }
      listo={estado.plan_construido}
      conteo={estado.plan_construido ? estado.n_reglas : null}
      rotuloConteo="reglas"
    >
      {!estado.plan_construido && (
        <div className="pulso-instrumento-setup-grid" aria-label="Secuencia de validación del instrumento">
          <div className="pulso-instrumento-setup-card is-active">
            <span>1</span>
            <strong>Leer XLSForm</strong>
            <small>Detecta preguntas obligatorias, saltos, rangos, cálculos y filtros.</small>
          </div>
          <div className="pulso-instrumento-setup-card">
            <span>2</span>
            <strong>Preparar auditoría</strong>
            <small>Genera un plan editable antes de tocar los datos.</small>
          </div>
          <div className="pulso-instrumento-setup-card">
            <span>3</span>
            <strong>Revisar casos</strong>
            <small>Ejecuta reglas, abre drill-downs y decide limpieza.</small>
          </div>
        </div>
      )}
      <InstrumentoOperationalControls
        baseNombre={baseNombre}
        value={operationalConfig}
        upstreamUniverse={estado.upstream_universe}
        dirty={operationalDirty}
        disabled={!!busy || !!jobId}
        onChange={setOperationalConfig}
      />
      {/* Los roles del estudio viven junto a los controles operativos porque
          comparten destino —`operational_config`— y el mismo botón de aplicar:
          declarar un rol sin reconstruir el plan no cambiaría nada. */}
      <RolesDeclarados
        baseNombre={baseNombre}
        value={operationalConfig}
        disabled={!!busy || !!jobId}
        onChange={setOperationalConfig}
      />
      <div className="pulso-instrumento-action-row">
        <button
          type="button"
          className="pulso-primary pulso-instrumento-action"
          onClick={() => void onBuildPlan()}
          disabled={!!busy || !!jobId || !operationalValid}
        >
          {estado.plan_construido ? <RefreshCcw size={12} /> : <ListTree size={12} />}
          {estado.plan_construido && operationalDirty
            ? "Aplicar y reconstruir plan"
            : estado.plan_construido
              ? "Reconstruir plan"
              : "Construir plan"}
        </button>
        {estado.plan_construido && (
          <>
            <button
              type="button"
              onClick={onExport}
              disabled={!!busy || exportando}
              className="pulso-instrumento-action"
            >
              <Download size={12} /> Exportar a Excel
            </button>
            <button
              type="button"
              onClick={onMethodologyPackage}
              disabled={!!busy || !!jobId || exportando}
              className="pulso-instrumento-action"
            >
              <FileText size={12} /> Paquete metodológico PDF + R
            </button>
            <label
              className={`pulso-instrumento-action pulso-instrumento-file-action${busy ? " is-busy" : ""}`}
            >
              <Upload size={12} /> Importar plan editado
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onImport(f);
                  e.target.value = "";
                }}
                style={{ display: "none" }}
              />
            </label>
          </>
        )}
      </div>
      {/* El plan y el paquete: cada uno en su contenedor, en bloque bajo la fila de acciones. */}
      <ContenedorEntregable estado={entregaPlan.estado} forma="bloque" onCerrar={cerrarPlan} />
      <ContenedorEntregable estado={entregaPaquete.estado} forma="bloque" onCerrar={cerrarPaquete} />
    </PasoDeValidacion>
  );
}
