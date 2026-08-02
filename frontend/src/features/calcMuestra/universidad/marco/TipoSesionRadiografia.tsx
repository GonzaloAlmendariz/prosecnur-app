/**
 * Radiografía completa de `session_type` para una facultad. El contrato v1
 * llega calculado por R: este componente solo une por claves, ordena y formatea
 * filas. Frames anteriores conservan la tabla/boxplot legacy, rotulada como tal
 * y sin acreditar cuantiles, contraste total ni deltas que no existen.
 */
import type {
  CalcMuestraAulasCriterioRadiografiaAccion,
  CalcMuestraAulasCriteriosRadiografia,
  CalcMuestraAulasExploracionFacultad,
} from "../../../../api/client";
import { fmtDec, fmtInt, fmtSignedInt } from "../../sharedCore";
import {
  filasTipoSesionRadiografia,
  hayBoxplotElegibles,
  tipoSesionShares,
} from "./exploradorModel";
import { BoxplotElegibles } from "./BoxplotElegibles";
import "./tipoSesionRadiografia.css";

export type TipoSesionRadiografiaContexto = "ejecutado" | "editable";

const ACCION_LABEL: Record<CalcMuestraAulasCriterioRadiografiaAccion, string> = {
  restringir_a_categoria: "Restringir a esta categoría",
  agregar_categoria: "Agregar categoría",
  quitar_categoria: "Quitar categoría",
  quitar_restriccion: "Quitar restricción",
  no_aplica: "Sin cambio marginal aplicable",
};

/** Tooltip honesto de la mediana legacy: `null` = NA del motor, no un 0. */
export function medianaTitle(mediana: number | null): string {
  return mediana != null
    ? `Mediana de elegibles del aula típica incluida de este grupo: ${fmtDec(mediana, 0)}. Es la cifra que dice si estas aulas cubren la cuota.`
    : "Sin CH incluidos con dato: un 0 mentiría que el aula típica está vacía.";
}

