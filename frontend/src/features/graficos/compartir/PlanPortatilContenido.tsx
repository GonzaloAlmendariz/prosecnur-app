// Plan portátil (C11): exportar el paquete `.pulso-graficos.zip`, inspeccionar uno recibido y aplicarlo a las bases
// compatibles tras confirmar. Mismo cuerpo en el diálogo de Láminas y en el popover del Editor anterior.

import { useId, useRef } from "react";
import { Check, Download, Loader2, Upload } from "../../../vendor/lucide-react";
import { ConfirmacionCompartir, MotivoNoDisponible } from "./ConfirmacionCompartir";
import { textoConfirmarPlan } from "./textosConfirmacion";
import type { ControlCompartir } from "./useCompartirPlan";

export function PlanPortatilContenido({ control }: { control: ControlCompartir }) {
  const { estado, disponibilidad, basesElegidas } = control;
  const d = disponibilidad.planPortatil;
  const motivoId = useId();
  const archivoRef = useRef<HTMLInputElement>(null);
  const plan = estado.planInspeccionado;
  const nBases = basesElegidas.length;
  const describe = d.habilitado ? undefined : motivoId;

  return (
    <div className="pulso-gv2-share-package">
      <div className="pulso-gv2-share-package-head">
        <div className="pulso-gv2-share-package-copy">
          <strong>Plan portátil</strong>
          <small>
            Comparte composición, estilos y ajustes. Al aplicar, solo actualiza Gráficos y luego puedes regenerar PPT/Word.
          </small>
        </div>
        <div className="pulso-gv2-share-package-actions">
          <button type="button" onClick={() => void control.exportarPlan()} aria-describedby={describe}
            disabled={!d.habilitado || estado.ocupado === "exportar-plan"} className="pulso-gv2-share-action is-primary">
            {estado.ocupado === "exportar-plan" ? <Loader2 size={12} className="pulso-spin" aria-hidden="true" /> : <Download size={12} aria-hidden="true" />}
            Exportar plan
          </button>
          <button type="button" onClick={() => archivoRef.current?.click()} aria-describedby={describe}
            disabled={!d.habilitado || estado.ocupado === "inspeccionar-plan"}
            className={`pulso-gv2-share-action is-secondary${estado.ocupado === "inspeccionar-plan" ? " is-busy" : ""}`}>
            {estado.ocupado === "inspeccionar-plan" ? <Loader2 size={12} className="pulso-spin" aria-hidden="true" /> : <Upload size={12} aria-hidden="true" />}
            Importar plan
          </button>
          <input
            ref={archivoRef}
            type="file"
            hidden
            tabIndex={-1}
            aria-hidden="true"
            accept=".pulso-graficos.zip,.zip,application/zip"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void control.inspeccionarPlan(file);
            }}
          />
        </div>
      </div>

      {!d.habilitado && <MotivoNoDisponible id={motivoId} motivo={d.motivo} />}

      {d.habilitado && plan && (
        <>
          <div className="pulso-gv2-share-inspect-summary">
            <span>
              {plan.summary.n_compatible}/{plan.summary.n_bases} bases compatibles · {plan.manifest.n_slides} slides · {plan.summary.n_warnings} advertencias
            </span>
            <span>{plan.filename}</span>
          </div>

          <div className="pulso-gv2-share-plan-table" role="group" aria-label="Bases del paquete">
            <div className="pulso-gv2-share-plan-row is-head" aria-hidden="true">
              <span>Base</span>
              <span>Actualmente</span>
              <span>Después de aplicar</span>
              <span>Variables faltantes</span>
            </div>
            {plan.bases.map((base, index) => {
              const missing = base.impact.missing_variables;
              const checked = Boolean(estado.seleccionBases[base.base_name] && !base.blocking);
              return (
                <label
                  key={base.base_name}
                  className={`pulso-gv2-share-plan-row${base.blocking ? " is-blocked" : ""}${index === plan.bases.length - 1 ? " is-last" : ""}`}
                >
                  <span>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={base.blocking}
                      onChange={(e) => control.elegirBase(base.base_name, e.target.checked)}
                    />{" "}
                    <strong className="pulso-gv2-share-cell-title">{base.base_label || base.base_name}</strong>
                    <small className="pulso-gv2-share-cell-muted">{base.base_name}</small>
                  </span>
                  <span>
                    <strong className="pulso-gv2-share-cell-title">{base.current.n_slides} slides</strong>
                    <small className="pulso-gv2-share-cell-muted">Formulario y respuestas se conservan</small>
                  </span>
                  <span>
                    <strong className="pulso-gv2-share-cell-title">
                      {base.incoming.n_slides_applicable}/{base.incoming.n_slides_total} slides se conservarán
                    </strong>
                    <small className="pulso-gv2-share-cell-muted">
                      {missing.length > 0 ? "variables faltantes quedarán vacías" : "sin omisiones"}
                    </small>
                  </span>
                  <span>
                    {missing.length === 0 ? (
                      <small className="pulso-gv2-share-cell-muted">Todas las variables del plan están disponibles.</small>
                    ) : (
                      <small className="pulso-gv2-share-warning">
                        {missing.slice(0, 4).map((v) => `${v.code}: ${v.label}`).join(" · ")}
                        {missing.length > 4 ? ` · +${missing.length - 4}` : ""}
                      </small>
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="pulso-gv2-share-applybar">
            {estado.confirmarPlan ? (
              <ConfirmacionCompartir
                texto={textoConfirmarPlan(nBases)}
                ocupado={estado.ocupado === "aplicar-plan"}
                onConfirmar={() => void control.confirmarPlan()}
                onCancelar={control.cancelarConfirmacion}
              />
            ) : (
              <button type="button" onClick={control.pedirConfirmarPlan} disabled={nBases === 0}
                className="pulso-gv2-share-action is-primary">
                <Check size={12} aria-hidden="true" />
                Aplicar a {nBases} base{nBases === 1 ? "" : "s"} compatible{nBases === 1 ? "" : "s"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
