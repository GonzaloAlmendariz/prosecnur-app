/**
 * Tarjeta ancha de radiografía de UNA facultad: distribución por tipo de sesión
 * con el mini-boxplot de elegibles por aula, mediana, badges (multi-facultad,
 * local externo, sin condición) y el desplegable por nivel. Extraída de
 * ExploradorAulasTab para consumirse también en la vista integrada
 * facultad-primaria de «Cursos-horario» sin duplicar. Presentación pura: la
 * lógica calculable vive en exploradorModel.ts.
 *
 * Dos modos:
 *  - `onSelect` presente ⇒ la cabecera es un botón que selecciona la facultad
 *    (drill-down del Explorador), con highlight `data-active`.
 *  - `onSelect` ausente ⇒ sin cabecera (la superficie que la embebe —el acordeón
 *    de la vista integrada— ya muestra nombre/elegibles). Solo badges + cuerpo.
 */
import { Layers3, MapPin } from "lucide-react";
import type { CalcMuestraAulasExploracionFacultad } from "../../../../api/client";
import { fmtDec, fmtInt, fmtPct } from "../../sharedCore";
import {
  escalaMaxElegibles,
  nivelDistribucion,
  shareSinCondicion,
  tipoSesionShares,
} from "./exploradorModel";
import { BoxplotElegibles } from "./BoxplotElegibles";

/** Tooltip honesto de la mediana por aula: `null` = NA del motor, no un 0. */
export function medianaTitle(mediana: number | null): string {
  return mediana != null
    ? `Mediana de elegibles del aula típica incluida de este grupo: ${fmtDec(mediana, 0)}. Es la cifra que dice si estas aulas cubren la cuota.`
    : "Sin CH incluidos con dato: un 0 mentiría que el aula típica está vacía.";
}

