/**
 * Detalle por-facultad de un criterio de curso-horario de tipo set (flat o
 * jerárquico): toggles de las categorías de ESA facultad con su CH/elegibles y
 * el botón «Volver a heredar el global». Extraído de TipoSesionPorFacultad para
 * reusarse tanto ahí (tabla por facultad del tipo de sesión) como en la vista
 * integrada facultad-primaria (decisión de session/condition/teacher junto a la
 * radiografía). Presentacional: la compilación a `exceptions[facKey]` (op
 * "replace") vive en tipoSesionModel.ts (testeada). Toda edición pasa por `onSel`
 * (respeta el borrador→confirmar de la superficie que lo embebe).
 */
import { useState } from "react";
import type { CriterioSeleccion, CriterioVariable } from "../../../../api/client";
import { fmtInt, fmtPct } from "../../sharedCore";
import { Switch } from "./Switch";
import { heredarFacultad, toggleTipoEnFacultad, type FilaFacultad } from "./tipoSesionModel";

/** A partir de tantas categorías se pliega el ruido (0 CH aquí y no activo). */
const UMBRAL_PLEGADO = 8;

export function FacultadCategoriaToggles({
  fila,
  variable,
  sel,
  onSel,
  ariaLabel,
  sinBarra = false,
}: {
  /** Fila con las categorías de la facultad (CH/elegibles + activo efectivo). */
  fila: FilaFacultad;
  variable: CriterioVariable;
  sel: CriterioSeleccion;
  /** Emite la selección siguiente (compila a op "replace" de la facultad). */
  onSel: (next: CriterioSeleccion) => void;
  ariaLabel: string;
  /** Oculta la mini-barra de proporción (cuando el criterio ya muestra su
   *  distribución en una tabla propia, p.ej. tipo de sesión): evita el % doble. */
  sinBarra?: boolean;
}) {
  const [verTodas, setVerTodas] = useState(false);
  // Domar listas largas (p.ej. condición del curso trae ~52 valores DTI, casi
  // todos ruido): muestra las que tienen CH en la facultad (o están activas) y
  // pliega el resto. Si el catálogo no trae distribución, no pliega nada.
  const hayDistribucion = fila.tipos.some((t) => t.ch != null);
  const relevantes = hayDistribucion
    ? fila.tipos.filter((t) => (t.ch ?? 0) > 0 || t.activo)
    : fila.tipos;
  const ocultasN = fila.tipos.length - relevantes.length;
  const plegable = hayDistribucion && fila.tipos.length >= UMBRAL_PLEGADO && ocultasN > 0;
  const visibles = plegable && !verTodas ? relevantes : fila.tipos;
  return (
    <div className="cmv2-crit-tsf-detalle" role="group" aria-label={ariaLabel}>
      <ul className="cmv2-crit-tsf-tipos">
        {visibles.map((t) => {
          const pct = fila.chTotal > 0 && t.ch != null ? t.ch / fila.chTotal : null;
          return (
            <li key={t.key} className="cmv2-crit-tsf-tipo" data-checked={t.activo}>
              <div className="cmv2-crit-item-main">
                <Switch
                  checked={t.activo}
                  ariaLabel={`${t.label} en ${fila.facLabel}`}
                  onToggle={() => onSel(toggleTipoEnFacultad(variable, sel, fila.facKey, t.key))}
                />
                <span className="cmv2-crit-item-label">{t.label}</span>
              </div>
              {!sinBarra && pct != null ? (
                <span className="cmv2-crit-item-share" title={`${fmtPct(pct)} de los CH de la facultad`}>
                  <span className="cmv2-crit-item-bar" aria-hidden="true">
                    <i style={{ width: `${Math.max(2, pct * 100)}%` }} />
                  </span>
                  <span className="cmv2-crit-item-pct">{fmtPct(pct)}</span>
                </span>
              ) : null}
              <span className="cmv2-crit-item-count">
                {t.ch != null ? (
                  <>
                    {fmtInt(t.ch)} <em>CH</em>
                  </>
                ) : (
                  <em>sin distribución</em>
                )}
                {t.elegibles != null ? (
                  <>
                    {" · "}
                    {fmtInt(t.elegibles)} <em>elegibles</em>
                  </>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      {plegable ? (
        <button
          type="button"
          className="cmv2-crit-tsf-vertodas"
          aria-expanded={verTodas}
          onClick={() => setVerTodas((v) => !v)}
        >
          {verTodas
            ? "Ver solo las que tienen cursos aquí"
            : `Ver todas (${fmtInt(ocultasN)} sin cursos en esta facultad)`}
        </button>
      ) : null}
      {fila.decision === "propia" ? (
        <button
          type="button"
          className="cmv2-crit-tsf-heredar"
          onClick={() => onSel(heredarFacultad(sel, fila.facKey))}
        >
          Volver a heredar el global
        </button>
      ) : (
        <p className="cmv2-crit-empty-note">
          Esta facultad hereda el set global de arriba; al tocar un tipo aquí creas su decisión propia.
        </p>
      )}
    </div>
  );
}
