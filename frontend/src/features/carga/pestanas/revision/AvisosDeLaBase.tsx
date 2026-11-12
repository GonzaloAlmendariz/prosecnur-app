import type { CargaReviewPayload } from "../../../../api/client";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { enumerar } from "../../../../lib/enumerar";
import { CargaReviewFuentesFindings } from "../../CargaReviewFuentesFindings";
import "../../CargaReviewSummary.css";

/**
 * El detalle de las comprobaciones que avisan sin pedir una decisión en la
 * tabla: cómo se emparejó cada fuente de una base que junta encuestas (con
 * "Ver preguntas"), las versiones del formulario con que se recolectó y el
 * orden de opciones del editor. Mismo contenido que el resumen anterior de
 * Revisión, ahora en el detalle de su comprobación. También las columnas de
 * opción múltiple que no se pudieron leer, cada una con su causa.
 */
export function AvisosDeLaBase({
  clave,
  revision,
}: {
  clave: "fuentes" | "versiones" | "orden" | "opciones-sin-leer";
  revision: CargaReviewPayload;
}) {
  if (clave === "opciones-sin-leer") {
    const sinLeer = revision.opciones_sin_leer;
    if (!sinLeer) return null;
    return (
      <dl className="pulso-revision-ficha">
        <dt>Columnas</dt>
        <dd>
          <ul className="pulso-revision-motivos" aria-label="Columnas de opción sin leer">
            {sinLeer.columnas.map((c) => (
              <li key={c.columna}>
                <code>{c.columna}</code>
                <span>{`${c.causa} ${formatoConteo(c.n_con_dato)} ${c.n_con_dato === 1 ? "caso" : "casos"} con dato en ${c.variable}.`}</span>
              </li>
            ))}
          </ul>
        </dd>
        <dt>Qué pasa</dt>
        <dd>No entran a su pregunta y quedan en la base como columnas aparte. Corrige la base y vuelve a cargarla.</dd>
      </dl>
    );
  }
  if (clave === "fuentes") {
    return (
      <ul
        className="pulso-carga-review-findings pulso-revision-avisos"
        aria-label="Emparejamiento de las fuentes de la base"
        data-qa-geometry-group="carga/revision-fuentes"
        data-qa-geometry-contract="intrinsic"
      >
        <CargaReviewFuentesFindings fuentes={revision.fuentes} tonos={["incompatible", "pending", "info"]} baseNombre={revision.base_nombre} />
      </ul>
    );
  }
  if (clave === "versiones") {
    const p = revision.procedencia;
    if (!p) return null;
    return (
      <dl className="pulso-revision-ficha">
        <dt>Versiones</dt>
        <dd>{formatoConteo(p.n_versiones)}</dd>
        <dt>Casos de otra versión</dt>
        <dd>{`${formatoConteo(p.n_casos_afectados)} de ${formatoConteo(p.n_casos)}`}</dd>
        {p.version_vigente ? (<><dt>Versión vigente</dt><dd><code>{p.version_vigente}</code></dd></>) : null}
        {p.columna ? (<><dt>Columna de la versión</dt><dd><code>{p.columna}</code></dd></>) : null}
        {p.mensaje ? (<><dt>Qué pasó</dt><dd>{p.mensaje}</dd></>) : null}
      </dl>
    );
  }
  const orden = revision.orden_editor;
  if (!orden) return null;
  return (
    <dl className="pulso-revision-ficha">
      {orden.omitidas.length > 0 ? (
        <>
          <dt>No siguen el orden</dt>
          <dd>
            <ul className="pulso-revision-motivos">
              {orden.omitidas.map((o) => <li key={o.variable}><code>{o.variable}</code><span>{o.motivo}</span></li>)}
            </ul>
          </dd>
        </>
      ) : null}
      {orden.editor_distinto.length > 0 ? (
        <>
          <dt>El editor tiene hoy otro orden</dt>
          <dd>La base conserva el orden con que se importó en {enumerar(orden.editor_distinto)}.</dd>
        </>
      ) : null}
      {orden.adoptadas.length > 0 ? (
        <>
          <dt>Usan el orden del editor</dt>
          <dd>{enumerar(orden.adoptadas)}</dd>
        </>
      ) : null}
    </dl>
  );
}
