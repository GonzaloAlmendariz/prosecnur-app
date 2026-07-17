/**
 * Vista POR FACULTAD del criterio de tipo de sesión (reunión con el asesor
 * muestral §4): una fila por facultad con la mini-distribución de sus tipos
 * (CH del catálogo `por_facultad` + elegibles del Explorador) y el estado de
 * la decisión («Hereda el global» / «Propia»). Al expandir una facultad, los
 * mismos toggles de tipos pero de ESA facultad; la edición compila a
 * `exceptions[facKey] = { categories, op: "replace" }` y respeta el flujo
 * borrador→confirmar de la tarjeta (todo pasa por `onSel`).
 *
 * Presentacional: la lógica vive en tipoSesionModel.ts (testeada). Los avisos
 * (trampa del taller, agrupamiento DTI) usan la voz única AvisoModulo y las
 * sugerencias de la reunión NUNCA se auto-aplican (botón «usar» por facultad).
 */
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Compass, Lightbulb } from "lucide-react";
import type {
  CalcMuestraAulasExploracion,
  CalcMuestraAulasParticularidadSessionType,
  CalcMuestraSessionTypeImpacto,
  CriterioSeleccion,
  CriterioVariable,
} from "../../../../api/client";
import { fmtInt } from "../../sharedCore";
import { AvisoModulo } from "../shared/AvisoModulo";
import { UNIVERSITY_SESSION_TYPE_SUGERENCIAS } from "../shared/constants";
import type { FacultadRef } from "./facultades";
import { FacultadCategoriaToggles } from "./FacultadCategoriaToggles";
import {
  aplicarSugerencia,
  avisosImpacto,
  exceptuarTipoEnFacultad,
  filasPorFacultad,
  senalAgrupamientoDti,
  sugerenciaAplicada,
  sugerenciaParaFacultad,
  tipoActivoEnFacultad,
  type FilaFacultad,
} from "./tipoSesionModel";

