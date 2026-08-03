import { CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";
import type { CalcMuestraAulasMethodComparison } from "../../../../api/client";
import { rowsFrom } from "../../sharedCore";

export function classroomRiskRows(
  risks: NonNullable<CalcMuestraAulasMethodComparison["risk_flags"]> | unknown,
  audited: boolean,
) {
  const seen = new Set<string>();
  const rows = rowsFrom<Record<string, unknown>>(risks).filter((risk) => {
    const key = `${String(risk.severity ?? "")}|${String(risk.title ?? "")}|${String(risk.detail ?? "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (rows.length) return rows.slice(0, 8);
  return audited
    ? [{ code: "sin_alertas", severity: "ok", title: "Sin alertas críticas", detail: "La auditoría interna no reporta riesgos activos para el cálculo vigente." }]
    : [{ code: "auditoria_pendiente", severity: "media", title: "Auditoría pendiente", detail: "Compara métodos con el objetivo y el marco vigentes para evaluar riesgos." }];
}

export function ClassroomRiskList({
  risks,
  audited,
}: {
  risks?: NonNullable<CalcMuestraAulasMethodComparison["risk_flags"]> | unknown;
  audited: boolean;
}) {
  const visible = classroomRiskRows(risks, audited);
  const severityIcon = (severity: string) => {
    if (severity === "alta") return TriangleAlert;
    if (severity === "ok" || severity === "baja") return CheckCircle2;
    return CircleAlert;
  };
  return (
    <div className="cmv2-classroom-risk-list">
      <div className="cmv2-subhead"><strong>Riesgos</strong></div>
      {visible.map((risk, index) => {
        const severity = String(risk.severity ?? "media");
        const Icon = severityIcon(severity);
        const detail = String(risk.detail ?? "Revisa la auditoría técnica del selector.");
        const esTecnico = /\b[A-Za-z][\w.]*::[\w.]+/.test(detail);
        return (
          <div key={`${String(risk.code ?? "riesgo")}-${index}`} className={`is-${severity}`}>
            <small><Icon size={12} aria-hidden="true" />{severity}</small>
            <strong>{String(risk.title ?? "Alerta metodológica")}</strong>
            {esTecnico ? (
              <>
                <span>El motor usó una implementación alternativa equivalente para esta corrida.</span>
                {/* ADR 0057 · Rotular el cajón «Detalle técnico» no dice qué
                    hay dentro: es la etiqueta que obliga a abrir para saber si
                    importa. Lo que contiene es el mensaje literal del motor, y
                    eso sí se puede nombrar.

                    F102 · **El único `<details>` que sobrevive al barrido**, y
                    a propósito. La regla es que no se esconde el trabajo ni la
                    evidencia con la que se decide; esto no es ninguna de las
                    dos: es una traza del motor que no cambia ninguna decisión
                    del estudio. El guard de `aulas` lo declara por nombre, para
                    que este permiso sea explícito y no un olvido.

                    La etiqueta sí sobraba: «Ver el mensaje…» escribe la
                    afordancia en el hueco donde cabía el nombre de la cosa. */}
                <details className="cmv2-aviso-tecnico">
                  <summary>Mensaje del motor</summary>
                  <code>{detail}</code>
                </details>
              </>
            ) : <span>{detail}</span>}
          </div>
        );
      })}
    </div>
  );
}
