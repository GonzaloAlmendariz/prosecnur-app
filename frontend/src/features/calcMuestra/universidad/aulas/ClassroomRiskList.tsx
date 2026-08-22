import { CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";
import type { CalcMuestraAulasMethodComparison } from "../../../../api/client";
import { rowsFrom } from "../../sharedCore";
import { traducirAvisoDelMotor } from "./avisosDelMotor";

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
  resumen = false,
  alcance,
  onVerDetalle,
}: {
  risks?: NonNullable<CalcMuestraAulasMethodComparison["risk_flags"]> | unknown;
  audited: boolean;
  /**
   * La lista completa vivía en Método, Simulación y Auditoría con el MISMO
   * contenido. Medido el 2026-08-22 sobre HSVG2026: cinco avisos, 613 px, una
   * pantalla entera de las 6,3 que mide Método, repetida tres veces. Gonzalo:
   * «hay como una cadena de riesgos gigante que no se termina de entender».
   *
   * En resumen sólo se dice cuántos hay y de qué gravedad, y se remite a
   * Auditoría, que es la pestaña cuyo tema SON los riesgos. No se ocultan: se
   * cuentan donde estorban y se detallan donde tocan.
   */
  resumen?: boolean;
  /**
   * Qué mira ESTA lista, porque no todas miran lo mismo.
   *
   * Método muestra los avisos que dejó el comparador; Simulación suma a esos
   * los que se derivan de las cifras de estabilidad. Medido en HSVG2026 el
   * 2026-08-22: 5 avisos en Método y 8 en Simulación, ambas listas tituladas
   * «Riesgos detectados». Al pasar de una pestaña a otra los riesgos parecían
   * haber crecido solos, sin que nada dijera que el alcance era distinto.
   */
  alcance?: string;
  onVerDetalle?: () => void;
}) {
  const visible = classroomRiskRows(risks, audited);
  if (resumen) {
    const reales = visible.filter((r) => String(r.severity ?? "") !== "ok");
    const altas = reales.filter((r) => String(r.severity ?? "") === "alta").length;
    return (
      <div className="cmv2-classroom-risk-resumen" data-severidad={altas > 0 ? "alta" : reales.length ? "media" : "ok"}>
        <div className="cmv2-subhead"><strong>{alcance ?? "Riesgos detectados"}</strong></div>
        <p>
          {!reales.length
            ? "La auditoría no reporta riesgos activos para el cálculo vigente."
            : altas > 0
              ? `${altas} de gravedad alta y ${reales.length - altas} de gravedad media.`
              : `${reales.length} ${reales.length === 1 ? "aviso" : "avisos"} de gravedad media, ninguno crítico.`}
        </p>
        {onVerDetalle && reales.length ? (
          <button type="button" className="cmv2-ghost" onClick={onVerDetalle}>
            Verlos en Auditoría
          </button>
        ) : null}
      </div>
    );
  }
  const severityIcon = (severity: string) => {
    if (severity === "alta") return TriangleAlert;
    if (severity === "ok" || severity === "baja") return CheckCircle2;
    return CircleAlert;
  };
  return (
    <div className="cmv2-classroom-risk-list">
      <div className="cmv2-subhead"><strong>{alcance ?? "Riesgos"}</strong></div>
      {visible.map((risk, index) => {
        const severity = String(risk.severity ?? "media");
        const Icon = severityIcon(severity);
        const detail = String(risk.detail ?? "Revisa la auditoría técnica del selector.");
        // La detección por `paquete::funcion` dejaba pasar el resto de la jerga
        // del motor: identificadores internos (`pi_design`) y castellano sin
        // tildes, que llegaban literales al usuario. Medido: 18 apariciones en
        // tres pestañas de Selección contra 0 en Cálculo.
        const aviso = traducirAvisoDelMotor(detail);
        return (
          <div key={`${String(risk.code ?? "riesgo")}-${index}`} className={`is-${severity}`}>
            <small><Icon size={12} aria-hidden="true" />{severity}</small>
            {/* El título traducido gana al del motor: mandaba dos avisos
                distintos bajo un mismo «Fallback metodológico», y dos cosas
                distintas con el mismo nombre se leen como una repetida. */}
            <strong>{aviso.titulo ?? String(risk.title ?? "Alerta metodológica")}</strong>
            {aviso.mostrarCrudo ? (
              <>
                <span>{aviso.resumen}</span>
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
                  {/* El motor concatena sus notas con « | »: partidas en lista
                      se pueden leer; en un parrafo eran un ladrillo. */}
                  {detail.includes(" | ") ? (
                    <code>
                      <ul className="cmv2-aviso-tecnico-lista">
                        {detail.split(" | ").map((nota, i) => (
                          <li key={i}>{nota}</li>
                        ))}
                      </ul>
                    </code>
                  ) : (
                    <code>{detail}</code>
                  )}
                </details>
              </>
            ) : <span>{aviso.resumen}</span>}
          </div>
        );
      })}
    </div>
  );
}