/** "A", "A y B", "A, B y C" — listado natural en español. */
function listar(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** Mini-distribución de tipos de una facultad: barra apilada proporcional al CH. */
function MiniDistribucion({ fila }: { fila: FilaFacultad }) {
  if (fila.chTotal <= 0) return <span className="cmv2-crit-tsf-bar-empty">sin distribución</span>;
  const segmentos = fila.tipos.filter((t) => (t.ch ?? 0) > 0);
  return (
    <span className="cmv2-crit-tsf-bar" role="img" aria-label={`Distribución de tipos de ${fila.facLabel}`}>
      {segmentos.map((t) => (
        <i
          key={t.key}
          data-activo={t.activo ? "true" : "false"}
          style={{ width: `${((t.ch ?? 0) / fila.chTotal) * 100}%` }}
          title={`${t.label}: ${fmtInt(t.ch ?? 0)} CH${t.elegibles != null ? ` · ${fmtInt(t.elegibles)} elegibles` : ""}${t.activo ? "" : " · excluido aquí"}`}
        />
      ))}
    </span>
  );
}

export function TipoSesionPorFacultad({
  variable,
  sel,
  facultades,
  onSel,
  exploracion,
  impacto,
  sessionTypeDominante,
  onVerExplorador,
}: {
  variable: CriterioVariable;
  sel: CriterioSeleccion;
  facultades: FacultadRef[];
  /** Patchea la selección de la variable (pasa por el borrador confirmable de la tab). */
  onSel: (next: CriterioSeleccion) => void;
  /** Radiografía del marco (elegibles por tipo×facultad); null sin marco construido. */
  exploracion?: CalcMuestraAulasExploracion | null;
  /** Impacto de tipos excluidos por facultad; null si el marco no lo trae. */
  impacto?: CalcMuestraSessionTypeImpacto | null;
  /** Señal de agrupamiento detectada por el marco (particularidades). */
  sessionTypeDominante?: CalcMuestraAulasParticularidadSessionType | null;
  /** Navega a la pestaña Explorador (marco-explorador); sin callback no hay link. */
  onVerExplorador?: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [facAbierta, setFacAbierta] = useState<string | null>(null);

  if (!facultades.length) return null;

  const filas = filasPorFacultad({ variable, sel, facultades, exploracion });
  const avisos = avisosImpacto(impacto, facultades);
  const dti = senalAgrupamientoDti(variable, sessionTypeDominante);
  const propias = filas.filter((f) => f.decision === "propia").length;

  return (
    <div className="cmv2-crit-tsf">
      {dti ? (
        <AvisoModulo tone="info" compact role="note" className="cmv2-crit-tsf-aviso">
          Tu base trae el tipo de curso <strong>agrupado por DTI</strong> («{dti.categoria}»): con esta base no se
          puede separar teórico-práctico de teórico-laboratorio. La solicitud DTI 2026 (botón en Fuentes) pide el
          dato desagregado.
        </AvisoModulo>
      ) : null}

      {avisos.map((aviso) => {
        const pendientes = aviso.perdidoEn.filter(
          (p) => p.facKey != null && !tipoActivoEnFacultad(variable, sel, p.facKey, aviso.tipo),
        );
        return (
          <AvisoModulo
            key={aviso.tipo}
            tone="warn"
            className="cmv2-crit-tsf-aviso"
            title={`${aviso.tipo} está excluido en general${
              aviso.exceptuadoEn.length ? ` y solo exceptuado en ${listar(aviso.exceptuadoEn)}` : ""
            }.`}
            actions={
              pendientes.length ? (
                <div className="cmv2-crit-tsf-aviso-actions">
                  {pendientes.map((p) => (
                    <button
                      key={p.facultad}
                      type="button"
                      className="cmv2-crit-sug-btn"
                      onClick={() => onSel(exceptuarTipoEnFacultad(variable, sel, p.facKey ?? "", aviso.tipo))}
                    >
                      Exceptuar también en {p.facultad}
                    </button>
                  ))}
                </div>
              ) : undefined
            }
          >
            {aviso.perdidoEn
              .map(
                (p) =>
                  `${p.facultad} pierde ${fmtInt(p.ch)} CH${p.elegibles > 0 ? ` (~${fmtInt(p.elegibles)} elegibles)` : ""}`,
              )
              .join("; ")}
            . ¿Es intencional?
            {pendientes.length === 0
              ? " En el borrador ya está exceptuado donde hacía falta — confirma y recalcula el marco."
              : ""}
          </AvisoModulo>
        );
      })}

      <button
        type="button"
        className="cmv2-crit-exc-toggle"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        Por facultad{propias ? ` (${propias} con decisión propia)` : ""}
      </button>

      {abierto && (
        <div className="cmv2-crit-tsf-tabla" role="table" aria-label="Tipos de sesión por facultad">
          {filas.map((fila) => {
            const expandida = facAbierta === fila.facKey;
            const activos = fila.tipos.filter((t) => t.activo);
            const sug = sugerenciaParaFacultad(variable, fila.facLabel, UNIVERSITY_SESSION_TYPE_SUGERENCIAS);
            const sugAlDia = sug ? sugerenciaAplicada(variable, sel, fila.facKey, sug) : false;
            return (
              <Fragment key={fila.facKey}>
                <div className="cmv2-crit-tsf-row" role="row" data-decision={fila.decision} data-expanded={expandida}>
                  <button
                    type="button"
                    className="cmv2-crit-tsf-fac"
                    aria-expanded={expandida}
                    onClick={() => setFacAbierta(expandida ? null : fila.facKey)}
                    title={fila.facLabel}
                  >
                    {expandida ? (
                      <ChevronDown size={13} aria-hidden="true" />
                    ) : (
                      <ChevronRight size={13} aria-hidden="true" />
                    )}
                    <span className="cmv2-crit-tsf-fac-label">{fila.facLabel}</span>
                  </button>
                  <MiniDistribucion fila={fila} />
                  <span className="cmv2-crit-tsf-estado" data-decision={fila.decision}>
                    {fila.decision === "hereda"
                      ? "Hereda el global"
                      : `Propia: ${activos.length ? activos.map((t) => t.label).join(", ") : "ninguna categoría"}`}
                  </span>
                  {sug ? (
                    <span className="cmv2-crit-tsf-sug" title={sug.porque}>
                      <Lightbulb size={12} aria-hidden="true" />
                      <span className="cmv2-crit-tsf-sug-copy">
                        Sugerido: {sug.modo === "solo" ? "solo " : "incluir "}
                        {sug.labels.join(", ").toLocaleLowerCase("es")}
                      </span>
                      <button
                        type="button"
                        className="cmv2-crit-sug-btn"
                        disabled={sugAlDia}
                        title={sug.porque}
                        onClick={() => onSel(aplicarSugerencia(variable, sel, fila.facKey, sug))}
                      >
                        {sugAlDia ? "Al día" : "Usar"}
                      </button>
                    </span>
                  ) : null}
                </div>
                {expandida ? (
                  <FacultadCategoriaToggles
                    fila={fila}
                    variable={variable}
                    sel={sel}
                    onSel={onSel}
                    ariaLabel={`Tipos de sesión en ${fila.facLabel}`}
                  />
                ) : null}
              </Fragment>
            );
          })}
        </div>
      )}

      {onVerExplorador ? (
        <button type="button" className="cmv2-crit-tsf-link" onClick={onVerExplorador}>
          <Compass size={13} aria-hidden="true" />
          Ver radiografía por facultad
        </button>
      ) : null}
    </div>
  );
}
