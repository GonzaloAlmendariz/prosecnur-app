import type { CalcMuestraAulasCriterioRadiografiaV2Distribution } from "../../../../api/calcMuestraCriteriosRadiografia";
import { fmtInt } from "../../sharedCore";
import type { AporteCategoria } from "./controles";
import "./categoriaEvidencia.css";

/**
 * ADR 0057 · La evidencia de una categoría, en el mismo contenedor que decide.
 *
 * Antes esto vivía repartido: el conmutador aquí, la distribución en una consola
 * aparte, el efecto en el embudo en otro bloque con su propio lenguaje. Se
 * elegía en una zona de la pantalla mirando otra.
 *
 * Todo lo que se dibuja lo calcula R. React no promedia, no acumula y no
 * infiere: si un valor no viene, se declara ausente en vez de fabricarse.
 */

/** Dominio común a todas las categorías de un criterio (ADR 0057, regla 3). */
export type DominioCategorias = { min: number; max: number };

/**
 * Escala compartida por todas las categorías del criterio.
 *
 * Cada caja normalizada contra su propio rango sale del mismo ancho y sugiere
 * que todas las categorías se parecen. Comparar es lo único para lo que existe
 * este gráfico, así que la escala es del conjunto o no hay gráfico.
 */
export function dominioCategorias(
  aportes: Array<AporteCategoria | null | undefined>,
): DominioCategorias | null {
  const valores: number[] = [];
  for (const aporte of aportes) {
    const d = aporte?.distribucion;
    if (!d) continue;
    for (const v of [d.p10, d.p25, d.p50, d.p75, d.p90, d.media]) {
      if (typeof v === "number" && Number.isFinite(v)) valores.push(v);
    }
  }
  if (!valores.length) return null;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  return max > min ? { min, max } : { min, max: min + 1 };
}

function pct(valor: number, dominio: DominioCategorias): number {
  return ((valor - dominio.min) / (dominio.max - dominio.min)) * 100;
}

const fmt = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("es-PE", { maximumFractionDigits: 1 })
    : "—";

/**
 * Declaración de la escala del criterio.
 *
 * Antes esto dibujaba un eje con marcas — y **mentía**: medido en la app, el eje
 * quedaba en x=159 y las cajas en 637–693, cada una en su columna del grid. Unas
 * marcas que no están encima de los datos no se pueden leer contra ellos; son
 * decoración con aspecto de precisión, que es peor que no tener eje.
 *
 * La escala se declara aquí una vez, en palabras, y las marcas viajan pegadas a
 * cada caja, que es donde sí alinean.
 */
export function EjeCategorias({ dominio }: { dominio: DominioCategorias }) {
  return (
    <div className="cmv2-cat-escala-cabecera">
      <p className="cmv2-cat-escala-nota">
        Escala común del criterio: <strong>{fmt(dominio.min)}</strong> a{" "}
        <strong>{fmt(dominio.max)}</strong> estudiantes elegibles por curso-horario.
        Todas las cajas se dibujan sobre ella, así que se pueden comparar entre sí.
      </p>
      {/* Qué significa cada marca de la caja.
          La tarjeta dibuja cuatro marcas —rango, mediana, media, bigotes— y no
          decía qué era ninguna: sólo el `aria-label` lo explicaba, así que quien
          ve el gráfico tenía menos información que quien no lo ve. La leyenda va
          una vez por criterio, no por categoría. */}
      <ul className="cmv2-cat-leyenda" aria-hidden="true">
        <li><i className="cmv2-cat-leyenda-rango" /> mitad central (P25–P75)</li>
        <li><i className="cmv2-cat-leyenda-mediana" /> mediana</li>
        <li><i className="cmv2-cat-leyenda-media" /> media</li>
        <li><i className="cmv2-cat-leyenda-bigote" /> de P10 a P90</li>
      </ul>
    </div>
  );
}

/** Extremos de la escala, bajo la caja y alineados con ella. */
function EscalaCaja({ dominio }: { dominio: DominioCategorias }) {
  return (
    <div className="cmv2-cat-escala" aria-hidden="true">
      <span>{fmt(dominio.min)}</span>
      <span>{fmt(dominio.max)}</span>
    </div>
  );
}

