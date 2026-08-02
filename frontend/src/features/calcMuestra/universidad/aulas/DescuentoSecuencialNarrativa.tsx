import type { CalcMuestraAulasSelection } from "../../../../api/client";
import { ArrowRight } from "../../../../vendor/lucide-react";
import { fmtInt } from "../../sharedCore";
import { buildDiscountNarrative } from "./descuentoSecuencialNarrativaModel";
import "./descuentoSecuencialNarrativa.css";

function valueText(value: number | null): string {
  return value == null ? "—" : fmtInt(value);
}

export function DescuentoSecuencialNarrativa({
  selection,
  rows,
}: {
  selection: CalcMuestraAulasSelection | null;
  rows: Array<Record<string, unknown>>;
}) {
  const narrative = buildDiscountNarrative(selection, rows);
  if (!narrative) return null;
  const sequential = narrative.mode === "sequential";
  return (
    <div className="cmv2-discount-narrative">
      <div className="cmv2-discount-narrative-intro">
        <strong>{sequential ? "Así cambió el sorteo, paso a paso" : "Auditoría posterior, aula por aula"}</strong>
        <span>
          {sequential
            ? "Cada CH descuenta sus alumnos antes de ponderar la siguiente candidata."
            : "Estos valores se calcularon después de cerrar la selección: describen aporte, pero no causaron el sorteo."}
        </span>
      </div>
      <details open={narrative.steps.length <= 8}>
        <summary>{sequential ? "Recorrer" : "Revisar"} {fmtInt(narrative.steps.length)} {narrative.steps.length === 1 ? "paso" : "pasos"}</summary>
        <ol
          className="cmv2-discount-step-list"
          data-mode={narrative.mode}
          data-qa-geometry-group="aulas-descuento-pasos"
          data-qa-geometry-contract="equal"
        >
          {narrative.steps.map((step) => (
            <li key={`${step.code}-${step.step}`} data-qa-geometry-member>
              <div>
                <small>{sequential ? `Paso ${fmtInt(step.step)} del sorteo` : `Auditoría ${fmtInt(step.step)} post hoc`}</small>
                <strong>{step.code} · {step.label}</strong>
                {step.faculty && <span>{step.faculty}</span>}
              </div>
              <div className="cmv2-discount-step-equation" aria-label={`${valueText(step.bruto)} elegibles brutos, ${valueText(step.yaCubiertos)} ya cubiertos, ${valueText(step.neto)} elegibles netos, ${valueText(step.aporteNeto)} de aporte neto`}>
                <span><small>bruto</small><b>{valueText(step.bruto)}</b></span>
                <ArrowRight size={12} aria-hidden="true" />
                <span><small>ya cubiertos</small><b>{valueText(step.yaCubiertos)}</b></span>
                <ArrowRight size={12} aria-hidden="true" />
                <span><small>neto</small><b>{valueText(step.neto)}</b></span>
                <ArrowRight size={12} aria-hidden="true" />
                <span><small>aporte</small><b>{valueText(step.aporteNeto)}</b></span>
              </div>
              <p>
                {sequential
                  ? "Este aporte neto quedó disponible para decidir el paso siguiente."
                  : "Lectura posterior: no alteró probabilidades, calibración ni orden de selección."}
              </p>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