function LegacyTipoSesion({ facultad }: { facultad: CalcMuestraAulasExploracionFacultad }) {
  const tipos = tipoSesionShares(facultad);
  const hayBoxplot = hayBoxplotElegibles(tipos);
  if (!tipos.length) {
    return (
      <p className="cmv2-explorador-card-vacio" data-qa-geometry-member>
        El resumen legacy no trae distribución por tipo de sesión para esta facultad.
      </p>
    );
  }

  return (
    <div className="cmv2-explorador-card-body" data-qa-geometry-member>
      <p className="cmv2-tsr-legacy-note">
        <strong>Resumen legacy.</strong> Este frame conserva la distribución histórica; recalcula para acreditar
        P10–P90, ambas medias y el delta marginal con el contrato por criterio.
      </p>
      <table
        className="cmv2-table cmv2-table--university cmv2-explorador-dist"
        aria-label={`Distribución de ${facultad.facultad} por tipo de sesión`}
      >
        <thead>
          <tr>
            <th>Tipo</th>
            <th data-numeric="true">CH · eleg.</th>
            <th data-numeric="true">Elegibles</th>
            <th data-numeric="true">Elegibles/aula</th>
            {hayBoxplot && <th className="cmv2-boxplot-col">Distribución</th>}
          </tr>
        </thead>
        <tbody>
          {tipos.map((tipo) => (
            <tr key={tipo.tipo}>
              <td>
                <div className="cmv2-explorador-dist-cell">
                  <span className="cmv2-explorador-dist-label" title={tipo.tipo}>{tipo.tipo}</span>
                  <span className="cmv2-explorador-dist-track" aria-hidden="true">
                    <i style={{ width: `${Math.max(2, Math.round(tipo.share * 100))}%` }} />
                  </span>
                  <span className="cmv2-explorador-dist-pct">{fmtDec(tipo.share * 100, 1)}%</span>
                </div>
              </td>
              <td
                data-numeric="true"
                title={`${fmtInt(tipo.chElegibles)} de ${fmtInt(tipo.ch)} cursos-horario con ≥1 elegible`}
              >
                {fmtInt(tipo.ch)}
                <span className="cmv2-dist-sub"> · {fmtInt(tipo.chElegibles)}</span>
              </td>
              <td data-numeric="true">{fmtInt(tipo.elegibles)}</td>
              <td data-numeric="true" title={medianaTitle(tipo.medianaElegibles)}>
                {tipo.medianaElegibles != null ? (
                  <>
                    <strong>{fmtDec(tipo.medianaElegibles, 0)}</strong>
                    {tipo.caja?.media != null ? (
                      <span className="cmv2-dist-sub"> · μ{fmtDec(tipo.caja.media, 0)}</span>
                    ) : null}
                    {tipo.caja ? (
                      <span className="cmv2-dist-rango">
                        {fmtInt(tipo.caja.min)}–{fmtInt(tipo.caja.max)}
                      </span>
                    ) : null}
                  </>
                ) : (
                  "—"
                )}
              </td>
              {hayBoxplot && (
                <td className="cmv2-boxplot-col">
                  {tipo.caja ? (
                    <BoxplotElegibles caja={tipo.caja} tipo={tipo.tipo} />
                  ) : (
                    <span className="cmv2-boxplot-vacio" title={medianaTitle(tipo.medianaElegibles)}>—</span>
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
            Escala propia por tipo (elegibles por aula). Este resumen no incluye P10/P90 ni contraste total.
          </span>
        </p>
      )}
    </div>
  );
}

export function TipoSesionRadiografia({
  facultad,
  facultadKey,
  radiografia,
  contexto,
}: {
  facultad: CalcMuestraAulasExploracionFacultad;
  facultadKey?: string;
  radiografia: CalcMuestraAulasCriteriosRadiografia | null;
  contexto: TipoSesionRadiografiaContexto;
}) {
  const filas = filasTipoSesionRadiografia(radiografia, facultadKey ?? "", facultad.facultad);
  const procedencia = contexto === "editable"
    ? "Exploración previa · último marco ejecutado"
    : "Marco ejecutado";
  const filasOwner = radiografia?.schema === "calc_muestra_aulas_criterios_radiografia_v2"
    ? radiografia.filas_owner
    : radiografia?.owner;
  const filasGrano = radiografia?.schema === "calc_muestra_aulas_criterios_radiografia_v2"
    ? radiografia.filas_grano
    : radiografia?.grano;

  return (
    <section
      className="cmv2-tsr"
      aria-label={`Radiografía de tipo de sesión en ${facultad.facultad}`}
    >
      {radiografia == null ? (
        <LegacyTipoSesion facultad={facultad} />
      ) : (
        <>
          <header className="cmv2-tsr-head">
            <div>
              <span className="cmv2-tsr-chip">{procedencia}</span>
              <strong>Tipo de sesión · radiografía por categoría</strong>
            </div>
            <dl className="cmv2-tsr-provenance" aria-label="Procedencia de la radiografía">
              <div><dt>Motor</dt><dd>{filasOwner}</dd></div>
              <div><dt>Marco</dt><dd title={radiografia.frame_hash}>{radiografia.frame_hash.slice(0, 12)}</dd></div>
              <div><dt>Momento</dt><dd>{radiografia.momento}</dd></div>
              <div><dt>Grano</dt><dd>{filasGrano}</dd></div>
              <div><dt>Unidad</dt><dd>{radiografia.unidad}</dd></div>
            </dl>
          </header>
          {contexto === "editable" ? (
            <p className="cmv2-tsr-edit-note" role="note">
              Estas cifras pertenecen al último marco ejecutado. El borrador entra al recalcular.
            </p>
          ) : null}
          {filas.length ? (
            <div
              className="cmv2-tsr-grid"
              data-qa-geometry-group="calc-muestra/session-type-radiografia"
              data-qa-geometry-contract="intrinsic"
            >
              {filas.map((fila) => (
                <article className="cmv2-tsr-card" key={fila.categoria_key} data-qa-geometry-member>
                  <header className="cmv2-tsr-card-head">
                    <strong>{fila.categoria_label}</strong>
                    <span>{ACCION_LABEL[fila.delta_marginal.accion]}</span>
                  </header>
                  <dl className="cmv2-tsr-counts" aria-label={`Conteos de ${fila.categoria_label}`}>
                    <div><dt>N CH total</dt><dd>{fmtInt(fila.n_ch_total)}</dd></div>
                    <div><dt>N CH elegibles</dt><dd>{fmtInt(fila.n_ch_elegibles)}</dd></div>
                    <div>
                      <dt>Matrículas elegibles</dt>
                      <dd>{fmtInt(fila.n_matriculas_elegibles)}<small>no alumnado único</small></dd>
                    </div>
                  </dl>
                  <div className="cmv2-tsr-means">
                    <div>
                      <span>Media elegible</span>
                      <strong>{fmtDec(fila.distribucion_elegible.media, 1)}</strong>
                      <small>{fmtInt(fila.distribucion_elegible.n_ch_con_dato)} CH con dato</small>
                    </div>
                    <div data-secondary>
                      <span>Media total · contraste</span>
                      <strong>{fmtDec(fila.contraste_total.media, 1)}</strong>
                      <small>{fmtInt(fila.contraste_total.n_ch_con_dato)} CH con dato</small>
                    </div>
                  </div>
                  <dl className="cmv2-tsr-quantiles" aria-label={`Cuantiles elegibles de ${fila.categoria_label}`}>
                    {([
                      ["P10", fila.distribucion_elegible.p10],
                      ["P25", fila.distribucion_elegible.p25],
                      ["P50", fila.distribucion_elegible.p50],
                      ["P75", fila.distribucion_elegible.p75],
                      ["P90", fila.distribucion_elegible.p90],
                    ] as const).map(([label, value]) => (
                      <div key={label}><dt>{label}</dt><dd>{fmtDec(value, 1)}</dd></div>
                    ))}
                  </dl>
                  <p className="cmv2-tsr-delta">
                    <span>{ACCION_LABEL[fila.delta_marginal.accion]}</span>
                    <strong>{fmtSignedInt(fila.delta_marginal.delta_ch)} CH</strong>
                    <strong>{fmtSignedInt(fila.delta_marginal.delta_matriculas_elegibles)} matrículas elegibles</strong>
                    <small>respecto del marco ejecutado</small>
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="cmv2-tsr-empty" data-qa-geometry-member>
              El contrato ejecutado no trae categorías de tipo de sesión para esta facultad.
            </p>
          )}
        </>
      )}
    </section>
  );
}