/** Caja percentilar de una categoría sobre la escala del criterio. */
function Caja({
  d,
  dominio,
}: {
  d: CalcMuestraAulasCriterioRadiografiaV2Distribution;
  dominio: DominioCategorias;
}) {
  const tiene = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  if (!tiene(d.p25) || !tiene(d.p75)) {
    return <span className="cmv2-cat-caja-vacia">sin distribución publicada</span>;
  }
  const izq = pct(d.p25, dominio);
  const ancho = Math.max(0.8, pct(d.p75, dominio) - izq);
  return (
    <div className="cmv2-cat-caja" role="img"
      aria-label={`De P25 ${fmt(d.p25)} a P75 ${fmt(d.p75)}, mediana ${fmt(d.p50)}, media ${fmt(d.media)}`}>
      {tiene(d.p10) && tiene(d.p90) ? (
        <i className="cmv2-cat-bigote"
          style={{ left: `${pct(d.p10, dominio)}%`, width: `${Math.max(0.5, pct(d.p90, dominio) - pct(d.p10, dominio))}%` }} />
      ) : null}
      <i className="cmv2-cat-rango" style={{ left: `${izq}%`, width: `${ancho}%` }} />
      {tiene(d.p50) ? <i className="cmv2-cat-mediana" style={{ left: `${pct(d.p50, dominio)}%` }} /> : null}
      {tiene(d.media) ? <i className="cmv2-cat-media" style={{ left: `${pct(d.media, dominio)}%` }} /> : null}
    </div>
  );
}

/**
 * Todo lo que ADR 0057 exige de una categoría: cuántos CH, cuántos alumnos, la
 * forma de su distribución con sus cuantiles, y qué se espera que asista.
 */
export function CategoriaEvidencia({
  aporte,
  dominio,
}: {
  aporte: AporteCategoria;
  dominio: DominioCategorias | null;
}) {
  // Una categoría sin cursos-horario en esta facultad no tiene nada que
  // distribuir: cinco cuantiles en guiones ocupan espacio y no informan. Se dice
  // lo único cierto —que aquí no hay cursos— y se calla el resto. Quitar cinco
  // guiones no quita información; dejarlos sí quita atención.
  const sinCursos = aporte.ch === 0;
  const d = sinCursos ? null : aporte.distribucion ?? null;
  const presentes =
    typeof aporte.elegibles === "number" && typeof aporte.tasaAsistencia === "number"
      ? Math.round(aporte.elegibles * aporte.tasaAsistencia)
      : null;

  return (
    <div className="cmv2-cat-evidencia">
      <div className="cmv2-cat-cifras">
        <span><strong>{aporte.ch == null ? "—" : fmtInt(aporte.ch)}</strong> CH</span>
        {/* El número es `n_estudiantes_unicos`, no matrículas. En un módulo cuya
            cabecera muestra ambas cifras por separado —21.362 estudiantes y
            92.017 matrículas—, rotularlo «alumnos» a secas esconde de qué grano
            es, que es justo la confusión que este módulo existe para evitar. */}
        <span title="Estudiantes únicos elegibles: una persona cuenta una vez aunque esté en varios cursos-horario">
          <strong>{aporte.elegibles == null ? "—" : fmtInt(aporte.elegibles)}</strong> estudiantes
        </span>
        {aporte.matriculas != null ? (
          <span title="Matrículas elegibles: una persona cuenta una vez por cada curso-horario en que está">
            <strong>{fmtInt(aporte.matriculas)}</strong> matrículas
          </span>
        ) : null}
        {d?.media != null ? <span><strong>{fmt(d.media)}</strong> por CH</span> : null}
        {/* Si la distribución se calculó sobre menos CH de los que hay, decirlo:
            sin este número no se sabe cuánta de la categoría describe la caja. */}
        {aporte.chConDato != null && aporte.ch != null && aporte.chConDato < aporte.ch ? (
          <span className="cmv2-cat-parcial" title="Cursos-horario que traen el dato de este criterio">
            distribución sobre <strong>{fmtInt(aporte.chConDato)}</strong> de {fmtInt(aporte.ch)} CH
          </span>
        ) : null}
        {presentes != null ? (
          <span className="cmv2-cat-presentes">
            ~<strong>{fmtInt(presentes)}</strong> presentes
            <em>{Math.round((aporte.tasaAsistencia ?? 0) * 100)}% asistencia</em>
          </span>
        ) : null}
      </div>
      {sinCursos ? (
        <p className="cmv2-cat-sin-cursos">sin cursos-horario en esta facultad</p>
      ) : null}
      {d && dominio ? (
        <>
          <Caja d={d} dominio={dominio} />
          <EscalaCaja dominio={dominio} />
          <dl className="cmv2-cat-cuantiles">
            <div><dt>P10</dt><dd>{fmt(d.p10)}</dd></div>
            <div><dt>P25</dt><dd>{fmt(d.p25)}</dd></div>
            <div><dt>Mediana</dt><dd>{fmt(d.p50)}</dd></div>
            <div><dt>P75</dt><dd>{fmt(d.p75)}</dd></div>
            <div><dt>P90</dt><dd>{fmt(d.p90)}</dd></div>
          </dl>
        </>
      ) : null}
    </div>
  );
}