export function FacultadRadiografiaCard({
  fac,
  active,
  onSelect,
}: {
  fac: CalcMuestraAulasExploracionFacultad;
  /** Standalone (Explorador): resalta la tarjeta seleccionada. */
  active?: boolean;
  /** Standalone (Explorador): la cabecera selecciona la facultad. Sin callback
   *  no se renderiza cabecera (la embebe una superficie con su propio header). */
  onSelect?: () => void;
}) {
  const tipos = tipoSesionShares(fac);
  const niveles = nivelDistribucion(fac);
  const sinCondicion = shareSinCondicion(fac);
  // Escala compartida entre los tipos de esta facultad: los boxplots se leen
  // sobre el mismo eje y son comparables.
  const escalaMax = escalaMaxElegibles(tipos);
  const hayBoxplot = escalaMax > 0;
  const hayBadges = fac.n_multi_facultad > 0 || fac.n_local_externo > 0 || (sinCondicion != null && sinCondicion > 0);

  return (
    <article className="cmv2-explorador-card" data-active={active || undefined}>
      {onSelect ? (
        <button type="button" className="cmv2-explorador-card-head" aria-pressed={active} onClick={onSelect}>
          <span className="cmv2-explorador-card-title">
            <span className="cmv2-explorador-card-nombre">{fac.facultad}</span>
            <span className="cmv2-explorador-card-meta">
              {fmtInt(fac.ch_elegibles)} de {fmtInt(fac.ch_total)} CH elegibles
              {fac.est_aula_mediana != null ? ` · mediana ${fmtDec(fac.est_aula_mediana, 0)} por aula` : ""}
            </span>
          </span>
          <span className="cmv2-explorador-card-hero">
            {fmtInt(fac.elegibles_total)}
            <em>elegibles</em>
          </span>
        </button>
      ) : null}
      {hayBadges && (
        <div className="cmv2-explorador-card-badges">
          {fac.n_multi_facultad > 0 && (
            <span className="cmv2-explorador-badge" data-kind="multi">
              <Layers3 size={11} aria-hidden="true" />
              {fmtInt(fac.n_multi_facultad)} multi-facultad
            </span>
          )}
          {fac.n_local_externo > 0 && (
            <span className="cmv2-explorador-badge" data-kind="externo">
              <MapPin size={11} aria-hidden="true" />
              {fmtInt(fac.n_local_externo)} local externo
            </span>
          )}
          {sinCondicion != null && sinCondicion > 0 && (
            <span className="cmv2-explorador-badge" data-kind="sin-condicion">
              {fmtPct(sinCondicion)} sin condición
            </span>
          )}
        </div>
      )}
      {tipos.length > 0 ? (
        <div className="cmv2-explorador-card-body">
          <table
            className="cmv2-table cmv2-table--university cmv2-explorador-dist"
            aria-label={`Distribución de ${fac.facultad} por tipo de sesión`}
          >
            <thead>
              <tr>
                <th>Tipo</th>
                <th data-numeric="true">CH</th>
                <th data-numeric="true">Elegibles</th>
                <th data-numeric="true">Mediana</th>
                {hayBoxplot && <th className="cmv2-boxplot-col">Distribución</th>}
              </tr>
            </thead>
            <tbody>
              {tipos.map((tipo) => (
                <tr key={tipo.tipo}>
                  <td>
                    <span className="cmv2-explorador-dist-label">{tipo.tipo}</span>
                    <span className="cmv2-explorador-dist-track" aria-hidden="true">
                      <i style={{ width: `${Math.max(2, Math.round(tipo.share * 100))}%` }} />
                    </span>
                    <span className="cmv2-explorador-dist-pct">{fmtPct(tipo.share)}</span>
                  </td>
                  <td data-numeric="true">{fmtInt(tipo.ch)}</td>
                  <td data-numeric="true">{fmtInt(tipo.elegibles)}</td>
                  <td data-numeric="true" title={medianaTitle(tipo.medianaElegibles)}>
                    {tipo.medianaElegibles != null ? fmtDec(tipo.medianaElegibles, 0) : "—"}
                  </td>
                  {hayBoxplot && (
                    <td className="cmv2-boxplot-col">
                      {tipo.caja ? (
                        <BoxplotElegibles caja={tipo.caja} escalaMax={escalaMax} tipo={tipo.tipo} />
                      ) : (
                        <span className="cmv2-boxplot-vacio" title={medianaTitle(tipo.medianaElegibles)}>
                          —
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {hayBoxplot && (
            <p className="cmv2-boxplot-leyenda">
              <span className="cmv2-boxplot-leyenda-item">
                <span className="cmv2-boxplot-leyenda-caja" aria-hidden="true" />caja Q1–Q3
              </span>
              <span className="cmv2-boxplot-leyenda-item">
                <span className="cmv2-boxplot-leyenda-mediana" aria-hidden="true" />mediana
              </span>
              <span className="cmv2-boxplot-leyenda-item">
                <span className="cmv2-boxplot-leyenda-media" aria-hidden="true" />media
              </span>
              <span className="cmv2-boxplot-leyenda-nota">
                Misma escala entre tipos; la media a la derecha de la mediana señala aulas grandes que
                jalan el promedio.
              </span>
            </p>
          )}
          {niveles.length > 0 && (
            <details className="cmv2-explorador-niveles">
              <summary>Distribución por nivel del curso</summary>
              <table className="cmv2-table cmv2-table--university cmv2-explorador-dist">
                <thead>
                  <tr>
                    <th>Nivel</th>
                    <th data-numeric="true">CH</th>
                    <th data-numeric="true">Elegibles</th>
                    <th data-numeric="true">Mediana por aula</th>
                  </tr>
                </thead>
                <tbody>
                  {niveles.map((nivel) => (
                    <tr key={nivel.nivel}>
                      <td>
                        <span className="cmv2-explorador-dist-label">{nivel.nivel}</span>
                        <span className="cmv2-explorador-dist-pct">{fmtPct(nivel.share)}</span>
                      </td>
                      <td data-numeric="true">{fmtInt(nivel.ch)}</td>
                      <td data-numeric="true">{fmtInt(nivel.elegibles)}</td>
                      <td data-numeric="true" title={medianaTitle(nivel.medianaElegibles)}>
                        {nivel.medianaElegibles != null ? fmtDec(nivel.medianaElegibles, 0) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      ) : (
        <p className="cmv2-explorador-card-vacio">
          El contrato no trae distribución por tipo de sesión para esta facultad.
        </p>
      )}
    </article>
  );
}
