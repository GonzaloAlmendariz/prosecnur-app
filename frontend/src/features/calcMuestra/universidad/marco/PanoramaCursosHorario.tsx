import { fmtDec, fmtInt } from "../../sharedCore";
import type { FacultadBloque, ResumenDecisionFacultad } from "./facultadDecisionModel";
import "./panoramaCursosHorario.css";

/**
 * Panorama de los criterios de curso-horario: las facultades y sus decisiones
 * en UNA vista.
 *
 * El acordeón por facultad resolvió bien la decisión —cada criterio con su dato
 * al lado— pero solo deja ver **una facultad a la vez**, y abrir una cuesta
 * ~1.960 px. Con 17 facultades, comparar exigía abrir, recordar y cerrar: la
 * información completa de los criterios de CH no se podía ver nunca junta.
 *
 * Este panorama es la **foto**; el acordeón sigue siendo el taller. Presenta
 * solo lo que el marco ya publicó por facultad (CH elegibles, CH totales,
 * mediana de elegibles por aula) y lo que la selección ya declara (qué criterios
 * decide propio cada facultad). No calcula ni agrega nada.
 */
export type PanoramaFila = {
  bloque: FacultadBloque;
  resumen: ResumenDecisionFacultad;
};

/** Escala común de CH totales: sin ella las barras no se pueden comparar. */
export function panoramaEscala(filas: ReadonlyArray<PanoramaFila>): number {
  let max = 0;
  for (const fila of filas) {
    const total = fila.bloque.fac.ch_total ?? 0;
    if (Number.isFinite(total) && total > max) max = total;
  }
  return max;
}

export function PanoramaCursosHorario({
  filas,
  criterios,
  facultadAbierta,
  onAbrirFacultad,
}: {
  filas: ReadonlyArray<PanoramaFila>;
  /** Criterios de CH decidibles por facultad, en el orden del catálogo. */
  criterios: ReadonlyArray<{ id: string; label: string }>;
  facultadAbierta?: string | null;
  onAbrirFacultad?: (excKey: string) => void;
}) {
  if (!filas.length) return null;
  const escala = panoramaEscala(filas);
  const pct = (valor: number | null | undefined) => {
    if (!escala || valor == null || !Number.isFinite(valor)) return 0;
    return Math.max(0, Math.min(100, (valor / escala) * 100));
  };

  return (
    <section
      className="cmv2-panorama"
      aria-label="Panorama de criterios de curso-horario por facultad"
      data-qa-geometry-group="calc-muestra/panorama-cursos-horario"
      data-qa-geometry-contract="intrinsic"
    >
      <header className="cmv2-panorama-head">
        <h3>Panorama por facultad</h3>
        <p className="cmv2-panorama-escala">
          {filas.length} facultades · barra sobre escala común 0 – {fmtInt(escala)} CH
        </p>
      </header>

      <div className="cmv2-panorama-scroll" tabIndex={0}>
        <table className="cmv2-panorama-table">
          <thead>
            <tr>
              <th scope="col">Facultad</th>
              <th scope="col">CH elegibles del total</th>
              <th scope="col">Mediana</th>
              {criterios.map((criterio) => (
                <th key={criterio.id} scope="col" title={criterio.label}>{criterio.label}</th>
              ))}
              <th scope="col">Mínimo</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ bloque, resumen }) => {
              const fac = bloque.fac;
              const abierta = facultadAbierta === bloque.excKey;
              return (
                <tr
                  key={bloque.excKey}
                  data-abierta={abierta ? "true" : "false"}
                  data-qa-geometry-member
                  data-qa-geometry-capacity="owned"
                >
                  <th scope="row">
                    <button
                      type="button"
                      onClick={() => onAbrirFacultad?.(bloque.excKey)}
                      aria-label={`Abrir ${bloque.facLabel}`}
                    >
                      {bloque.facLabel}
                    </button>
                  </th>
                  <td className="cmv2-panorama-barra-celda">
                    <span className="cmv2-panorama-barra" aria-hidden="true">
                      <i style={{ width: `${pct(fac.ch_total)}%` }} data-capa="total" />
                      <i style={{ width: `${pct(fac.ch_elegibles)}%` }} data-capa="elegibles" />
                    </span>
                    <span className="cmv2-panorama-cifra">
                      <strong>{fmtInt(fac.ch_elegibles)}</strong> de {fmtInt(fac.ch_total)}
                    </span>
                  </td>
                  <td className="cmv2-panorama-num">
                    {fac.est_aula_mediana == null ? "—" : fmtDec(fac.est_aula_mediana, 0)}
                  </td>
                  {criterios.map((criterio) => {
                    const detalle = resumen.detalles.find((d) => d.variableId === criterio.id);
                    const propia = Boolean(detalle?.propia);
                    return (
                      /* ADR 0057 · Lo informativo es quién se APARTA.
                         Medido: «global» aparecía 56 veces en una pantalla —una
                         palabra que se repite en casi todas las celdas no dice
                         nada y tapa las pocas que sí—. Heredar es el caso normal
                         y se marca con un punto; apartarse se nombra. */
                      <td
                        key={criterio.id}
                        className="cmv2-panorama-estado"
                        data-propia={propia ? "true" : "false"}
                        title={propia
                          ? `${fac.facultad}: criterio propio en ${criterio.label}`
                          : `${fac.facultad}: aplica el criterio general en ${criterio.label}`}
                      >
                        {propia ? "propio" : <span aria-label="aplica el criterio general">·</span>}
                      </td>
                    );
                  })}
                  <td
                    className="cmv2-panorama-estado"
                    data-propia={resumen.minPropio ? "true" : "false"}
                    title={resumen.minPropio
                      ? `${fac.facultad}: mínimo propio`
                      : `${fac.facultad}: aplica el mínimo general`}
                  >
                    {resumen.minPropio ? "propio" : <span aria-label="aplica el mínimo general">·</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
