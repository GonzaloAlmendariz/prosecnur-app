import { fmtDec, fmtInt } from "../../sharedCore";
import type { FacultadBloque, ResumenDecisionFacultad } from "./facultadDecisionModel";
import "../shared/tablas.css";
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
          {filas.length} facultades · barra sobre escala común 0 – {fmtInt(escala)} CH ·
          el punto (·) hereda la regla general del estudio
        </p>
      </header>

      <div className="cmv2-panorama-scroll" tabIndex={0}>
        <table className="cmv2-tabla cmv2-panorama-table">
          <thead>
            <tr>
              <th scope="col">Facultad</th>
              <th scope="col">CH elegibles del total</th>
              <th scope="col" className="cmv2-num">Mediana</th>
              {/* Sin `title`: repetía exactamente el texto visible y la cabecera
                  no trunca, así que el tooltip no aportaba nada. Un `title`
                  redundante es ruido que además compite con los que sí explican
                  algo. */}
              {criterios.map((criterio) => (
                <th key={criterio.id} scope="col">{criterio.label}</th>
              ))}
              {/* El nivel del curso ES decidible por facultad (rangos +
                  exenciones) y el panorama lo omitía: la vista que existe para
                  ver quién se aparta callaba el criterio donde más facultades
                  se apartan (12 con rango y 3 exentas en HSVG2026). */}
              <th scope="col">Nivel del curso</th>
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
                  <td className="cmv2-num cmv2-panorama-num">
                    {fac.est_aula_mediana == null ? "—" : fmtDec(fac.est_aula_mediana, 0)}
                  </td>
                  {criterios.map((criterio) => {
                    const detalle = resumen.detalles.find((d) => d.variableId === criterio.id);
                    const propia = Boolean(detalle?.propia);
                    /* ADR 0057 evolucionado · Lo informativo es quién se APARTA
                       y QUÉ decide. «propio» a secas tampoco informaba —Gonzalo:
                       «¿cómo que "propio"?»— así que la celda dice la regla en
                       corto («además TALLER», «sólo TEORICO +2»). Heredar sigue
                       siendo un punto: es el caso normal y no compite. */
                    const regla = detalle?.regla ?? "propio";
                    return (
                      <td
                        key={criterio.id}
                        className="cmv2-panorama-estado"
                        data-propia={propia ? "true" : "false"}
                        title={propia
                          ? `${fac.facultad}: en ${criterio.label} decide ${regla}`
                          : `${fac.facultad}: aplica el criterio general en ${criterio.label}`}
                      >
                        {propia ? regla : <span aria-label="aplica el criterio general">·</span>}
                      </td>
                    );
                  })}
                  <td
                    className="cmv2-panorama-estado"
                    data-propia={resumen.nivelRegla ? "true" : "false"}
                    title={resumen.nivelRegla
                      ? `${fac.facultad}: ${resumen.nivelRegla === "exenta"
                        ? "exenta del criterio de nivel"
                        : `admite ${resumen.nivelRegla}`}`
                      : `${fac.facultad}: admite todos los niveles`}
                  >
                    {resumen.nivelRegla ?? <span aria-label="admite todos los niveles">·</span>}
                  </td>
                  <td
                    className="cmv2-panorama-estado"
                    data-propia={resumen.minPropio ? "true" : "false"}
                    title={resumen.minPropio
                      ? `${fac.facultad}: exige ${resumen.minRegla ?? "un mínimo propio"} elegibles por curso-horario`
                      : `${fac.facultad}: aplica el mínimo general`}
                  >
                    {resumen.minPropio
                      ? (resumen.minRegla ?? "propio")
                      : <span aria-label="aplica el mínimo general">·</span>}
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
